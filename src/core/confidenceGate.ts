/**
 * Confidence Gate
 *
 * Filters signals based on confidence level to reduce noise and false positives.
 * Only high-confidence + high-impact signals can cause FAIL in default mode.
 *
 * Rules:
 * - confidence === 'high' && class !== 'maintainability' → Can block merge, appears in TOP N
 * - confidence === 'medium' → Advisory only, appears in --details
 * - confidence === 'low' → Filtered out in default mode
 */

import { Signal, Confidence } from '../signals/types';
import { SignalClass } from './signalClasses';

/**
 * Impact level type (maps to SignalClass for now)
 */
export type ImpactLevel = 'high' | 'medium' | 'low';

/**
 * Gated signals result
 */
export interface GatedSignals {
  /** High-confidence + high-impact signals that can block merge */
  blocking: Signal[];
  /** Medium-confidence signals (advisory) */
  advisory: Signal[];
  /** Low-confidence signals (filtered in default mode) */
  filtered: Signal[];
  /** All signals with normalized confidence (for --details mode) */
  all: Signal[];
  /** Statistics */
  stats: GateStats;
}

/**
 * Gate statistics
 */
export interface GateStats {
  total: number;
  blocking: number;
  advisory: number;
  filtered: number;
  blockingRatio: number;
}

/**
 * Confidence gate configuration
 */
export interface ConfidenceGateConfig {
  /** Minimum confidence to be considered blocking (default: 'high') */
  blockingThreshold: Confidence;
  /** Minimum impact (signal class) to be considered blocking (default: 'high' = critical/behavioral) */
  minBlockingImpact: ImpactLevel;
  /** Minimum confidence to be shown in default output (default: 'medium') */
  displayThreshold: Confidence;
  /** Whether to include low-confidence signals in --details (default: true) */
  showLowInDetails: boolean;
}

/**
 * Default gate configuration
 */
export const DEFAULT_GATE_CONFIG: ConfidenceGateConfig = {
  blockingThreshold: 'high',
  minBlockingImpact: 'high',
  displayThreshold: 'medium',
  showLowInDetails: true,
};

/**
 * Confidence level order (for comparison)
 */
const CONFIDENCE_ORDER: Record<Confidence, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * Check if a confidence level meets or exceeds threshold
 */
export function meetsThreshold(confidence: Confidence, threshold: Confidence): boolean {
  return CONFIDENCE_ORDER[confidence] >= CONFIDENCE_ORDER[threshold];
}

/**
 * Impact order based on signal class
 */
const IMPACT_ORDER: Record<SignalClass, number> = {
  critical: 3,
  behavioral: 2,
  maintainability: 1,
};

/**
 * Check if signal class meets impact threshold
 */
export function meetsImpactThreshold(
  signalClass: SignalClass | undefined,
  threshold: ImpactLevel,
): boolean {
  if (!signalClass) return false;

  const thresholdOrder = threshold === 'high' ? 2 : threshold === 'medium' ? 1 : 0;
  return IMPACT_ORDER[signalClass] >= thresholdOrder;
}

/**
 * Apply confidence gate to signals
 *
 * Separates signals into blocking, advisory, and filtered categories.
 * IMPORTANT: Blocking requires BOTH high confidence AND high impact (critical/behavioral class).
 */
export function applyConfidenceGate(
  signals: Signal[],
  config: ConfidenceGateConfig = DEFAULT_GATE_CONFIG,
): GatedSignals {
  const blocking: Signal[] = [];
  const advisory: Signal[] = [];
  const filtered: Signal[] = [];

  const normalizedSignals = signals.map((signal) => {
    if (signal.confidence) return signal;
    return { ...signal, confidence: 'low' as Confidence };
  });

  for (const signal of normalizedSignals) {
    const confidence = signal.confidence!;

    const meetsConfidence = meetsThreshold(confidence, config.blockingThreshold);
    const meetsImpact = meetsImpactThreshold(signal.class, config.minBlockingImpact);

    if (meetsConfidence && meetsImpact) {
      blocking.push(signal);
    } else if (meetsThreshold(confidence, config.displayThreshold)) {
      advisory.push(signal);
    } else {
      filtered.push(signal);
    }
  }

  const total = normalizedSignals.length;

  return {
    blocking,
    advisory,
    filtered,
    all: normalizedSignals,
    stats: {
      total,
      blocking: blocking.length,
      advisory: advisory.length,
      filtered: filtered.length,
      blockingRatio: total > 0 ? blocking.length / total : 0,
    },
  };
}

/**
 * Get signals for default display (blocking + advisory)
 */
export function getDisplaySignals(gated: GatedSignals): Signal[] {
  return [...gated.blocking, ...gated.advisory];
}

/**
 * Get signals for detailed display (all signals)
 */
export function getDetailedSignals(
  gated: GatedSignals,
  config: ConfidenceGateConfig = DEFAULT_GATE_CONFIG,
): Signal[] {
  if (config.showLowInDetails) {
    return gated.all;
  }
  return [...gated.blocking, ...gated.advisory];
}

/**
 * Check if any blocking signals exist
 */
export function hasBlockingSignals(gated: GatedSignals): boolean {
  return gated.blocking.length > 0;
}

/**
 * Format gate statistics for output
 */
export function formatGateStats(stats: GateStats): string {
  if (stats.total === 0) {
    return 'No signals detected';
  }

  const parts: string[] = [];

  if (stats.blocking > 0) {
    parts.push(`${stats.blocking} high-impact`);
  }
  if (stats.advisory > 0) {
    parts.push(`${stats.advisory} advisory`);
  }
  if (stats.filtered > 0) {
    parts.push(`${stats.filtered} filtered`);
  }

  return parts.join(', ') + ` (${stats.total} total)`;
}

/**
 * Assign default confidence to signals that don't have one
 *
 * Uses heuristics based on signal class and category.
 * Default is 'low' (trust-first approach) - signals must earn higher confidence.
 */
export function assignDefaultConfidence(signal: Signal): Signal {
  if (signal.confidence) {
    return signal;
  }

  let confidence: Confidence = 'low';

  if (signal.class === 'critical') {
    confidence = 'high';
  }

  const securityKeywords = [
    'auth',
    'security',
    'password',
    'token',
    'secret',
    'permission',
    'credential',
    'sec-',
  ];
  if (securityKeywords.some((kw) => signal.id.toLowerCase().includes(kw))) {
    confidence = 'high';
  }

  if (signal.evidence?.kind === 'ast') {
    confidence = 'high';
  }

  if (signal.class === 'behavioral' && confidence === 'low') {
    confidence = 'medium';
  }

  return {
    ...signal,
    confidence,
  };
}

/**
 * Assign default confidence to all signals in array
 */
export function assignDefaultConfidenceAll(signals: Signal[]): Signal[] {
  return signals.map(assignDefaultConfidence);
}
