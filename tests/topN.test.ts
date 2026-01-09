import { describe, it, expect } from 'vitest';
import {
  selectTopN,
  DEFAULT_TOP_N_CONFIG,
  formatHiddenMessage,
  formatTopNSummary,
} from '../src/core/topN';
import { RuleResult } from '../src/policy/engine';
import { AnalyzedFile } from '../src/analyzers';

// Helper to create mock RuleResult
function createMockResult(
  path: string,
  riskScore: number,
  blastRadius: number,
  severity: 'blocker' | 'warning' | 'info' = 'warning',
): RuleResult {
  const file: AnalyzedFile = {
    path,
    riskScore,
    blastRadius,
    signals: [],
    summary: { total: 0, byCategory: {}, byType: {}, changedLineSignals: 0 },
    evidence: [],
    riskReasons: [],
    imports: [],
    loc: 100,
    changedLines: 10,
    isDiffAnalysis: true,
  };

  return {
    file,
    severity,
    rule: {
      id: 'test-rule',
      name: 'Test Rule',
      condition: 'always',
      severity,
      message: 'Test message',
    },
    message: 'Test message',
    actions: [],
  };
}

describe('topN', () => {
  describe('selectTopN', () => {
    const mockBlockers = [
      createMockResult('src/auth.ts', 9.0, 5, 'blocker'),
      createMockResult('src/payment.ts', 8.5, 3, 'blocker'),
    ];

    const mockWarnings = [
      createMockResult('src/api.ts', 7.0, 10, 'warning'),
      createMockResult('src/utils.ts', 6.0, 8, 'warning'),
      createMockResult('src/helpers.ts', 5.0, 2, 'warning'),
    ];

    const mockInfos = [
      createMockResult('src/styles.ts', 3.0, 1, 'info'),
      createMockResult('src/constants.ts', 2.0, 0, 'info'),
    ];

    it('should return top N issues with severity priority', () => {
      const result = selectTopN(mockBlockers, mockWarnings, mockInfos, { limit: 3 });

      expect(result.shownCount).toBe(3);
      expect(result.totalCount).toBe(7);
      expect(result.hiddenCount).toBe(4);
      expect(result.isLimited).toBe(true);

      // Blockers should come first
      expect(result.blockers).toHaveLength(2);
      expect(result.warnings).toHaveLength(1);
      expect(result.infos).toHaveLength(0);
    });

    it('should return all issues when showAll is true', () => {
      const result = selectTopN(mockBlockers, mockWarnings, mockInfos, { showAll: true });

      expect(result.shownCount).toBe(7);
      expect(result.hiddenCount).toBe(0);
      expect(result.isLimited).toBe(false);
    });

    it('should sort by risk score within each severity', () => {
      const result = selectTopN(mockBlockers, mockWarnings, mockInfos, { showAll: true });

      // Blockers sorted by risk
      expect(result.blockers[0].file.riskScore).toBe(9.0);
      expect(result.blockers[1].file.riskScore).toBe(8.5);

      // Warnings sorted by risk
      expect(result.warnings[0].file.riskScore).toBe(7.0);
      expect(result.warnings[1].file.riskScore).toBe(6.0);
    });

    it('should filter by minimum risk', () => {
      const result = selectTopN(mockBlockers, mockWarnings, mockInfos, {
        showAll: true,
        minRisk: 5.0,
      });

      expect(result.totalCount).toBe(5);
      expect(result.infos).toHaveLength(0);
    });

    it('should handle empty arrays', () => {
      const result = selectTopN([], [], [], {});

      expect(result.totalCount).toBe(0);
      expect(result.shownCount).toBe(0);
      expect(result.isLimited).toBe(false);
    });

    it('should provide deterministic ordering for equal scores', () => {
      const equalScores = [
        createMockResult('src/z.ts', 5.0, 1, 'warning'),
        createMockResult('src/a.ts', 5.0, 1, 'warning'),
        createMockResult('src/m.ts', 5.0, 1, 'warning'),
      ];

      const result1 = selectTopN([], equalScores, [], { showAll: true });
      const result2 = selectTopN([], equalScores, [], { showAll: true });

      // Should be deterministic (sorted by path as tiebreaker)
      expect(result1.warnings.map((r) => r.file.path)).toEqual(
        result2.warnings.map((r) => r.file.path),
      );
      expect(result1.warnings[0].file.path).toBe('src/a.ts');
    });

    it('should include rationale explaining selection criteria', () => {
      const result = selectTopN(mockBlockers, mockWarnings, mockInfos, { limit: 3 });

      expect(result.rationale).toBeDefined();
      expect(typeof result.rationale).toBe('string');
      expect(result.rationale.length).toBeGreaterThan(0);
      // Should mention sorting by risk score
      expect(result.rationale.toLowerCase()).toContain('risk');
    });

    it('should include next candidates in rationale when issues are hidden', () => {
      const result = selectTopN(mockBlockers, mockWarnings, mockInfos, { limit: 3 });

      // When issues are hidden, rationale should mention next candidates
      expect(result.hiddenCount).toBeGreaterThan(0);
      expect(result.nextCandidates).toBeDefined();
      expect(result.nextCandidates!.length).toBeGreaterThan(0);
    });

    it('should not include next candidates when all issues shown', () => {
      const result = selectTopN(mockBlockers, [], [], { showAll: true });

      expect(result.hiddenCount).toBe(0);
      expect(result.nextCandidates).toBeUndefined();
    });
  });

  describe('formatHiddenMessage', () => {
    it('should return message when issues are hidden', () => {
      const result = selectTopN(
        [createMockResult('src/a.ts', 9.0, 5, 'blocker')],
        [
          createMockResult('src/b.ts', 7.0, 3, 'warning'),
          createMockResult('src/c.ts', 6.0, 2, 'warning'),
        ],
        [],
        { limit: 2 },
      );

      const message = formatHiddenMessage(result);
      expect(message).toContain('more issue');
      expect(message).toContain('--show-all');
    });

    it('should return null when no issues are hidden', () => {
      const result = selectTopN(
        [createMockResult('src/a.ts', 9.0, 5, 'blocker')],
        [],
        [],
        { showAll: true },
      );

      const message = formatHiddenMessage(result);
      expect(message).toBeNull();
    });
  });

  describe('formatTopNSummary', () => {
    it('should show limited message when issues are hidden', () => {
      const result = selectTopN(
        [createMockResult('src/a.ts', 9.0, 5, 'blocker')],
        [createMockResult('src/b.ts', 7.0, 3, 'warning')],
        [createMockResult('src/c.ts', 3.0, 1, 'info')],
        { limit: 2 },
      );

      const summary = formatTopNSummary(result);
      expect(summary).toContain('Showing top 2 of 3');
    });

    it('should show total when all issues are shown', () => {
      const result = selectTopN(
        [createMockResult('src/a.ts', 9.0, 5, 'blocker')],
        [],
        [],
        { showAll: true },
      );

      const summary = formatTopNSummary(result);
      expect(summary).toContain('1 issue');
    });

    it('should show no issues message when empty', () => {
      const result = selectTopN([], [], [], {});

      const summary = formatTopNSummary(result);
      expect(summary).toContain('No issues');
    });
  });
});
