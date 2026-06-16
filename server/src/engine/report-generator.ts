import { ConversionIssue, CostEstimate, MigrationReport, ScanResult } from '../types';
import { v4Generator } from '../utils/id';
import { CostEstimator } from './cost-estimator';

/**
 * Generates structured migration reports in JSON and Markdown format.
 */
export class ReportGenerator {
  private costEstimator: CostEstimator;

  constructor() {
    this.costEstimator = new CostEstimator();
  }

  /**
   * Generate a full migration report for a scan result.
   */
  generateReport(scanResult: ScanResult): MigrationReport {
    const estimatedSavings = this.costEstimator.estimate(scanResult.issues);
    const recommendations = this.generateRecommendations(scanResult.issues, estimatedSavings);

    return {
      id: v4Generator(),
      scanId: scanResult.id,
      generatedAt: new Date().toISOString(),
      summary: scanResult.summary,
      issues: scanResult.issues,
      recommendations,
      estimatedSavings,
    };
  }

  /**
   * Generate a markdown-formatted report.
   */
  generateMarkdown(scanResult: ScanResult): string {
    const report = this.generateReport(scanResult);
    const lines: string[] = [];

    lines.push('# Graviton Migration Report');
    lines.push('');
    lines.push(`**Generated:** ${report.generatedAt}`);
    lines.push(`**Scan ID:** ${report.scanId}`);
    lines.push(`**Source:** ${scanResult.source.type} - ${scanResult.source.path}`);
    lines.push('');

    // Summary
    lines.push('## Summary');
    lines.push('');
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Total Files Scanned | ${report.summary.scannedFiles} / ${report.summary.totalFiles} |`);
    lines.push(`| Total Issues | ${report.summary.totalIssues} |`);
    lines.push(`| Critical | ${report.summary.critical} |`);
    lines.push(`| Warnings | ${report.summary.warnings} |`);
    lines.push(`| Info | ${report.summary.info} |`);
    lines.push(`| Auto-Resolvable | ${report.summary.autoResolvable} |`);
    lines.push(`| Resolved | ${report.summary.resolved} |`);
    lines.push('');

    // Cost Estimate
    if (report.estimatedSavings && report.estimatedSavings.instances.length > 0) {
      lines.push('## Cost Estimate');
      lines.push('');
      lines.push(`| Metric | Value |`);
      lines.push(`|--------|-------|`);
      lines.push(`| Current Monthly Cost | $${report.estimatedSavings.currentMonthly.toFixed(2)} |`);
      lines.push(`| Projected Monthly Cost | $${report.estimatedSavings.projectedMonthly.toFixed(2)} |`);
      lines.push(`| Monthly Savings | $${report.estimatedSavings.savings.toFixed(2)} |`);
      lines.push(`| Savings Percentage | ${report.estimatedSavings.savingsPercent.toFixed(1)}% |`);
      lines.push('');

      lines.push('### Instance Mappings');
      lines.push('');
      lines.push('| Current | Suggested | Current Cost/mo | Suggested Cost/mo |');
      lines.push('|---------|-----------|-----------------|-------------------|');
      for (const mapping of report.estimatedSavings.instances) {
        lines.push(`| ${mapping.current} | ${mapping.suggested} | $${mapping.currentCost.toFixed(2)} | $${mapping.suggestedCost.toFixed(2)} |`);
      }
      lines.push('');
    }

    // Issues by Category
    lines.push('## Issues by Category');
    lines.push('');

    const categories = this.groupByCategory(report.issues);
    for (const [category, issues] of Object.entries(categories)) {
      lines.push(`### ${this.formatCategory(category)} (${issues.length})`);
      lines.push('');

      for (const issue of issues) {
        const statusIcon = issue.status === 'unresolved' ? '⚠️' :
                          issue.status === 'auto-resolved' ? '✅' :
                          issue.status === 'manually-resolved' ? '✅' : '🔇';
        lines.push(`${statusIcon} **${issue.title}**`);
        lines.push(`  - File: \`${issue.file}\`${issue.line ? ` (line ${issue.line})` : ''}`);
        lines.push(`  - Severity: ${issue.severity}`);
        lines.push(`  - Status: ${issue.status}`);
        if (issue.originalCode) {
          lines.push(`  - Code: \`${issue.originalCode}\``);
        }
        if (issue.suggestedFix) {
          lines.push(`  - Fix: \`${issue.suggestedFix}\``);
        }
        lines.push('');
      }
    }

    // Recommendations
    lines.push('## Recommendations');
    lines.push('');
    for (let i = 0; i < report.recommendations.length; i++) {
      lines.push(`${i + 1}. ${report.recommendations[i]}`);
    }
    lines.push('');

    // Migration Steps
    lines.push('## Suggested Migration Steps');
    lines.push('');
    lines.push('1. **Resolve critical issues first** - Address assembly, intrinsics, and binary dependencies');
    lines.push('2. **Update build systems** - Fix compiler flags and Docker configurations');
    lines.push('3. **Test on Graviton** - Deploy to a Graviton instance and run your test suite');
    lines.push('4. **Update CI/CD** - Add ARM64 testing to your pipeline');
    lines.push('5. **Switch infrastructure** - Migrate instance types to Graviton equivalents');
    lines.push('6. **Monitor performance** - Compare metrics between x86 and Graviton');
    lines.push('');

    lines.push('---');
    lines.push('*Generated by Graviton Converter 2.0*');

    return lines.join('\n');
  }

  private generateRecommendations(issues: ConversionIssue[], costEstimate: CostEstimate): string[] {
    const recommendations: string[] = [];

    const critical = issues.filter(i => i.severity === 'critical' && i.status === 'unresolved');
    const warnings = issues.filter(i => i.severity === 'warning' && i.status === 'unresolved');
    const autoResolvable = issues.filter(i => i.autoResolvable && i.status === 'unresolved');

    if (critical.length > 0) {
      recommendations.push(
        `Address ${critical.length} critical issue(s) that will prevent execution on Graviton (assembly, intrinsics, x86 binaries).`
      );
    }

    if (autoResolvable.length > 0) {
      recommendations.push(
        `Run auto-resolve to fix ${autoResolvable.length} issue(s) automatically (compiler flags, Docker images, instance types).`
      );
    }

    const binaryIssues = issues.filter(i => i.category === 'binary-file');
    if (binaryIssues.length > 0) {
      recommendations.push(
        `Recompile ${binaryIssues.length} binary file(s) for ARM64 or replace with multi-arch versions.`
      );
    }

    const cicdIssues = issues.filter(i => i.category === 'cicd-pipeline');
    if (cicdIssues.length > 0) {
      recommendations.push(
        `Update ${cicdIssues.length} CI/CD configuration(s) to include ARM64 testing.`
      );
    }

    if (costEstimate.savings > 0) {
      recommendations.push(
        `Estimated monthly savings of $${costEstimate.savings.toFixed(2)} (${costEstimate.savingsPercent.toFixed(1)}%) by switching to Graviton instances.`
      );
    }

    if (warnings.length > 0) {
      recommendations.push(
        `Review ${warnings.length} warning(s) for potential compatibility issues.`
      );
    }

    const libIssues = issues.filter(i => i.category === 'library-compatibility');
    if (libIssues.length > 0) {
      recommendations.push(
        `Verify ARM64 compatibility for ${libIssues.length} dependency package(s). Most popular packages now support ARM64.`
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('No significant migration issues found. The project appears Graviton-ready!');
    }

    return recommendations;
  }

  private groupByCategory(issues: ConversionIssue[]): Record<string, ConversionIssue[]> {
    const groups: Record<string, ConversionIssue[]> = {};
    for (const issue of issues) {
      if (!groups[issue.category]) {
        groups[issue.category] = [];
      }
      groups[issue.category].push(issue);
    }
    return groups;
  }

  private formatCategory(category: string): string {
    return category
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
