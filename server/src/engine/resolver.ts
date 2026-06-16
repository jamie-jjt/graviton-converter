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
   */
  resolve(issue: ConversionIssue): ConversionIssue {
    if (!issue.autoResolvable || !issue.suggestedFix) {
      return issue;
    }

    try {
      const filePath = path.join(this.basePath, issue.file);

      if (!fs.existsSync(filePath)) {
        return issue;
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      if (issue.line && issue.line <= lines.length && issue.originalCode) {
        const lineIndex = issue.line - 1;
        const originalLine = lines[lineIndex];

        if (originalLine.trim() === issue.originalCode) {
          lines[lineIndex] = issue.suggestedFix;
          fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');

          return {
            ...issue,
            status: 'auto-resolved',
            resolution: issue.suggestedFix,
          };
        }
      }

      return issue;
    } catch {
      return issue;
    }
  }

  /**
   * Manually resolve an issue with a provided resolution.
   */
  manualResolve(issue: ConversionIssue, resolution: string): ConversionIssue {
    try {
      const filePath = path.join(this.basePath, issue.file);

      if (!fs.existsSync(filePath)) {
        return { ...issue, status: 'manually-resolved', resolution };
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      if (issue.line && issue.line <= lines.length && issue.originalCode) {
        const lineIndex = issue.line - 1;
        const originalLine = lines[lineIndex];

        if (originalLine.trim() === issue.originalCode) {
          lines[lineIndex] = originalLine.replace(issue.originalCode, resolution);
          fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
        }
      }

      return {
        ...issue,
        status: 'manually-resolved',
        resolution,
      };
    } catch {
      return { ...issue, status: 'manually-resolved', resolution };
    }
  }
}
