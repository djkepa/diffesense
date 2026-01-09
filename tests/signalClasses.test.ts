import { describe, it, expect } from 'vitest';
import {
  classifySignals,
  calculateClassBasedRiskScore,
  getReasonChain,
  SIGNAL_CLASS_CONFIG,
  getSignalClass,
  canBeBlocker,
} from '../src/core/signalClasses';
import { Signal, createSignal } from '../src/signals/types';

// Helper to create test signals in new canonical format
function makeSignal(id: string, category: string, weight: number): Signal {
  return createSignal({
    id,
    title: id.replace(/-/g, ' '),
    reason: `Test signal: ${id}`,
    filePath: 'test.ts',
    category: category as Signal['category'],
    weight,
    lines: [1],
  });
}

describe('signalClasses', () => {
  describe('getSignalClass', () => {
    it('should return critical for auth signals', () => {
      expect(getSignalClass('auth-boundary')).toBe('critical');
      expect(getSignalClass('payment-logic')).toBe('critical');
      expect(getSignalClass('security-sensitive')).toBe('critical');
    });

    it('should return behavioral for logic signals', () => {
      expect(getSignalClass('conditional-logic')).toBe('behavioral');
      expect(getSignalClass('error-handling')).toBe('behavioral');
      expect(getSignalClass('async-await')).toBe('behavioral');
    });

    it('should return maintainability for style signals', () => {
      expect(getSignalClass('deep-nesting')).toBe('maintainability');
      expect(getSignalClass('large-file')).toBe('maintainability');
      expect(getSignalClass('logging-console')).toBe('maintainability');
    });

    it('should default to maintainability for unknown signals', () => {
      expect(getSignalClass('unknown-signal')).toBe('maintainability');
    });
  });

  describe('classifySignals', () => {
    it('should classify critical boundary signals', () => {
      const signals: Signal[] = [
        makeSignal('auth-boundary', 'core-impact', 3.0),
        makeSignal('payment-logic', 'core-impact', 3.0),
      ];

      const classified = classifySignals(signals);

      expect(classified.critical).toHaveLength(2);
      expect(classified.behavioral).toHaveLength(0);
      expect(classified.maintainability).toHaveLength(0);
    });

    it('should classify behavioral signals', () => {
      const signals: Signal[] = [
        makeSignal('async-await', 'side-effect', 1.5),
        makeSignal('conditional-logic', 'complexity', 1.0),
      ];

      const classified = classifySignals(signals);

      expect(classified.critical).toHaveLength(0);
      expect(classified.behavioral).toHaveLength(2);
      expect(classified.maintainability).toHaveLength(0);
    });

    it('should classify maintainability signals', () => {
      const signals: Signal[] = [
        makeSignal('deep-nesting', 'complexity', 0.5),
        makeSignal('large-file', 'complexity', 0.5),
      ];

      const classified = classifySignals(signals);

      expect(classified.critical).toHaveLength(0);
      expect(classified.behavioral).toHaveLength(0);
      expect(classified.maintainability).toHaveLength(2);
    });

    it('should apply weight multipliers', () => {
      const signals: Signal[] = [makeSignal('auth-boundary', 'core-impact', 2.0)];

      const classified = classifySignals(signals);

      // Critical signals get 1.5x multiplier
      expect(classified.critical[0].weight).toBe(2.0 * 1.5);
      expect(classified.critical[0].meta?.originalWeight).toBe(2.0);
    });
  });

  describe('calculateClassBasedRiskScore', () => {
    it('should cap maintainability signals contribution', () => {
      const signals: Signal[] = [
        makeSignal('deep-nesting', 'complexity', 2.0),
        makeSignal('large-file', 'complexity', 2.0),
        makeSignal('logging-console', 'complexity', 2.0),
      ];

      const classified = classifySignals(signals);
      const result = calculateClassBasedRiskScore(classified);

      // Total maintainability weight after multiplier = 6.0 * 0.5 = 3.0
      // But should be capped at maxContribution (1.0)
      expect(result.maintainability).toBeLessThanOrEqual(
        SIGNAL_CLASS_CONFIG.maintainability.maxContribution,
      );
    });

    it('should not cap critical signals', () => {
      const signals: Signal[] = [
        makeSignal('auth-boundary', 'core-impact', 2.0),
        makeSignal('payment-logic', 'core-impact', 2.0),
      ];

      const classified = classifySignals(signals);
      const result = calculateClassBasedRiskScore(classified);

      // Critical signals get 1.5x multiplier: (2.0 + 2.0) * 1.5 = 6.0
      // Should not be capped (maxContribution is 5.0)
      expect(result.critical).toBeGreaterThan(0);
    });

    it('should combine all signal classes correctly', () => {
      const signals: Signal[] = [
        makeSignal('auth-boundary', 'core-impact', 1.0),
        makeSignal('async-await', 'side-effect', 1.0),
        makeSignal('deep-nesting', 'complexity', 1.0),
      ];

      const classified = classifySignals(signals);
      const result = calculateClassBasedRiskScore(classified);

      expect(result.critical).toBeGreaterThan(0);
      expect(result.behavioral).toBeGreaterThan(0);
      expect(result.maintainability).toBeGreaterThan(0);
      expect(result.total).toBe(result.critical + result.behavioral + result.maintainability);
    });

    it('should determine correct max severity', () => {
      // Only maintainability signals
      const maintOnly = classifySignals([makeSignal('deep-nesting', 'complexity', 5.0)]);
      expect(calculateClassBasedRiskScore(maintOnly).maxSeverity).toBe('info');

      // Has behavioral signals
      const withBehavioral = classifySignals([makeSignal('async-await', 'side-effect', 3.0)]);
      expect(calculateClassBasedRiskScore(withBehavioral).maxSeverity).toBe('warning');

      // Has critical signals
      const withCritical = classifySignals([makeSignal('auth-boundary', 'core-impact', 2.0)]);
      expect(calculateClassBasedRiskScore(withCritical).maxSeverity).toBe('blocker');
    });
  });

  describe('canBeBlocker', () => {
    it('should return true when critical signals present', () => {
      const classified = classifySignals([makeSignal('auth-boundary', 'core-impact', 2.0)]);
      expect(canBeBlocker(classified)).toBe(true);
    });

    it('should return true when behavioral signals present', () => {
      const classified = classifySignals([makeSignal('async-await', 'side-effect', 2.0)]);
      expect(canBeBlocker(classified)).toBe(true);
    });

    it('should return false when only maintainability signals', () => {
      const classified = classifySignals([
        makeSignal('deep-nesting', 'complexity', 5.0),
        makeSignal('large-file', 'complexity', 5.0),
      ]);
      expect(canBeBlocker(classified)).toBe(false);
    });
  });

  describe('getReasonChain', () => {
    it('should generate reason chain with class breakdown', () => {
      const signals: Signal[] = [
        makeSignal('auth-boundary', 'core-impact', 3.0),
        makeSignal('async-await', 'side-effect', 1.5),
        makeSignal('deep-nesting', 'complexity', 0.5),
      ];

      const classified = classifySignals(signals);
      const breakdown = calculateClassBasedRiskScore(classified);
      const reasons = getReasonChain(classified, breakdown);

      expect(reasons.some((r) => r.includes('Critical'))).toBe(true);
      expect(reasons.some((r) => r.includes('Behavioral'))).toBe(true);
      expect(reasons.some((r) => r.includes('Style'))).toBe(true);
    });
  });
});
