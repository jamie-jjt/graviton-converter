import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { ConversionIssue } from '../types';
import { v4Generator } from '../utils/id';

/**
 * CI/CD pipeline file patterns to scan.
 */
const CICD_FILE_PATTERNS = [
  '.github/workflows/*.yml',
  '.github/workflows/*.yaml',
  '.gitlab-ci.yml',
  '.gitlab-ci.yaml',
  'Jenkinsfile',
  '.circleci/config.yml',
  '.circleci/config.yaml',
  'buildspec.yml',
  'buildspec.yaml',
  'azure-pipelines.yml',
  'azure-pipelines.yaml',
  '.travis.yml',
];

/**
 * Known x86 runner images and their ARM64 equivalents.
 */
const RUNNER_MAPPINGS: Record<string, string> = {
  'ubuntu-latest': 'ubuntu-24.04-arm',
  'ubuntu-22.04': 'ubuntu-22.04-arm',
  'ubuntu-20.04': 'ubuntu-22.04-arm',
  'windows-latest': 'ubuntu-24.04-arm (requires rewriting Windows-specific steps)',
  'macos-latest': 'ubuntu-24.04-arm (if Linux-compatible)',
};

/**
 * Patterns indicating x86-specific CI/CD configuration.
 */
const X86_PATTERNS: Array<{ pattern: RegExp; title: string; description: string }> = [
  {
    pattern: /runs-on:\s*(ubuntu-latest|ubuntu-\d+\.\d+|windows-latest|windows-\d+|macos-latest|macos-\d+)/,
    title: 'GitHub Actions runner may not support ARM64',
    description: 'The runs-on directive specifies a runner that may default to x86_64. Consider using ARM64 runners for Graviton compatibility testing.',
  },
  {
    pattern: /image:\s*["']?(amd64|x86_64)\//,
    title: 'x86-specific container image in CI/CD',
    description: 'Container image explicitly targets x86/amd64 architecture.',
  },
  {
    pattern: /--platform[= ]linux\/amd64/,
    title: 'Docker platform pinned to amd64 in CI/CD',
    description: 'Docker commands explicitly target linux/amd64 platform.',
  },
  {
    pattern: /GOARCH=amd64|TARGETARCH=amd64/,
    title: 'Build architecture hardcoded to amd64',
    description: 'Build configuration targets only amd64. Add arm64 build target.',
  },
  {
    pattern: /docker\s+(build|pull).*amd64/,
    title: 'Docker operation targeting amd64',
    description: 'Docker build or pull explicitly targets amd64 architecture.',
  },
  {
    pattern: /machine:\s*["']?large|resource_class:\s*["']?(medium|large|xlarge)/,
    title: 'CircleCI resource class may be x86-only',
    description: 'CircleCI resource class. Consider using arm.medium or arm.large for ARM64 testing.',
  },
  {
    pattern: /agent\s*\{[\s\S]*?label\s+['"]?(linux|x86|amd64)/,
    title: 'Jenkins agent label may indicate x86',
    description: 'Jenkins agent label suggests x86 architecture. Add ARM64 agent support.',
  },
];

/**
 * Scans CI/CD pipeline files for x86-specific configurations.
 */
export class CicdScanner {
  private scanPath: string;

  constructor(scanPath: string) {
    this.scanPath = scanPath;
  }

  async scan(): Promise<ConversionIssue[]> {
    const issues: ConversionIssue[] = [];

    const files = await glob(CICD_FILE_PATTERNS, {
      cwd: this.scanPath,
      absolute: true,
      nodir: true,
    });

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const relativePath = path.relative(this.scanPath, file);
        const fileIssues = this.analyzeFile(relativePath, content);
        issues.push(...fileIssues);
      } catch {
        // Skip unreadable files
      }
    }

    return issues;
  }

  private analyzeFile(filePath: string, content: string): ConversionIssue[] {
    const issues: ConversionIssue[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      for (const { pattern, title, description } of X86_PATTERNS) {
        const match = line.match(pattern);
        if (match) {
          // Avoid duplicate issues for same pattern on same line
          if (!issues.some(existing => existing.file === filePath && existing.line === i + 1 && existing.title === title)) {
            issues.push(this.createIssue(filePath, i + 1, line.trim(), match[0], title, description));
          }
        }
      }
    }

    return issues;
  }

  private createIssue(
    file: string,
    line: number,
    originalLine: string,
    match: string,
    title: string,
    description: string,
  ): ConversionIssue {
    const suggestions = this.getSuggestions(match, file);
    const autoFix = this.getAutoFix(originalLine);

    return {
      id: v4Generator(),
      file,
      line,
      category: 'cicd-pipeline',
      severity: 'warning',
      status: 'unresolved',
      title,
      description,
      originalCode: originalLine,
      suggestedFix: autoFix,
      autoResolvable: !!autoFix,
      suggestions,
    };
  }

  private getSuggestions(match: string, file: string): ConversionIssue['suggestions'] {
    const suggestions: ConversionIssue['suggestions'] = [];

    // Check if it's a runs-on directive
    const runnerMatch = match.match(/runs-on:\s*(\S+)/);
    if (runnerMatch) {
      const currentRunner = runnerMatch[1];
      const suggestedRunner = RUNNER_MAPPINGS[currentRunner];
      if (suggestedRunner) {
        suggestions.push({
          id: 'arm64-runner',
          title: `Switch to ARM64 runner: ${suggestedRunner}`,
          description: `Replace ${currentRunner} with an ARM64 runner for Graviton compatibility.`,
          code: `runs-on: ${suggestedRunner}`,
          confidence: 85,
          source: 'GitHub Actions ARM64 Runners',
        });
      }
    }

    // Generic multi-arch suggestion
    suggestions.push({
      id: 'multi-arch-ci',
      title: 'Add multi-architecture CI matrix',
      description: 'Run CI/CD on both x86_64 and arm64 to verify compatibility.',
      code: file.includes('.github') ?
        'strategy:\n  matrix:\n    arch: [x64, arm64]\n    include:\n      - arch: arm64\n        runs-on: ubuntu-24.04-arm' :
        '# Add ARM64 build target to your CI matrix',
      confidence: 80,
      source: 'CI/CD Best Practice',
    });

    return suggestions;
  }

  private getAutoFix(originalLine: string): string | undefined {
    // Auto-fix runs-on directives
    for (const [x86Runner, arm64Runner] of Object.entries(RUNNER_MAPPINGS)) {
      if (originalLine.includes(x86Runner) && !arm64Runner.includes('requires')) {
        return originalLine.replace(x86Runner, arm64Runner);
      }
    }

    // Auto-fix platform directives
    if (originalLine.includes('--platform=linux/amd64') || originalLine.includes('--platform linux/amd64')) {
      return originalLine
        .replace('--platform=linux/amd64', '--platform=linux/arm64')
        .replace('--platform linux/amd64', '--platform linux/arm64');
    }

    return undefined;
  }
}
