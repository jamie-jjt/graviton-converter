import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { ConversionIssue, ScanResult, ScanSource, ScanSummary } from '../types';
import { detectionRules, DetectionRule } from './rules';
import { v4Generator } from '../utils/id';
import { BinaryDetector } from './binary-detector';
import { CicdScanner } from './cicd-scanner';
import { InfraScanner } from './infra-scanner';

const IGNORED_DIRS = ['node_modules', '.git', 'dist', 'build', '__pycache__', '.venv', 'venv', 'target', 'vendor'];
const MAX_FILE_SIZE = 1024 * 1024; // 1MB

export class Scanner {
  private scanPath: string;

  constructor(scanPath: string) {
    this.scanPath = scanPath;
  }

  async scan(): Promise<{ issues: ConversionIssue[]; totalFiles: number; scannedFiles: number }> {
    const issues: ConversionIssue[] = [];
    let totalFiles = 0;
    let scannedFiles = 0;

    const files = await this.getFiles();
    totalFiles = files.length;

    for (const file of files) {
      try {
        const stat = fs.statSync(file);
        if (stat.size > MAX_FILE_SIZE) continue;

        const content = fs.readFileSync(file, 'utf-8');
        const relativePath = path.relative(this.scanPath, file);
        const fileIssues = this.analyzeFile(relativePath, content);
        issues.push(...fileIssues);
        scannedFiles++;
      } catch {
        // Skip files that can't be read
      }
    }

    // Run additional scanners in parallel
    const [binaryIssues, cicdIssues, infraIssues] = await Promise.all([
      new BinaryDetector(this.scanPath).detect(),
      new CicdScanner(this.scanPath).scan(),
      new InfraScanner(this.scanPath).scan(),
    ]);

    issues.push(...binaryIssues, ...cicdIssues, ...infraIssues);

    return { issues, totalFiles, scannedFiles };
  }

  private async getFiles(): Promise<string[]> {
    const ignorePattern = IGNORED_DIRS.map(d => `**/${d}/**`);
    return glob('**/*', {
      cwd: this.scanPath,
      absolute: true,
      nodir: true,
      ignore: ignorePattern,
    });
  }

  private analyzeFile(filePath: string, content: string): ConversionIssue[] {
    const issues: ConversionIssue[] = [];
    const lines = content.split('\n');

    for (const rule of detectionRules) {
      if (!this.matchesFilePattern(filePath, rule.filePatterns)) continue;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const pattern of rule.contentPatterns) {
          const match = line.match(pattern);
          if (match) {
            const issue = this.createIssue(rule, filePath, i + 1, match[0], line);
            // Avoid duplicate issues for same rule + file + line
            if (!issues.some(existing => existing.file === issue.file && existing.line === issue.line && existing.category === issue.category)) {
              issues.push(issue);
            }
            break; // Only one issue per rule per line
          }
        }
      }
    }

    return issues;
  }

  private matchesFilePattern(filePath: string, patterns: RegExp[]): boolean {
    return patterns.some(p => p.test(filePath));
  }

  private createIssue(rule: DetectionRule, file: string, line: number, match: string, fullLine: string): ConversionIssue {
    const suggestions = rule.getSuggestions(match, file);
    const autoFix = rule.getAutoFix ? rule.getAutoFix(fullLine, file) : undefined;

    return {
      id: v4Generator(),
      file,
      line,
      category: rule.category,
      severity: rule.severity,
      status: 'unresolved',
      title: rule.title,
      description: rule.description,
      originalCode: fullLine.trim(),
      suggestedFix: autoFix,
      autoResolvable: rule.autoResolvable && !!autoFix,
      suggestions,
    };
  }
}

export function createScanSummary(issues: ConversionIssue[], totalFiles: number, scannedFiles: number): ScanSummary {
  return {
    totalFiles,
    scannedFiles,
    totalIssues: issues.length,
    critical: issues.filter(i => i.severity === 'critical').length,
    warnings: issues.filter(i => i.severity === 'warning').length,
    info: issues.filter(i => i.severity === 'info').length,
    autoResolvable: issues.filter(i => i.autoResolvable && i.status === 'unresolved').length,
    resolved: issues.filter(i => i.status === 'auto-resolved' || i.status === 'manually-resolved').length,
  };
}
