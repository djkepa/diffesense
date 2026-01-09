export type SignalClass = 'critical' | 'behavioral' | 'maintainability';

export type Severity = 'blocker' | 'warn' | 'info';

export type Confidence = 'high' | 'medium' | 'low';

export type EvidenceKind = 'regex' | 'ast' | 'history' | 'graph' | 'heuristic';

export type ActionType = 'test_command' | 'review_request' | 'runbook_link' | 'mitigation_steps';

export type SignalCategory =
  | 'complexity'
  | 'side-effect'
  | 'async'
  | 'blast-radius'
  | 'signature'
  | 'core-impact';

export type SideEffectType =
  | 'network'
  | 'storage'
  | 'dom'
  | 'timer'
  | 'global'
  | 'process'
  | 'database'
  | 'logging'
  | 'unknown';

export type AsyncType =
  | 'promise'
  | 'async-await'
  | 'callback'
  | 'event-handler'
  | 'observable'
  | 'generator';

/**
 * Complexity indicators
 */
export type ComplexityType =
  | 'deep-nesting'
  | 'long-function'
  | 'high-params'
  | 'cyclomatic'
  | 'large-file';

export interface Evidence {
  kind: EvidenceKind;
  details?: Record<string, unknown>;
  pattern?: string;
  astNode?: string;
}

export interface ActionRecommendation {
  type: ActionType;
  text: string;
  command?: string;
  reviewers?: string[];
  url?: string;
  steps?: string[];
}

export interface Signal {
  id: string;

  title: string;

  class: SignalClass;

  category: SignalCategory;

  severity: Severity;

  confidence: Confidence;

  weight: number;

  filePath: string;

  lines: number[];

  snippet?: string;

  reason: string;

  evidence: Evidence;

  actions?: ActionRecommendation[];

  tags?: string[];

  inChangedRange?: boolean;

  meta?: Record<string, unknown>;
}

export interface ChangedRange {
  startLine: number;
  endLine: number;
  type: 'added' | 'modified' | 'deleted';
  lineCount: number;
}

export interface FileChangeContext {
  repoRoot: string;
  filePath: string;
  language?: 'ts' | 'tsx' | 'js' | 'jsx' | 'json' | 'md' | string;
  content?: string;
  focus: {
    changedLineNumbers: number[];
    contextBefore: number;
    contextAfter: number;
    snippetText: string;
    snippetStartLine: number;
  };

  diff: {
    baseRef?: string;
    headRef?: string;
    isStaged?: boolean;
  };

  ownership?: {
    owners: string[];
  };

  graph?: {
    dependentsCount?: number;
  };

  history?: {
    churn30d?: number;
    recentIncidents?: number;
  };
}

export interface FileSignals {
  path: string;
  signals: Signal[];
  summary: SignalSummary;
}

export interface SignalSummary {
  total: number;
  byCategory: Partial<Record<SignalCategory, number>>;
  byType: Record<string, number>;
  changedLineSignals: number;
}

export function createSignal(
  partial: Partial<Signal> & Pick<Signal, 'id' | 'title' | 'reason' | 'filePath'>,
): Signal {
  const signalClass = partial.class || getSignalClassFromId(partial.id);
  const severity =
    partial.severity || getSeverityFromClassAndWeight(signalClass, partial.weight || 0.3);

  return {
    class: signalClass,
    category: 'complexity',
    severity,
    confidence: 'medium',
    weight: 0.3,
    lines: [],
    evidence: { kind: 'regex' },
    ...partial,
  };
}

export function getSignalClassFromId(signalId: string): SignalClass {
  const criticalPatterns = [
    'auth',
    'payment',
    'security',
    'permission',
    'token',
    'session',
    'password',
    'secret',
    'api-key',
    'encryption',
    'credential',
  ];

  const behavioralPatterns = [
    'conditional',
    'error',
    'async',
    'promise',
    'callback',
    'event',
    'network',
    'storage',
    'database',
    'timer',
    'process',
    'dom',
    'global',
    'effect',
    'watch',
    'subscribe',
    'http',
    'query',
  ];

  const lowerSignalId = signalId.toLowerCase();

  for (const pattern of criticalPatterns) {
    if (lowerSignalId.includes(pattern)) return 'critical';
  }

  for (const pattern of behavioralPatterns) {
    if (lowerSignalId.includes(pattern)) return 'behavioral';
  }

  return 'maintainability';
}

export function getSeverityFromClassAndWeight(signalClass: SignalClass, weight: number): Severity {
  if (signalClass === 'critical' && weight >= 0.6) return 'blocker';
  if (signalClass === 'critical' && weight >= 0.3) return 'warn';
  if (signalClass === 'behavioral' && weight >= 0.7) return 'blocker';
  if (signalClass === 'behavioral' && weight >= 0.4) return 'warn';

  if (signalClass === 'maintainability') return 'info';
  return 'info';
}

export function summarizeSignals(signals: Signal[]): SignalSummary {
  const byCategory: Partial<Record<SignalCategory, number>> = {};
  const byType: Record<string, number> = {};
  let changedLineSignals = 0;

  for (const signal of signals) {
    byCategory[signal.category] = (byCategory[signal.category] || 0) + 1;

    byType[signal.id] = (byType[signal.id] || 0) + 1;

    if (signal.inChangedRange) {
      changedLineSignals++;
    }
  }

  return {
    total: signals.length,
    byCategory,
    byType,
    changedLineSignals,
  };
}

export function validateSignal(signal: Signal): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!signal.id) errors.push('Signal must have an id');
  if (!signal.title) errors.push('Signal must have a title');
  if (!signal.reason) errors.push('Signal must have a reason');
  if (!signal.filePath) errors.push('Signal must have a filePath');

  if (signal.severity === 'blocker' && (!signal.actions || signal.actions.length === 0)) {
    errors.push('Blocker signals must have at least 1 action');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export interface LegacySignal {
  category: SignalCategory;
  type: string;
  description: string;
  line?: number;
  weight: number;
  inChangedRange?: boolean;
  meta?: Record<string, unknown>;
}

export function convertLegacySignal(legacy: LegacySignal, filePath: string): Signal {
  const signalClass = getSignalClassFromId(legacy.type);
  const severity = getSeverityFromClassAndWeight(signalClass, legacy.weight);

  return {
    id: legacy.type,
    title: legacy.type.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    class: signalClass,
    category: legacy.category,
    severity,
    confidence: 'medium',
    weight: legacy.weight,
    filePath,
    lines: legacy.line ? [legacy.line] : [],
    reason: legacy.description,
    evidence: { kind: 'regex' },
    inChangedRange: legacy.inChangedRange,
    meta: legacy.meta,
  };
}
