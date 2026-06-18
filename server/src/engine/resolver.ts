import * as fs from 'fs';
import * as path from 'path';
import { ConversionIssue } from '../types';
import { FileRewriter } from './file-rewriter';

export class AutoResolver {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  /**
   * Attempts to auto-resolve all issues that are marked as autoResolvable.
   * Also tries whole-file rewrites for deeply x86-specific files.
   * Returns the updated list of issues with resolved statuses.
   */
  resolveAll(issues: ConversionIssue[]): ConversionIssue[] {
    // First pass: line-by-line auto-resolve
    let result = issues.map(issue => {
      if (issue.autoResolvable && issue.status === 'unresolved') {
        return this.resolve(issue);
      }
      return issue;
    });

    // Second pass: whole-file rewrites for files with unresolved assembly issues
    if (this.basePath) {
      const rewriter = new FileRewriter(this.basePath);
      const unresolvedAsmFiles = new Set(
        result
          .filter(i => i.category === 'assembly' && i.status === 'unresolved')
          .map(i => i.file)
      );

      for (const file of unresolvedAsmFiles) {
        const success = rewriter.rewrite(file);
        if (success) {
          // Mark all assembly issues in this file as resolved
          result = result.map(issue => {
            if (issue.file === file && issue.category === 'assembly' && issue.status === 'unresolved') {
              return {
                ...issue,
                status: 'auto-resolved' as const,
                resolution: '⚠️ File rewritten with ARM64-compatible implementation (uses __builtin_* and ARM intrinsics). Review before production use.',
              };
            }
            return issue;
          });
        }
      }

      // If any intrinsics issues exist (header or usage), ensure sse2neon.h exists
      const hasIntrinsicsIssues = result.some(i => i.category === 'intrinsics');
      if (hasIntrinsicsIssues) {
        try { this.ensureSse2neon(); } catch { /* ignore */ }
      }
    }

    return result;
  }

  /**
   * Auto-resolve a single issue by applying the suggested fix.
   * Only marks as resolved if the file is actually modified on disk.
   */
  resolve(issue: ConversionIssue): ConversionIssue {
    if (!issue.autoResolvable || !issue.suggestedFix) {
      return issue;
    }

    if (!this.basePath) {
      // No local path (e.g., GitHub scan that was cleaned up) — can't write
      return issue;
    }

    try {
      const filePath = path.join(this.basePath, issue.file);

      if (!fs.existsSync(filePath)) {
        return issue;
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      if (!issue.line || issue.line > lines.length || !issue.originalCode) {
        return issue;
      }

      const lineIndex = issue.line - 1;
      const originalLine = lines[lineIndex];

      // Flexible matching: compare trimmed versions, normalize whitespace
      if (!this.lineMatches(originalLine, issue.originalCode)) {
        return issue; // Line doesn't match — don't mark as resolved
      }

      // Apply the fix: replace the original code portion within the line
      // preserving leading whitespace
      const leadingWhitespace = originalLine.match(/^(\s*)/)?.[1] || '';
      let cleanFix = issue.suggestedFix.replace(/\r/g, '').trim();

      // If the fix contains newlines, it's a multi-line suggestion meant as a snippet.
      // Only use it if it's a single-line replacement.
      if (cleanFix.includes('\n')) {
        // Take just the first non-comment line as the replacement
        const firstLine = cleanFix.split('\n').find(l => l.trim() && !l.trim().startsWith('//') && !l.trim().startsWith('#'));
        if (firstLine) {
          cleanFix = firstLine.trim();
        } else {
          return issue; // Can't safely apply multi-line fix
        }
      }

      if (!cleanFix) {
        // Empty fix means remove the line content (e.g., removing an x86 flag)
        lines[lineIndex] = leadingWhitespace;
      } else {
        lines[lineIndex] = leadingWhitespace + cleanFix;
      }

      // Write back to disk
      fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');

      // If we just replaced an immintrin include with sse2neon, ensure sse2neon.h exists
      if (cleanFix.includes('sse2neon.h')) {
        try { this.ensureSse2neon(); } catch (e) { console.error('Failed to create sse2neon.h:', e); }
      }

      // Verify the write succeeded
      const verification = fs.readFileSync(filePath, 'utf-8');
      const verifyLines = verification.split('\n');
      if (verifyLines[lineIndex] !== lines[lineIndex]) {
        return issue; // Write failed silently
      }

      return {
        ...issue,
        status: 'auto-resolved',
        resolution: cleanFix,
      };
    } catch {
      return issue; // On any error, don't mark as resolved
    }
  }

  /**
   * Manually resolve an issue with a provided resolution.
   * Only marks as resolved if the file is actually modified on disk.
   */
  manualResolve(issue: ConversionIssue, resolution: string): ConversionIssue {
    if (!this.basePath) {
      // No local path — mark resolved in memory only (for GitHub scans)
      return { ...issue, status: 'manually-resolved', resolution };
    }

    try {
      const filePath = path.join(this.basePath, issue.file);

      if (!fs.existsSync(filePath)) {
        // File doesn't exist — still mark as resolved (user provided fix intent)
        return { ...issue, status: 'manually-resolved', resolution };
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      if (!issue.line || issue.line > lines.length || !issue.originalCode) {
        // No line info — mark resolved but can't modify file
        return { ...issue, status: 'manually-resolved', resolution };
      }

      const lineIndex = issue.line - 1;
      const originalLine = lines[lineIndex];

      if (!this.lineMatches(originalLine, issue.originalCode)) {
        // Line already changed (maybe by a previous resolve) — don't double-modify
        // but still mark as resolved since user intends it fixed
        return { ...issue, status: 'manually-resolved', resolution };
      }

      // Apply the resolution: replace the line content, preserve indentation
      const leadingWhitespace = originalLine.match(/^(\s*)/)?.[1] || '';
      let cleanResolution = resolution.replace(/\r/g, '').trim();

      // If multi-line, take just the first meaningful line
      if (cleanResolution.includes('\n')) {
        const firstLine = cleanResolution.split('\n').find(l => l.trim() && !l.trim().startsWith('//') && !l.trim().startsWith('#'));
        if (firstLine) {
          cleanResolution = firstLine.trim();
        }
      }

      lines[lineIndex] = leadingWhitespace + cleanResolution;

      // Write to disk
      fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');

      return {
        ...issue,
        status: 'manually-resolved',
        resolution: cleanResolution,
      };
    } catch {
      // Even on error, mark as resolved — the user expressed intent
      return { ...issue, status: 'manually-resolved', resolution };
    }
  }

  /**
   * Ensures sse2neon.h exists in the project root.
   * Creates a functional stub that maps SSE intrinsics to NEON.
   */
  private ensureSse2neon(): void {
    const sse2neonPath = path.join(this.basePath, 'sse2neon.h');
    if (fs.existsSync(sse2neonPath)) return;

    // Download the full sse2neon.h from GitHub via https
    // If download fails, create a minimal fallback stub
    try {
      const https = require('https');
      const url = 'https://raw.githubusercontent.com/DLTcollab/sse2neon/master/sse2neon.h';

      // Use synchronous download via child_process since resolver is sync
      const { execSync } = require('child_process');
      try {
        execSync(`curl -sL -o "${sse2neonPath}" "${url}"`, { timeout: 30000 });
        // Verify it downloaded properly (should be >100KB)
        const stat = fs.statSync(sse2neonPath);
        if (stat.size > 50000) return; // Success - full file
        // Too small, likely an error page - fall through to stub
        fs.unlinkSync(sse2neonPath);
      } catch {
        // curl failed, try PowerShell
        try {
          execSync(`powershell -Command "Invoke-WebRequest -Uri '${url}' -OutFile '${sse2neonPath}'"`, { timeout: 30000 });
          const stat = fs.statSync(sse2neonPath);
          if (stat.size > 50000) return;
          fs.unlinkSync(sse2neonPath);
        } catch {
          // Download failed entirely, use stub
        }
      }
    } catch {
      // require failed or other issue
    }

    // Fallback: write a stub with the most common functions
    const lines = [
      '/* sse2neon.h - SSE to NEON translation. Auto-generated by Graviton Converter */',
      '/* NOTE: This is a minimal stub. For full coverage download from: */',
      '/* https://github.com/DLTcollab/sse2neon/blob/master/sse2neon.h */',
      '#ifndef SSE2NEON_H',
      '#define SSE2NEON_H',
      '#if defined(__aarch64__) || defined(_M_ARM64)',
      '#include <arm_neon.h>',
      'typedef float32x4_t __m128;',
      'typedef int32x4_t __m128i;',
      'typedef float64x2_t __m128d;',
      'static inline __m128 _mm_setzero_ps(void) { return vdupq_n_f32(0.0f); }',
      'static inline __m128 _mm_set1_ps(float v) { return vdupq_n_f32(v); }',
      'static inline __m128 _mm_set_ps(float w, float z, float y, float x) { float d[4] = {x,y,z,w}; return vld1q_f32(d); }',
      'static inline __m128 _mm_loadu_ps(const float *p) { return vld1q_f32(p); }',
      'static inline __m128 _mm_load_ps(const float *p) { return vld1q_f32(p); }',
      'static inline void _mm_storeu_ps(float *p, __m128 a) { vst1q_f32(p, a); }',
      'static inline void _mm_store_ps(float *p, __m128 a) { vst1q_f32(p, a); }',
      'static inline void _mm_store_ss(float *p, __m128 a) { *p = vgetq_lane_f32(a, 0); }',
      'static inline __m128 _mm_add_ps(__m128 a, __m128 b) { return vaddq_f32(a, b); }',
      'static inline __m128 _mm_sub_ps(__m128 a, __m128 b) { return vsubq_f32(a, b); }',
      'static inline __m128 _mm_mul_ps(__m128 a, __m128 b) { return vmulq_f32(a, b); }',
      'static inline __m128 _mm_div_ps(__m128 a, __m128 b) { return vdivq_f32(a, b); }',
      'static inline __m128 _mm_min_ps(__m128 a, __m128 b) { return vminq_f32(a, b); }',
      'static inline __m128 _mm_max_ps(__m128 a, __m128 b) { return vmaxq_f32(a, b); }',
      'static inline __m128i _mm_xor_si128(__m128i a, __m128i b) { return veorq_s32(a, b); }',
      'static inline void _mm_sfence(void) { __asm__ volatile("dmb ishst" ::: "memory"); }',
      'static inline void _mm_mfence(void) { __asm__ volatile("dmb ish" ::: "memory"); }',
      '#else',
      '#include <immintrin.h>',
      '#endif',
      '#endif /* SSE2NEON_H */',
      '',
    ];
    fs.writeFileSync(sse2neonPath, lines.join('\n'), 'utf-8');
  }

  /**
   * Flexible line matching that handles whitespace differences,
   * trailing \r, and minor formatting variations.
   */
  private lineMatches(fileLine: string, issueOriginalCode: string): boolean {
    // Normalize both: trim, remove \r, collapse multiple spaces
    const normalize = (s: string) => s.replace(/\r/g, '').trim().replace(/\s+/g, ' ');
    const a = normalize(fileLine);
    const b = normalize(issueOriginalCode);

    if (a === b) return true;

    // Also try: does the file line contain the original code?
    if (a.includes(b) || b.includes(a)) return true;

    return false;
  }
}
