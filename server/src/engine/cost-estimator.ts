import { ConversionIssue, CostEstimate, InstanceMapping } from '../types';
import { INSTANCE_TYPE_MAPPINGS, mapToGraviton } from './infra-scanner';

/**
 * Approximate hourly pricing for common instance types (USD, us-east-1, Linux, On-Demand).
 * These are approximations for estimation purposes.
 */
const INSTANCE_PRICING: Record<string, number> = {
  // General purpose - x86
  'm5.nano': 0.0116,
  'm5.micro': 0.0116,
  'm5.small': 0.0230,
  'm5.medium': 0.0460,
  'm5.large': 0.0960,
  'm5.xlarge': 0.1920,
  'm5.2xlarge': 0.3840,
  'm5.4xlarge': 0.7680,
  'm5.8xlarge': 1.5360,
  'm5.12xlarge': 2.3040,
  'm5.16xlarge': 3.0720,
  'm5.24xlarge': 4.6080,
  'm6i.large': 0.0960,
  'm6i.xlarge': 0.1920,
  'm6i.2xlarge': 0.3840,
  'm6i.4xlarge': 0.7680,
  'm6i.8xlarge': 1.5360,
  // General purpose - Graviton
  'm7g.nano': 0.0081,
  'm7g.micro': 0.0081,
  'm7g.small': 0.0163,
  'm7g.medium': 0.0325,
  'm7g.large': 0.0816,
  'm7g.xlarge': 0.1632,
  'm7g.2xlarge': 0.3264,
  'm7g.4xlarge': 0.6528,
  'm7g.8xlarge': 1.3056,
  'm7g.12xlarge': 1.9584,
  'm7g.16xlarge': 2.6112,
  // Compute optimized - x86
  'c5.large': 0.0850,
  'c5.xlarge': 0.1700,
  'c5.2xlarge': 0.3400,
  'c5.4xlarge': 0.6800,
  'c5.9xlarge': 1.5300,
  'c5.12xlarge': 2.0400,
  'c5.18xlarge': 3.0600,
  'c6i.large': 0.0850,
  'c6i.xlarge': 0.1700,
  'c6i.2xlarge': 0.3400,
  'c6i.4xlarge': 0.6800,
  // Compute optimized - Graviton
  'c7g.large': 0.0725,
  'c7g.xlarge': 0.1450,
  'c7g.2xlarge': 0.2900,
  'c7g.4xlarge': 0.5800,
  'c7g.8xlarge': 1.1600,
  'c7g.12xlarge': 1.7400,
  'c7g.16xlarge': 2.3200,
  // Memory optimized - x86
  'r5.large': 0.1260,
  'r5.xlarge': 0.2520,
  'r5.2xlarge': 0.5040,
  'r5.4xlarge': 1.0080,
  'r5.8xlarge': 2.0160,
  'r5.12xlarge': 3.0240,
  'r6i.large': 0.1260,
  'r6i.xlarge': 0.2520,
  'r6i.2xlarge': 0.5040,
  // Memory optimized - Graviton
  'r7g.large': 0.1071,
  'r7g.xlarge': 0.2142,
  'r7g.2xlarge': 0.4284,
  'r7g.4xlarge': 0.8568,
  'r7g.8xlarge': 1.7136,
  'r7g.12xlarge': 2.5704,
  // Burstable - x86
  't3.nano': 0.0052,
  't3.micro': 0.0104,
  't3.small': 0.0208,
  't3.medium': 0.0416,
  't3.large': 0.0832,
  't3.xlarge': 0.1664,
  't3.2xlarge': 0.3328,
  // Burstable - Graviton
  't4g.nano': 0.0042,
  't4g.micro': 0.0084,
  't4g.small': 0.0168,
  't4g.medium': 0.0336,
  't4g.large': 0.0672,
  't4g.xlarge': 0.1344,
  't4g.2xlarge': 0.2688,
};

/**
 * Default savings ratio when exact pricing isn't available.
 * Graviton is typically 20-40% cheaper.
 */
const DEFAULT_SAVINGS_RATIO = 0.20;
const HOURS_PER_MONTH = 730;

/**
 * Estimates cost savings from migrating to Graviton instances.
 */
export class CostEstimator {
  /**
   * Estimate cost savings based on infrastructure issues found during scanning.
   */
  estimate(issues: ConversionIssue[]): CostEstimate {
    const infraIssues = issues.filter(i => i.category === 'infrastructure');
    const instanceMappings: InstanceMapping[] = [];

    for (const issue of infraIssues) {
      const mapping = this.extractMapping(issue);
      if (mapping) {
        // Avoid duplicate mappings for same instance type
        if (!instanceMappings.some(m => m.current === mapping.current)) {
          instanceMappings.push(mapping);
        }
      }
    }

    const currentMonthly = instanceMappings.reduce((sum, m) => sum + m.currentCost, 0);
    const projectedMonthly = instanceMappings.reduce((sum, m) => sum + m.suggestedCost, 0);
    const savings = currentMonthly - projectedMonthly;
    const savingsPercent = currentMonthly > 0 ? (savings / currentMonthly) * 100 : 0;

    return {
      currentMonthly: Math.round(currentMonthly * 100) / 100,
      projectedMonthly: Math.round(projectedMonthly * 100) / 100,
      savings: Math.round(savings * 100) / 100,
      savingsPercent: Math.round(savingsPercent * 10) / 10,
      instances: instanceMappings,
    };
  }

  private extractMapping(issue: ConversionIssue): InstanceMapping | null {
    // Extract instance type from the issue title
    const titleMatch = issue.title.match(/Non-Graviton instance type:\s*(\S+)/);
    if (!titleMatch) return null;

    const currentType = titleMatch[1];
    const suggestedType = mapToGraviton(currentType);
    if (!suggestedType) return null;

    const currentCost = this.getMonthlyCost(currentType);
    const suggestedCost = this.getMonthlyCost(suggestedType);

    return {
      current: currentType,
      suggested: suggestedType,
      currentCost: Math.round(currentCost * 100) / 100,
      suggestedCost: Math.round(suggestedCost * 100) / 100,
    };
  }

  private getMonthlyCost(instanceType: string): number {
    const hourlyRate = INSTANCE_PRICING[instanceType];

    if (hourlyRate) {
      return hourlyRate * HOURS_PER_MONTH;
    }

    // Estimate from known pricing of same family
    const match = instanceType.match(/^(\w+)\.(\w+)$/);
    if (!match) return 0;

    const prefix = match[1];
    const size = match[2];

    // Try to find a known price for same prefix, different size, and extrapolate
    const knownKey = Object.keys(INSTANCE_PRICING).find(k => k.startsWith(`${prefix}.`));
    if (knownKey) {
      const knownRate = INSTANCE_PRICING[knownKey];
      const knownSize = knownKey.split('.')[1];
      const sizeMultiplier = this.getSizeMultiplier(size) / this.getSizeMultiplier(knownSize);
      return knownRate * sizeMultiplier * HOURS_PER_MONTH;
    }

    // If it's a Graviton type, estimate from x86 equivalent
    const gravitonPrefixes = Object.values(INSTANCE_TYPE_MAPPINGS);
    if (gravitonPrefixes.includes(prefix)) {
      // Find the x86 equivalent
      const x86Prefix = Object.entries(INSTANCE_TYPE_MAPPINGS).find(([_, v]) => v === prefix)?.[0];
      if (x86Prefix) {
        const x86Type = `${x86Prefix}.${size}`;
        const x86Cost = this.getMonthlyCost(x86Type);
        return x86Cost * (1 - DEFAULT_SAVINGS_RATIO);
      }
    }

    return 0;
  }

  private getSizeMultiplier(size: string): number {
    const multipliers: Record<string, number> = {
      'nano': 0.25,
      'micro': 0.5,
      'small': 1,
      'medium': 2,
      'large': 4,
      'xlarge': 8,
      '2xlarge': 16,
      '4xlarge': 32,
      '8xlarge': 64,
      '9xlarge': 72,
      '12xlarge': 96,
      '16xlarge': 128,
      '18xlarge': 144,
      '24xlarge': 192,
      '32xlarge': 256,
      '48xlarge': 384,
      'metal': 384,
    };
    return multipliers[size] || 1;
  }
}
