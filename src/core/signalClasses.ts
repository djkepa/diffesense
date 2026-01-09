import { Signal, SignalClass } from '../signals/types';

export type { SignalClass } from '../signals/types';

export interface SignalClassConfig {
  maxContribution: number;
  maxSeverity: 'blocker' | 'warning' | 'info';
  weightMultiplier: number;
}

export const SIGNAL_CLASS_CONFIG: Record<SignalClass, SignalClassConfig> = {
  critical: {
    maxContribution: 5.0,
    maxSeverity: 'blocker',
    weightMultiplier: 1.5,
  },
  behavioral: {
    maxContribution: 3.0,
    maxSeverity: 'warning',
    weightMultiplier: 1.0,
  },
  maintainability: {
    maxContribution: 1.0,
    maxSeverity: 'info',
    weightMultiplier: 0.5,
  },
};

export const SIGNAL_ID_CLASS: Record<string, SignalClass> = {
  'auth-boundary': 'critical',
  'auth-check': 'critical',
  'permission-check': 'critical',
  'security-sensitive': 'critical',
  'payment-logic': 'critical',
  'data-migration': 'critical',
  encryption: 'critical',
  'token-handling': 'critical',
  'session-management': 'critical',
  'password-handling': 'critical',
  'api-key': 'critical',
  'secret-handling': 'critical',
  'react-dangerous-html': 'critical',
  'node-eval': 'critical',

  'conditional-logic': 'behavioral',
  'error-handling': 'behavioral',
  'async-await': 'behavioral',
  'promise-pattern': 'behavioral',
  'event-handler': 'behavioral',
  'network-fetch': 'behavioral',
  'network-axios': 'behavioral',
  'network-websocket': 'behavioral',
  'storage-local': 'behavioral',
  'storage-session': 'behavioral',
  'storage-indexeddb': 'behavioral',
  'database-query': 'behavioral',
  'database-orm': 'behavioral',
  'timer-timeout': 'behavioral',
  'timer-interval': 'behavioral',
  'process-exit': 'behavioral',
  'process-child': 'behavioral',
  'fs-operation': 'behavioral',
  'fs-sync': 'behavioral',
  'dom-manipulation': 'behavioral',
  'dom-innerhtml': 'behavioral',
  'global-window': 'behavioral',
  'global-mutation': 'behavioral',
  'export-change': 'behavioral',
  'type-export-change': 'behavioral',
  'react-effect-no-deps': 'behavioral',
  'react-callback-no-deps': 'behavioral',
  'react-memo-no-deps': 'behavioral',
  'react-direct-dom': 'behavioral',
  'react-context': 'behavioral',
  'react-suspense': 'behavioral',
  'react-portal': 'behavioral',
  'react-forward-ref': 'behavioral',
  'react-custom-hooks': 'behavioral',
  'vue-watch-no-cleanup': 'behavioral',
  'vue-computed-side-effect': 'behavioral',
  'vue-async-mounted': 'behavioral',
  'vue-define-props': 'behavioral',
  'vue-provide-inject': 'behavioral',
  'vue-deep-watch': 'behavioral',
  'vue-props-mutation': 'behavioral',
  'vue-force-update': 'behavioral',
  'vue-next-tick': 'behavioral',
  'vue-refs-access': 'behavioral',
  'vue-composables': 'behavioral',
  'angular-subscription-leak': 'behavioral',
  'angular-nested-subscribe': 'behavioral',
  'angular-http-no-error': 'behavioral',
  'angular-dom-access': 'behavioral',
  'angular-io-decorator': 'behavioral',
  'angular-viewchild': 'behavioral',
  'angular-host-decorator': 'behavioral',
  'angular-service-state': 'behavioral',
  'angular-http-call': 'behavioral',
  'angular-public-subject': 'behavioral',
  'angular-tap-side-effect': 'behavioral',
  'angular-share-replay': 'behavioral',
  'node-sync-op': 'behavioral',
  'node-stream': 'behavioral',
  'node-worker': 'behavioral',
  'node-cluster': 'behavioral',
  'node-route': 'behavioral',
  'node-middleware': 'behavioral',
  'node-auth-middleware': 'critical',
  'node-database-query': 'behavioral',
  'node-orm': 'behavioral',
  'node-cache': 'behavioral',
  'node-queue': 'behavioral',

  'blast-radius-high': 'behavioral',
  'blast-radius-critical': 'critical',

  'large-file': 'maintainability',
  'deep-nesting': 'maintainability',
  'long-function': 'maintainability',
  'high-params': 'maintainability',
  'logging-console': 'maintainability',
  'react-complex-state': 'maintainability',
  'react-complex-deps': 'maintainability',
  'react-inline-styles': 'maintainability',
  'react-inline-handlers': 'maintainability',
  'vue-many-refs': 'maintainability',
  'vue-vfor-vif': 'maintainability',
  'vue-inline-handler': 'maintainability',
  'angular-no-onpush': 'maintainability',
  'node-env-heavy': 'maintainability',
};

/**
 * Get signal class for a signal
 * Uses signal's class field if present, otherwise looks up by ID
 */
export function getSignalClass(signal: Signal | string): SignalClass {
  if (typeof signal === 'string') {
    return SIGNAL_ID_CLASS[signal] || 'maintainability';
  }

  if (signal.class) {
    return signal.class;
  }

  return SIGNAL_ID_CLASS[signal.id] || 'maintainability';
}

/**
 * Get class config for a signal
 */
export function getSignalClassConfig(signal: Signal | string): SignalClassConfig {
  const signalClass = getSignalClass(signal);
  return SIGNAL_CLASS_CONFIG[signalClass];
}

/**
 * Classified signals structure
 */
export interface ClassifiedSignals {
  critical: Signal[];
  behavioral: Signal[];
  maintainability: Signal[];
  byClass: Map<SignalClass, Signal[]>;
}

/**
 * Classify signals and apply class-based weight adjustments
 */
export function classifySignals(signals: Signal[]): ClassifiedSignals {
  const classified: ClassifiedSignals = {
    critical: [],
    behavioral: [],
    maintainability: [],
    byClass: new Map(),
  };

  for (const signal of signals) {
    const signalClass = getSignalClass(signal);
    const config = SIGNAL_CLASS_CONFIG[signalClass];

    const adjustedSignal: Signal = {
      ...signal,
      weight: signal.weight * config.weightMultiplier,
      meta: {
        ...signal.meta,
        signalClass,
        originalWeight: signal.weight,
      },
    };

    classified[signalClass].push(adjustedSignal);

    if (!classified.byClass.has(signalClass)) {
      classified.byClass.set(signalClass, []);
    }
    classified.byClass.get(signalClass)!.push(adjustedSignal);
  }

  return classified;
}

export interface RiskScoreBreakdown {
  critical: number;
  behavioral: number;
  maintainability: number;
  total: number;
  maxSeverity: 'blocker' | 'warning' | 'info';
  confidence: number;
}

export function calculateClassBasedRiskScore(classified: ClassifiedSignals): RiskScoreBreakdown {
  const breakdown: RiskScoreBreakdown = {
    critical: 0,
    behavioral: 0,
    maintainability: 0,
    total: 0,
    maxSeverity: 'info',
    confidence: 0,
  };

  for (const [signalClass, signals] of classified.byClass) {
    const config = SIGNAL_CLASS_CONFIG[signalClass];
    const rawContribution = signals.reduce((sum, s) => sum + s.weight, 0);
    const cappedContribution = Math.min(rawContribution, config.maxContribution);

    breakdown[signalClass] = cappedContribution;
  }

  breakdown.total = Math.min(
    breakdown.critical + breakdown.behavioral + breakdown.maintainability,
    10,
  );

  if (breakdown.critical > 0 && classified.critical.length > 0) {
    breakdown.maxSeverity = 'blocker';
  } else if (breakdown.behavioral > 0 && classified.behavioral.length > 0) {
    breakdown.maxSeverity = 'warning';
  } else {
    breakdown.maxSeverity = 'info';
  }

  const totalSignals =
    classified.critical.length + classified.behavioral.length + classified.maintainability.length;
  const classesWithSignals = [
    classified.critical.length > 0,
    classified.behavioral.length > 0,
    classified.maintainability.length > 0,
  ].filter(Boolean).length;

  breakdown.confidence = Math.min(totalSignals * 0.1 + classesWithSignals * 0.2, 1.0);

  return breakdown;
}

export function canBeBlocker(classified: ClassifiedSignals): boolean {
  return classified.critical.length > 0 || classified.behavioral.length > 0;
}

export function getReasonChain(
  classified: ClassifiedSignals,
  breakdown: RiskScoreBreakdown,
): string[] {
  const reasons: string[] = [];

  if (breakdown.critical > 0) {
    const ids = [...new Set(classified.critical.map((s) => s.id))];
    reasons.push(`Critical: ${ids.slice(0, 3).join(', ')} (+${breakdown.critical.toFixed(1)})`);
  }

  if (breakdown.behavioral > 0) {
    const ids = [...new Set(classified.behavioral.map((s) => s.id))];
    reasons.push(`Behavioral: ${ids.slice(0, 3).join(', ')} (+${breakdown.behavioral.toFixed(1)})`);
  }

  if (breakdown.maintainability > 0) {
    const ids = [...new Set(classified.maintainability.map((s) => s.id))];
    reasons.push(`Style: ${ids.slice(0, 2).join(', ')} (+${breakdown.maintainability.toFixed(1)})`);
  }

  return reasons;
}
