import { describe, it, expect } from 'vitest';
import {
  applyConfidenceGate,
  assignDefaultConfidence,
  assignDefaultConfidenceAll,
  formatGateStats,
  getDisplaySignals,
  getDetailedSignals,
  hasBlockingSignals,
  meetsThreshold,
  meetsImpactThreshold,
  DEFAULT_GATE_CONFIG,
} from '../src/core/confidenceGate';
import { Signal, Confidence } from '../src/signals/types';

function createSignal(overrides: Partial<Signal>): Signal {
  return {
    id: 'test-signal',
    title: 'Test Signal',
    class: 'behavioral', // Default to behavioral (high impact)
    category: 'complexity',
    severity: 'warn',
    confidence: 'medium',
    weight: 0.5,
    filePath: 'test.ts',
    lines: [1],
    reason: 'Test reason',
    evidence: { kind: 'regex' },
    ...overrides,
  };
}

describe('meetsThreshold', () => {
  it('should return true when confidence meets threshold', () => {
    expect(meetsThreshold('high', 'high')).toBe(true);
    expect(meetsThreshold('high', 'medium')).toBe(true);
    expect(meetsThreshold('high', 'low')).toBe(true);
    expect(meetsThreshold('medium', 'medium')).toBe(true);
    expect(meetsThreshold('medium', 'low')).toBe(true);
    expect(meetsThreshold('low', 'low')).toBe(true);
  });

  it('should return false when confidence is below threshold', () => {
    expect(meetsThreshold('medium', 'high')).toBe(false);
    expect(meetsThreshold('low', 'high')).toBe(false);
    expect(meetsThreshold('low', 'medium')).toBe(false);
  });
});

describe('meetsImpactThreshold', () => {
  it('should return true for critical class with high threshold', () => {
    expect(meetsImpactThreshold('critical', 'high')).toBe(true);
  });

  it('should return true for behavioral class with high threshold', () => {
    expect(meetsImpactThreshold('behavioral', 'high')).toBe(true);
  });

  it('should return false for maintainability class with high threshold', () => {
    expect(meetsImpactThreshold('maintainability', 'high')).toBe(false);
  });

  it('should return true for maintainability class with low threshold', () => {
    expect(meetsImpactThreshold('maintainability', 'low')).toBe(true);
  });

  it('should return false for undefined class', () => {
    expect(meetsImpactThreshold(undefined, 'high')).toBe(false);
  });
});

describe('applyConfidenceGate', () => {
  it('should separate signals by confidence AND impact', () => {
    const signals: Signal[] = [
      // High confidence + high impact = blocking
      createSignal({ id: 'critical-high', confidence: 'high', class: 'critical' }),
      createSignal({ id: 'behavioral-high', confidence: 'high', class: 'behavioral' }),
      // High confidence + low impact = advisory (not blocking!)
      createSignal({ id: 'maint-high', confidence: 'high', class: 'maintainability' }),
      // Medium confidence = advisory
      createSignal({ id: 'medium-1', confidence: 'medium', class: 'behavioral' }),
      // Low confidence = filtered
      createSignal({ id: 'low-1', confidence: 'low', class: 'behavioral' }),
    ];

    const gated = applyConfidenceGate(signals);

    expect(gated.blocking).toHaveLength(2); // Only critical-high and behavioral-high
    expect(gated.advisory).toHaveLength(2); // maint-high and medium-1
    expect(gated.filtered).toHaveLength(1); // low-1
    expect(gated.all).toHaveLength(5);
  });

  it('should require both high confidence and high impact for blocking', () => {
    const signals: Signal[] = [
      // High confidence but low impact (maintainability) = NOT blocking
      createSignal({ id: 'style', confidence: 'high', class: 'maintainability' }),
    ];

    const gated = applyConfidenceGate(signals);

    expect(gated.blocking).toHaveLength(0);
    expect(gated.advisory).toHaveLength(1); // Goes to advisory instead
  });

  it('should correctly identify blocking signals', () => {
    const signals: Signal[] = [
      createSignal({ id: 'auth', confidence: 'high', class: 'critical' }),
      createSignal({ id: 'style', confidence: 'low', class: 'maintainability' }),
    ];

    const gated = applyConfidenceGate(signals);

    expect(gated.blocking.map((s) => s.id)).toContain('auth');
    expect(gated.filtered.map((s) => s.id)).toContain('style');
  });

  it('should calculate correct statistics', () => {
    const signals: Signal[] = [
      createSignal({ confidence: 'high', class: 'critical' }),
      createSignal({ confidence: 'high', class: 'behavioral' }),
      createSignal({ confidence: 'medium', class: 'behavioral' }),
      createSignal({ confidence: 'medium', class: 'maintainability' }),
      createSignal({ confidence: 'low', class: 'maintainability' }),
    ];

    const gated = applyConfidenceGate(signals);

    expect(gated.stats.total).toBe(5);
    expect(gated.stats.blocking).toBe(2);
    expect(gated.stats.advisory).toBe(2);
    expect(gated.stats.filtered).toBe(1);
    expect(gated.stats.blockingRatio).toBeCloseTo(0.4);
  });

  it('should handle empty signals array', () => {
    const gated = applyConfidenceGate([]);

    expect(gated.blocking).toHaveLength(0);
    expect(gated.advisory).toHaveLength(0);
    expect(gated.filtered).toHaveLength(0);
    expect(gated.stats.blockingRatio).toBe(0);
  });

  it('should treat signals without confidence as low (trust-first)', () => {
    const signal = createSignal({ id: 'no-conf', class: 'behavioral' });
    delete (signal as Partial<Signal>).confidence;

    const gated = applyConfidenceGate([signal]);

    // Without confidence, default is 'low', so it goes to filtered
    expect(gated.filtered).toHaveLength(1);
    expect(gated.all[0].confidence).toBe('low'); // Normalized
  });

  it('should normalize all signals with confidence', () => {
    const signals: Signal[] = [
      createSignal({ id: 'has-conf', confidence: 'high', class: 'critical' }),
      createSignal({ id: 'no-conf', class: 'behavioral' }),
    ];
    delete (signals[1] as Partial<Signal>).confidence;

    const gated = applyConfidenceGate(signals);

    // All signals in 'all' should have confidence
    expect(gated.all.every((s) => s.confidence !== undefined)).toBe(true);
  });
});

describe('assignDefaultConfidence', () => {
  it('should not change signals that already have confidence', () => {
    const signal = createSignal({ confidence: 'medium' });
    const result = assignDefaultConfidence(signal);

    expect(result.confidence).toBe('medium');
  });

  it('should assign high confidence to critical class signals', () => {
    const signal = createSignal({ id: 'some-signal', class: 'critical' });
    delete (signal as Partial<Signal>).confidence;

    const result = assignDefaultConfidence(signal);

    expect(result.confidence).toBe('high');
  });

  it('should assign high confidence to security-related signals', () => {
    const authSignal = createSignal({ id: 'auth-check', class: 'behavioral' });
    delete (authSignal as Partial<Signal>).confidence;

    const result = assignDefaultConfidence(authSignal);

    expect(result.confidence).toBe('high');
  });

  it('should assign high confidence to sec- prefixed signals', () => {
    const secSignal = createSignal({ id: 'sec-xss', class: 'behavioral' });
    delete (secSignal as Partial<Signal>).confidence;

    const result = assignDefaultConfidence(secSignal);

    expect(result.confidence).toBe('high');
  });

  it('should assign low confidence to maintainability signals', () => {
    const signal = createSignal({ id: 'large-file', class: 'maintainability' });
    delete (signal as Partial<Signal>).confidence;

    const result = assignDefaultConfidence(signal);

    expect(result.confidence).toBe('low');
  });

  it('should assign medium confidence to behavioral signals (default)', () => {
    const signal = createSignal({ id: 'async-await', class: 'behavioral' });
    delete (signal as Partial<Signal>).confidence;

    const result = assignDefaultConfidence(signal);

    expect(result.confidence).toBe('medium');
  });

  it('should default to low for unknown signals (trust-first)', () => {
    const signal = createSignal({ id: 'unknown-signal' });
    delete (signal as Partial<Signal>).confidence;
    delete (signal as Partial<Signal>).class;

    const result = assignDefaultConfidence(signal);

    expect(result.confidence).toBe('low');
  });
});

describe('assignDefaultConfidenceAll', () => {
  it('should assign confidence to all signals', () => {
    const signals = [
      createSignal({ id: 'sig1', class: 'critical' }),
      createSignal({ id: 'sig2', class: 'maintainability' }),
    ];

    // Remove confidence from all
    signals.forEach((s) => delete (s as Partial<Signal>).confidence);

    const result = assignDefaultConfidenceAll(signals);

    expect(result[0].confidence).toBe('high');
    expect(result[1].confidence).toBe('low');
  });
});

describe('getDisplaySignals', () => {
  it('should return blocking and advisory signals', () => {
    const signals: Signal[] = [
      createSignal({ id: 'high', confidence: 'high', class: 'critical' }),
      createSignal({ id: 'medium', confidence: 'medium', class: 'behavioral' }),
      createSignal({ id: 'low', confidence: 'low', class: 'maintainability' }),
    ];

    const gated = applyConfidenceGate(signals);
    const display = getDisplaySignals(gated);

    expect(display).toHaveLength(2);
    expect(display.map((s) => s.id)).toContain('high');
    expect(display.map((s) => s.id)).toContain('medium');
    expect(display.map((s) => s.id)).not.toContain('low');
  });
});

describe('getDetailedSignals', () => {
  it('should return all signals when showLowInDetails is true', () => {
    const signals: Signal[] = [
      createSignal({ id: 'high', confidence: 'high', class: 'critical' }),
      createSignal({ id: 'low', confidence: 'low', class: 'maintainability' }),
    ];

    const gated = applyConfidenceGate(signals);
    const detailed = getDetailedSignals(gated, { ...DEFAULT_GATE_CONFIG, showLowInDetails: true });

    expect(detailed).toHaveLength(2);
  });

  it('should exclude low signals when showLowInDetails is false', () => {
    const signals: Signal[] = [
      createSignal({ id: 'high', confidence: 'high', class: 'critical' }),
      createSignal({ id: 'low', confidence: 'low', class: 'maintainability' }),
    ];

    const gated = applyConfidenceGate(signals);
    const detailed = getDetailedSignals(gated, { ...DEFAULT_GATE_CONFIG, showLowInDetails: false });

    expect(detailed).toHaveLength(1);
  });
});

describe('hasBlockingSignals', () => {
  it('should return true when blocking signals exist', () => {
    const signals: Signal[] = [createSignal({ confidence: 'high', class: 'critical' })];
    const gated = applyConfidenceGate(signals);

    expect(hasBlockingSignals(gated)).toBe(true);
  });

  it('should return false when no blocking signals', () => {
    const signals: Signal[] = [createSignal({ confidence: 'low', class: 'maintainability' })];
    const gated = applyConfidenceGate(signals);

    expect(hasBlockingSignals(gated)).toBe(false);
  });

  it('should return false for high confidence but low impact', () => {
    const signals: Signal[] = [createSignal({ confidence: 'high', class: 'maintainability' })];
    const gated = applyConfidenceGate(signals);

    expect(hasBlockingSignals(gated)).toBe(false);
  });
});

describe('formatGateStats', () => {
  it('should format stats correctly', () => {
    const stats = {
      total: 10,
      blocking: 3,
      advisory: 5,
      filtered: 2,
      blockingRatio: 0.3,
    };

    const result = formatGateStats(stats);

    expect(result).toContain('3 high-impact');
    expect(result).toContain('5 advisory');
    expect(result).toContain('2 filtered');
    expect(result).toContain('10 total');
  });

  it('should handle empty stats', () => {
    const stats = {
      total: 0,
      blocking: 0,
      advisory: 0,
      filtered: 0,
      blockingRatio: 0,
    };

    const result = formatGateStats(stats);

    expect(result).toBe('No signals detected');
  });
});
