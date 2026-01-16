/**
 * Confidence Gate Contract Tests
 *
 * These tests ensure the gate never regresses on trust-first principles.
 * They protect against "confidence creep" where signals get promoted incorrectly.
 */

import { describe, it, expect } from 'vitest';
import {
  applyConfidenceGate,
  assignDefaultConfidence,
  assignDefaultConfidenceAll,
  DEFAULT_GATE_CONFIG,
} from '../src/core/confidenceGate';
import { classifySignals, calculateClassBasedRiskScore } from '../src/core/signalClasses';
import { Signal } from '../src/signals/types';

function createSignal(overrides: Partial<Signal>): Signal {
  return {
    id: 'test-signal',
    title: 'Test Signal',
    class: 'behavioral',
    category: 'complexity',
    severity: 'warn',
    weight: 0.5,
    filePath: 'test.ts',
    lines: [1],
    reason: 'Test reason',
    evidence: { kind: 'regex' },
    confidence: 'medium',
    ...overrides,
  };
}

describe('CONTRACT: Trust-First Gating', () => {
  describe('Rule 1: Medium/low signals must NEVER cause FAIL', () => {
    it('should not have blocking signals when all are medium confidence', () => {
      // Create 1000 medium confidence signals
      const signals: Signal[] = Array(1000)
        .fill(null)
        .map((_, i) =>
          createSignal({
            id: `medium-signal-${i}`,
            confidence: 'medium',
            class: 'behavioral',
            weight: 1.0, // High weight
          }),
        );

      const gated = applyConfidenceGate(signals);

      // None should be blocking
      expect(gated.blocking).toHaveLength(0);
      // All should be advisory
      expect(gated.advisory).toHaveLength(1000);
    });

    it('should not have blocking signals when all are low confidence', () => {
      // Create 1000 low confidence signals
      const signals: Signal[] = Array(1000)
        .fill(null)
        .map((_, i) =>
          createSignal({
            id: `low-signal-${i}`,
            confidence: 'low',
            class: 'critical', // Even critical class!
            weight: 1.0,
          }),
        );

      const gated = applyConfidenceGate(signals);

      // None should be blocking (low confidence overrides critical class)
      expect(gated.blocking).toHaveLength(0);
      // All should be filtered
      expect(gated.filtered).toHaveLength(1000);
    });

    it('should not have blocking signals for high confidence + low impact', () => {
      // Create 1000 high confidence but maintainability class signals
      const signals: Signal[] = Array(1000)
        .fill(null)
        .map((_, i) =>
          createSignal({
            id: `style-signal-${i}`,
            confidence: 'high',
            class: 'maintainability', // Low impact
            weight: 1.0,
          }),
        );

      const gated = applyConfidenceGate(signals);

      // None should be blocking (maintainability = low impact)
      expect(gated.blocking).toHaveLength(0);
      // All should be advisory
      expect(gated.advisory).toHaveLength(1000);
    });
  });

  describe('Rule 2: FAIL must be function of gatedRiskScore, not raw riskScore', () => {
    it('should have different scores for raw vs gated', () => {
      const signals: Signal[] = [
        // High confidence + high impact (blocking)
        createSignal({
          id: 'critical-1',
          confidence: 'high',
          class: 'critical',
          weight: 0.5,
        }),
        // Medium confidence (advisory)
        createSignal({
          id: 'behavioral-1',
          confidence: 'medium',
          class: 'behavioral',
          weight: 1.0,
        }),
        createSignal({
          id: 'behavioral-2',
          confidence: 'medium',
          class: 'behavioral',
          weight: 1.0,
        }),
        // Low confidence (filtered)
        createSignal({
          id: 'style-1',
          confidence: 'low',
          class: 'maintainability',
          weight: 0.5,
        }),
      ];

      const gated = applyConfidenceGate(signals);

      // Raw score includes all signals
      const allClassified = classifySignals(gated.all);
      const rawBreakdown = calculateClassBasedRiskScore(allClassified);

      // Gated score only includes blocking signals
      const blockingClassified = classifySignals(gated.blocking);
      const gatedBreakdown = calculateClassBasedRiskScore(blockingClassified);

      // Gated score should be lower (only blocking signals)
      expect(gatedBreakdown.total).toBeLessThan(rawBreakdown.total);

      // Blocking set should only contain the critical signal
      expect(gated.blocking).toHaveLength(1);
      expect(gated.blocking[0].id).toBe('critical-1');
    });

    it('should calculate zero gated score when no blocking signals exist', () => {
      const signals: Signal[] = [
        createSignal({ confidence: 'medium', class: 'behavioral', weight: 5.0 }),
        createSignal({ confidence: 'low', class: 'critical', weight: 5.0 }),
      ];

      const gated = applyConfidenceGate(signals);

      // No blocking signals
      expect(gated.blocking).toHaveLength(0);

      // Gated score should be 0
      const blockingClassified = classifySignals(gated.blocking);
      const gatedBreakdown = calculateClassBasedRiskScore(blockingClassified);
      expect(gatedBreakdown.total).toBe(0);
    });
  });

  describe('Rule 3: Default confidence must be conservative (low)', () => {
    it('should default to low for signals without confidence', () => {
      const signal = createSignal({ id: 'unknown' });
      delete (signal as Partial<Signal>).confidence;
      delete (signal as Partial<Signal>).class;

      const result = assignDefaultConfidence(signal);

      expect(result.confidence).toBe('low');
    });

    it('should default to low in gate normalization', () => {
      const signal = createSignal({ id: 'no-conf', class: 'behavioral' });
      delete (signal as Partial<Signal>).confidence;

      const gated = applyConfidenceGate([signal]);

      // Should be filtered (low confidence default)
      expect(gated.filtered).toHaveLength(1);
      expect(gated.all[0].confidence).toBe('low');
    });

    it('should only promote to high for critical class or security keywords', () => {
      const testCases = [
        // Should be high
        { id: 'auth-check', class: 'behavioral' as const, expectedHigh: true },
        { id: 'sec-xss', class: 'behavioral' as const, expectedHigh: true },
        { id: 'password-hash', class: 'behavioral' as const, expectedHigh: true },
        { id: 'token-verify', class: 'behavioral' as const, expectedHigh: true },
        { id: 'any-signal', class: 'critical' as const, expectedHigh: true },
        // Should NOT be high
        { id: 'async-await', class: 'behavioral' as const, expectedHigh: false },
        { id: 'large-file', class: 'maintainability' as const, expectedHigh: false },
        { id: 'deep-nesting', class: 'maintainability' as const, expectedHigh: false },
        { id: 'network-fetch', class: 'behavioral' as const, expectedHigh: false },
      ];

      for (const tc of testCases) {
        const signal = createSignal({ id: tc.id, class: tc.class });
        delete (signal as Partial<Signal>).confidence;

        const result = assignDefaultConfidence(signal);

        if (tc.expectedHigh) {
          expect(result.confidence).toBe('high');
        } else {
          expect(result.confidence).not.toBe('high');
        }
      }
    });
  });

  describe('Rule 4: Gate categories must be mutually exclusive', () => {
    it('should place each signal in exactly one category', () => {
      const signals: Signal[] = [
        createSignal({ id: 's1', confidence: 'high', class: 'critical' }),
        createSignal({ id: 's2', confidence: 'high', class: 'maintainability' }),
        createSignal({ id: 's3', confidence: 'medium', class: 'behavioral' }),
        createSignal({ id: 's4', confidence: 'low', class: 'behavioral' }),
      ];

      const gated = applyConfidenceGate(signals);

      // Total of all categories should equal input
      const totalCategorized =
        gated.blocking.length + gated.advisory.length + gated.filtered.length;
      expect(totalCategorized).toBe(signals.length);

      // No signal should appear in multiple categories
      const allIds = [
        ...gated.blocking.map((s) => s.id),
        ...gated.advisory.map((s) => s.id),
        ...gated.filtered.map((s) => s.id),
      ];
      const uniqueIds = new Set(allIds);
      expect(uniqueIds.size).toBe(allIds.length);
    });
  });

  describe('Rule 5: Normalized signals must always have confidence', () => {
    it('should ensure all signals in "all" have confidence set', () => {
      const signals: Signal[] = [
        createSignal({ id: 's1', confidence: 'high', class: 'critical' }),
        createSignal({ id: 's2', class: 'behavioral' }), // No confidence
        createSignal({ id: 's3' }), // No confidence, no class
      ];

      // Remove confidence from s2 and s3
      delete (signals[1] as Partial<Signal>).confidence;
      delete (signals[2] as Partial<Signal>).confidence;
      delete (signals[2] as Partial<Signal>).class;

      const gated = applyConfidenceGate(signals);

      // All signals should have confidence
      for (const signal of gated.all) {
        expect(signal.confidence).toBeDefined();
        expect(['high', 'medium', 'low']).toContain(signal.confidence);
      }
    });
  });
});

describe('CONTRACT: Scoring Consistency', () => {
  it('should use same scoring model for raw and gated scores', () => {
    // This test ensures we use classifySignals consistently
    const signals: Signal[] = [
      createSignal({ id: 'c1', confidence: 'high', class: 'critical', weight: 0.5 }),
      createSignal({ id: 'b1', confidence: 'high', class: 'behavioral', weight: 0.5 }),
    ];

    const gated = applyConfidenceGate(signals);

    // Calculate scores using the same method
    const allClassified = classifySignals(gated.all);
    const blockingClassified = classifySignals(gated.blocking);

    const allBreakdown = calculateClassBasedRiskScore(allClassified);
    const blockingBreakdown = calculateClassBasedRiskScore(blockingClassified);

    // Both should use same scale (max 10)
    expect(allBreakdown.total).toBeLessThanOrEqual(10);
    expect(blockingBreakdown.total).toBeLessThanOrEqual(10);

    // In this case they should be equal (all signals are blocking)
    expect(allBreakdown.total).toBe(blockingBreakdown.total);
  });
});
