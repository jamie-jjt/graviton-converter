import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { ConversionIssue } from '../types';
import { v4Generator } from '../utils/id';
import { lookupPackage, CompatEntry, CompatStatus } from './compatibility-db';

/**
 * Analyzes project dependencies for ARM64/Graviton compatibility.
 * Supports package.json (npm), requirements.txt, and Pipfile.
 */
export class DependencyAnalyzer {
  private scanPath: string;

  constructor(scanPath: string) {
    this.scanPath = scanPath;
  }

  async analyze(): Promise<ConversionIssue[]> {
    const issues: ConversionIssue[] = [];

    // Find dependency files
    const depFiles = await glob([
      '**/package.json',
      '**/requirements.txt',
      '**/requirements*.txt',
      '**/Pipfile',
    ], {
      cwd: this.scanPath,
      absolute: true,
      nodir: true,
      ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**'],
    });

    for (const file of depFiles) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const relativePath = path.relative(this.scanPath, file);
        const fileName = path.basename(file);

        if (fileName === 'package.json') {
          issues.push(...this.analyzePackageJson(relativePath, content));
        } else if (fileName.startsWith('requirements') && fileName.endsWith('.txt')) {
          issues.push(...this.analyzeRequirementsTxt(relativePath, content));
        } else if (fileName === 'Pipfile') {
          issues.push(...this.analyzePipfile(relativePath, content));
        }
      } catch {
        // Skip unreadable files
      }
    }

    return issues;
  }

  private analyzePackageJson(filePath: string, content: string): ConversionIssue[] {
    const issues: ConversionIssue[] = [];

    try {
      const pkg = JSON.parse(content);
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };

      for (const [name, version] of Object.entries(allDeps)) {
        const entry = lookupPackage(name, 'npm');
        if (entry) {
          const issue = this.createDependencyIssue(filePath, name, version as string, entry, 'npm');
          if (issue) {
            issues.push(issue);
          }
        }
      }
    } catch {
      // Invalid JSON, skip
    }

    return issues;
  }

  private analyzeRequirementsTxt(filePath: string, content: string): ConversionIssue[] {
    const issues: ConversionIssue[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#') || line.startsWith('-')) continue;

      // Parse package name and version from requirements format
      const match = line.match(/^([a-zA-Z0-9_-]+)\s*([>=<~!]+\s*[\d.]+)?/);
      if (match) {
        const name = match[1].toLowerCase();
        const version = match[2] || '';
        const entry = lookupPackage(name, 'python');
        if (entry) {
          const issue = this.createDependencyIssue(filePath, name, version.trim(), entry, 'python', i + 1);
          if (issue) {
            issues.push(issue);
          }
        }
      }
    }

    return issues;
  }

  private analyzePipfile(filePath: string, content: string): ConversionIssue[] {
    const issues: ConversionIssue[] = [];
    const lines = content.split('\n');
    let inPackagesSection = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line === '[packages]' || line === '[dev-packages]') {
        inPackagesSection = true;
        continue;
      }
      if (line.startsWith('[') && line.endsWith(']')) {
        inPackagesSection = false;
        continue;
      }

      if (inPackagesSection && line.includes('=')) {
        const match = line.match(/^([a-zA-Z0-9_-]+)\s*=/);
        if (match) {
          const name = match[1].toLowerCase();
          const entry = lookupPackage(name, 'python');
          if (entry) {
            const issue = this.createDependencyIssue(filePath, name, '', entry, 'python', i + 1);
            if (issue) {
              issues.push(issue);
            }
          }
        }
      }
    }

    return issues;
  }

  private createDependencyIssue(
    file: string,
    packageName: string,
    version: string,
    entry: CompatEntry,
    ecosystem: 'npm' | 'python',
    line?: number,
  ): ConversionIssue | null {
    // Don't create issues for packages with full support (unless very old version)
    if (entry.arm64Support === 'full' && !entry.minVersion) {
      return null;
    }

    // If it has full support and we can't check version, just note it
    if (entry.arm64Support === 'full' && entry.minVersion) {
      // We'd need semver to compare, but we'll create an info-level issue
      return {
        id: v4Generator(),
        file,
        line,
        category: 'library-compatibility',
        severity: 'info',
        status: 'unresolved',
        title: `${packageName}: ARM64 support requires v${entry.minVersion}+`,
        description: `${entry.notes} Ensure you're using version ${entry.minVersion} or later for ARM64/Graviton compatibility.`,
        originalCode: version ? `${packageName}${version}` : packageName,
        autoResolvable: false,
        suggestions: this.getDepSuggestions(packageName, entry, ecosystem),
      };
    }

    const severity = entry.arm64Support === 'none' ? 'critical' :
                     entry.arm64Support === 'partial' ? 'warning' : 'info';

    return {
      id: v4Generator(),
      file,
      line,
      category: 'library-compatibility',
      severity,
      status: 'unresolved',
      title: `${packageName}: ${this.formatStatus(entry.arm64Support)} ARM64 support`,
      description: entry.notes,
      originalCode: version ? `${packageName}${version}` : packageName,
      autoResolvable: false,
      suggestions: this.getDepSuggestions(packageName, entry, ecosystem),
    };
  }

  private formatStatus(status: CompatStatus): string {
    switch (status) {
      case 'full': return 'Full';
      case 'partial': return 'Partial';
      case 'none': return 'No';
      case 'unknown': return 'Unknown';
    }
  }

  private getDepSuggestions(
    packageName: string,
    entry: CompatEntry,
    ecosystem: 'npm' | 'python',
  ): ConversionIssue['suggestions'] {
    const suggestions: ConversionIssue['suggestions'] = [];

    if (entry.arm64Support === 'none') {
      suggestions.push({
        id: `${packageName}-alternative`,
        title: `Find ARM64-compatible alternative for ${packageName}`,
        description: entry.notes,
        confidence: 60,
        source: 'Compatibility Database',
      });
    }

    if (entry.minVersion) {
      const cmd = ecosystem === 'npm'
        ? `npm install ${packageName}@latest`
        : `pip install --upgrade ${packageName}>=${entry.minVersion}`;

      suggestions.push({
        id: `${packageName}-upgrade`,
        title: `Upgrade to v${entry.minVersion}+ for ARM64 support`,
        description: `ARM64/Graviton support was added in version ${entry.minVersion}.`,
        code: cmd,
        confidence: 85,
        source: 'Compatibility Database',
      });
    }

    if (entry.arm64Support === 'partial') {
      suggestions.push({
        id: `${packageName}-build-from-source`,
        title: 'Build from source on ARM64',
        description: 'Pre-built binaries may not be available but the package can be compiled from source.',
        code: ecosystem === 'npm'
          ? `npm rebuild ${packageName}`
          : `pip install --no-binary=${packageName} ${packageName}`,
        confidence: 70,
        source: 'Compatibility Database',
      });
    }

    return suggestions;
  }
}
