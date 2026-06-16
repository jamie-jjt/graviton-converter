import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { ConversionIssue } from '../types';
import { v4Generator } from '../utils/id';

/**
 * Mapping of x86 instance type prefixes to Graviton equivalents.
 */
export const INSTANCE_TYPE_MAPPINGS: Record<string, string> = {
  // General purpose
  'm5': 'm7g',
  'm5a': 'm7g',
  'm5n': 'm7g',
  'm5zn': 'm7g',
  'm6i': 'm7g',
  'm6a': 'm7g',
  // Compute optimized
  'c5': 'c7g',
  'c5a': 'c7g',
  'c5n': 'c7gn',
  'c6i': 'c7g',
  'c6a': 'c7g',
  // Memory optimized
  'r5': 'r7g',
  'r5a': 'r7g',
  'r5n': 'r7g',
  'r6i': 'r7g',
  'r6a': 'r7g',
  // Burstable
  't3': 't4g',
  't3a': 't4g',
  // Storage optimized
  'i3': 'im4gn',
  'i3en': 'im4gn',
  // Accelerated computing (no direct mapping, but note)
  'x1': 'x2gd',
  'x1e': 'x2gd',
  'x2idn': 'x2gd',
  // HPC
  'hpc6a': 'hpc7g',
};

/**
 * Common instance size suffixes.
 */
const INSTANCE_SIZES = [
  'nano', 'micro', 'small', 'medium', 'large',
  'xlarge', '2xlarge', '4xlarge', '8xlarge', '12xlarge',
  '16xlarge', '24xlarge', '32xlarge', '48xlarge', 'metal',
];

/**
 * Build a regex that matches EC2 instance types that can be converted to Graviton.
 */
function buildInstanceTypeRegex(): RegExp {
  const prefixes = Object.keys(INSTANCE_TYPE_MAPPINGS).sort((a, b) => b.length - a.length);
  const prefixPattern = prefixes.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const sizePattern = INSTANCE_SIZES.join('|');
  return new RegExp(`\\b(${prefixPattern})\\.(${sizePattern})\\b`, 'g');
}

const INSTANCE_TYPE_REGEX = buildInstanceTypeRegex();

/**
 * Infrastructure file patterns.
 */
const INFRA_FILE_PATTERNS = [
  '**/*.tf',
  '**/*.tfvars',
  '**/cloudformation/**/*.yaml',
  '**/cloudformation/**/*.yml',
  '**/cloudformation/**/*.json',
  '**/cdk/**/*.ts',
  '**/cdk/**/*.py',
  '**/cdk/**/*.java',
  // Also match top-level CloudFormation templates
  '**/*template*.yaml',
  '**/*template*.yml',
  '**/*template*.json',
  '**/*stack*.yaml',
  '**/*stack*.yml',
  '**/*stack*.json',
];

/**
 * Scans infrastructure-as-code files for non-Graviton instance types.
 */
export class InfraScanner {
  private scanPath: string;

  constructor(scanPath: string) {
    this.scanPath = scanPath;
  }

  async scan(): Promise<ConversionIssue[]> {
    const issues: ConversionIssue[] = [];

    const files = await glob(INFRA_FILE_PATTERNS, {
      cwd: this.scanPath,
      absolute: true,
      nodir: true,
      ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**'],
    });

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const relativePath = path.relative(this.scanPath, file);

        // Only process CloudFormation files that actually are CF templates
        if (this.isCloudFormationCandidate(file) && !this.isCloudFormationTemplate(content)) {
          continue;
        }

        const fileIssues = this.analyzeFile(relativePath, content);
        issues.push(...fileIssues);
      } catch {
        // Skip unreadable files
      }
    }

    return issues;
  }

  private isCloudFormationCandidate(filePath: string): boolean {
    return /\.(yaml|yml|json)$/i.test(filePath) && !/\.tf/.test(filePath);
  }

  private isCloudFormationTemplate(content: string): boolean {
    return content.includes('AWSTemplateFormatVersion') || content.includes('AWS::');
  }

  private analyzeFile(filePath: string, content: string): ConversionIssue[] {
    const issues: ConversionIssue[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Reset regex lastIndex since it's global
      INSTANCE_TYPE_REGEX.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = INSTANCE_TYPE_REGEX.exec(line)) !== null) {
        const instanceType = match[0];
        const prefix = match[1];
        const size = match[2];
        const gravitonEquivalent = this.getGravitonEquivalent(prefix, size);

        if (gravitonEquivalent) {
          // Avoid duplicates
          if (!issues.some(existing => existing.file === filePath && existing.line === i + 1 && existing.originalCode?.includes(instanceType))) {
            issues.push(this.createIssue(filePath, i + 1, line.trim(), instanceType, gravitonEquivalent));
          }
        }
      }
    }

    return issues;
  }

  private getGravitonEquivalent(prefix: string, size: string): string | null {
    const gravitonPrefix = INSTANCE_TYPE_MAPPINGS[prefix];
    if (!gravitonPrefix) return null;
    return `${gravitonPrefix}.${size}`;
  }

  private createIssue(
    file: string,
    line: number,
    originalLine: string,
    currentType: string,
    suggestedType: string,
  ): ConversionIssue {
    return {
      id: v4Generator(),
      file,
      line,
      category: 'infrastructure',
      severity: 'warning',
      status: 'unresolved',
      title: `Non-Graviton instance type: ${currentType}`,
      description: `Instance type ${currentType} is x86-based. Consider migrating to Graviton equivalent ${suggestedType} for up to 40% better price-performance.`,
      originalCode: originalLine,
      suggestedFix: originalLine.replace(currentType, suggestedType),
      autoResolvable: true,
      suggestions: [
        {
          id: 'switch-graviton',
          title: `Switch to ${suggestedType}`,
          description: `Replace ${currentType} with Graviton-based ${suggestedType}. Graviton instances offer up to 40% better price-performance for most workloads.`,
          code: suggestedType,
          confidence: 90,
          source: 'AWS Graviton Instance Mapping',
        },
        {
          id: 'multi-arch-deployment',
          title: 'Deploy both x86 and Graviton for gradual migration',
          description: 'Use a mixed instance policy to gradually shift traffic to Graviton instances.',
          code: `# Use both instance types in an ASG\n# x86: ${currentType}\n# Graviton: ${suggestedType}\n# Gradually increase Graviton weight`,
          confidence: 75,
          source: 'AWS Migration Best Practice',
        },
      ],
    };
  }
}

/**
 * Get the Graviton equivalent for a given instance type string.
 * Returns null if no mapping exists.
 */
export function mapToGraviton(instanceType: string): string | null {
  const match = instanceType.match(/^(\w+)\.(\w+)$/);
  if (!match) return null;

  const prefix = match[1];
  const size = match[2];
  const gravitonPrefix = INSTANCE_TYPE_MAPPINGS[prefix];

  if (!gravitonPrefix) return null;
  return `${gravitonPrefix}.${size}`;
}
