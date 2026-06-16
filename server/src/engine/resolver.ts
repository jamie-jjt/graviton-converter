import * as fs from 'fs';
import * as path from 'path';
import { ConversionIssue } from '../types';

export class AutoResolver {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  /**
   * Attempts to auto-resolve all issues that are marked as autoResolvable.
   * Returns the updated list of issues with resolved statuses.
   */
  resolveAll(issues: ConversionIssue[]): ConversionIssue[] {
    return issues.map(issue => {
      if (issue.autoResolvable && issue.status === 'unresolved') {
        return this.resolve(issue);
      }
      return issue;
    });
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
