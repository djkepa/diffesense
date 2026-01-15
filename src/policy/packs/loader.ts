/**
 * Policy Pack Loader
 *
 * Applies policy pack settings to analysis configuration
 */

import { DiffeSenseConfig } from '../../config/schema';
import {
  PolicyPack,
  PolicyPackName,
  getPolicyPack,
  isValidPolicyPack,
  DEFAULT_POLICY_PACK,
  SeverityCounts,
  CategoryWeights,
} from './index';

export interface AppliedPolicyPack {
  pack: PolicyPack;
  effectiveConfig: EffectiveConfig;
}

export interface EffectiveConfig {
  failThreshold: number;
  minBlockers: number;
  severityCounts: SeverityCounts;
  topN: number;
  details: boolean;
  weights: CategoryWeights;
}

/**
 * Apply policy pack to configuration
 * Returns the effective settings after merging pack defaults with user config
 */
export function applyPolicyPack(
  packName: PolicyPackName | undefined,
  config?: Partial<DiffeSenseConfig>,
): AppliedPolicyPack {
  const resolvedPackName = packName && isValidPolicyPack(packName) ? packName : DEFAULT_POLICY_PACK;
  const pack = getPolicyPack(resolvedPackName);

  const effectiveConfig: EffectiveConfig = {
    failThreshold:
      config?.failOn?.minHighestRisk ?? config?.thresholds?.fail ?? pack.failOn.minHighestRisk,

    minBlockers: config?.failOn?.minBlockers ?? pack.failOn.minBlockers,

    severityCounts: {
      ...pack.failOn.severityCounts,
      ...config?.failOn?.severityCounts,
    },

    topN: config?.output?.topN ?? config?.topN ?? pack.defaults.topN,
    details: config?.output?.details ?? pack.defaults.details,

    weights: { ...pack.weights },
  };

  return { pack, effectiveConfig };
}

/**
 * Check if analysis should fail based on policy pack rules
 */
export function shouldFailAnalysis(
  effectiveConfig: EffectiveConfig,
  analysisResult: {
    highestRisk: number;
    blockerCount: number;
    severityCounts: { CRITICAL: number; HIGH: number; MED: number; LOW: number };
  },
): { shouldFail: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (analysisResult.highestRisk >= effectiveConfig.failThreshold) {
    reasons.push(
      `Highest risk ${analysisResult.highestRisk.toFixed(1)} >= threshold ${
        effectiveConfig.failThreshold
      }`,
    );
  }

  if (analysisResult.blockerCount >= effectiveConfig.minBlockers) {
    reasons.push(
      `Blockers ${analysisResult.blockerCount} >= minimum ${effectiveConfig.minBlockers}`,
    );
  }

  const { severityCounts } = effectiveConfig;

  if (
    severityCounts.CRITICAL !== undefined &&
    analysisResult.severityCounts.CRITICAL >= severityCounts.CRITICAL
  ) {
    reasons.push(
      `CRITICAL count ${analysisResult.severityCounts.CRITICAL} >= limit ${severityCounts.CRITICAL}`,
    );
  }

  if (
    severityCounts.HIGH !== undefined &&
    analysisResult.severityCounts.HIGH >= severityCounts.HIGH
  ) {
    reasons.push(
      `HIGH count ${analysisResult.severityCounts.HIGH} >= limit ${severityCounts.HIGH}`,
    );
  }

  if (severityCounts.MED !== undefined && analysisResult.severityCounts.MED >= severityCounts.MED) {
    reasons.push(`MED count ${analysisResult.severityCounts.MED} >= limit ${severityCounts.MED}`);
  }

  return {
    shouldFail: reasons.length > 0,
    reasons,
  };
}

/**
 * Apply category weights to a risk score
 */
export function applyWeights(
  baseScore: number,
  category: keyof CategoryWeights,
  weights: CategoryWeights,
): number {
  const weight = weights[category] ?? 1.0;
  return baseScore * weight;
}

/**
 * Get weight for a signal category
 */
export function getSignalCategoryWeight(signalId: string, weights: CategoryWeights): number {
  if (signalId.startsWith('sec-') || signalId.includes('security') || signalId.includes('xss')) {
    return weights.security;
  }
  if (
    signalId.startsWith('ssr-') ||
    signalId.includes('hydration') ||
    signalId.includes('boundary')
  ) {
    return weights.ssrBoundary;
  }
  if (signalId.includes('api') || signalId.includes('contract') || signalId.includes('export')) {
    return weights.apiContract;
  }
  if (
    signalId.startsWith('cor-') ||
    signalId.includes('correctness') ||
    signalId.includes('error')
  ) {
    return weights.correctness;
  }
  if (signalId.includes('perf') || signalId.includes('memo') || signalId.includes('render')) {
    return weights.performance;
  }
  if (
    signalId.startsWith('maint-') ||
    signalId.includes('complexity') ||
    signalId.includes('todo')
  ) {
    return weights.maintainability;
  }
  if (signalId.includes('npm') || signalId.includes('dependency') || signalId.includes('supply')) {
    return weights.supplyChain;
  }

  return 1.0;
}

/**
 * Format policy pack for display
 */
export function formatPolicyPackInfo(pack: PolicyPack): string {
  const lines = [
    `Policy Pack: ${pack.name}`,
    `  ${pack.description}`,
    '',
    '  Fail conditions:',
    `    - Highest risk >= ${pack.failOn.minHighestRisk}`,
    `    - Blockers >= ${pack.failOn.minBlockers}`,
  ];

  if (pack.failOn.severityCounts.CRITICAL) {
    lines.push(`    - CRITICAL files >= ${pack.failOn.severityCounts.CRITICAL}`);
  }
  if (pack.failOn.severityCounts.HIGH) {
    lines.push(`    - HIGH files >= ${pack.failOn.severityCounts.HIGH}`);
  }

  lines.push('');
  lines.push('  Category weights:');
  for (const [cat, weight] of Object.entries(pack.weights)) {
    const indicator = weight > 1 ? '↑' : weight < 1 ? '↓' : '→';
    lines.push(`    ${indicator} ${cat}: ${weight.toFixed(1)}`);
  }

  return lines.join('\n');
}
