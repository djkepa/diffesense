import { describe, it, expect } from 'vitest';
import {
  computeHash,
  computeInputHash,
  computeOutputHash,
  checkDeterminism,
  compareDeterminismResults,
  formatDeterminismResult,
  DeterminismInput,
  DeterminismOutput,
} from '../src/core/determinism';

describe('Determinism Check', () => {
  describe('computeHash', () => {
    it('should produce consistent hash for same input', () => {
      const hash1 = computeHash('test content');
      const hash2 = computeHash('test content');

      expect(hash1).toBe(hash2);
    });

    it('should produce different hash for different input', () => {
      const hash1 = computeHash('content A');
      const hash2 = computeHash('content B');

      expect(hash1).not.toBe(hash2);
    });

    it('should produce 16-character hash', () => {
      const hash = computeHash('test');

      expect(hash.length).toBe(16);
    });
  });

  describe('computeInputHash', () => {
    it('should produce consistent hash for same input', () => {
      const input: DeterminismInput = {
        diffContent: 'diff --git a/file.ts',
        configJson: '{"profile": "minimal"}',
        profile: 'minimal',
        options: {
          scope: 'branch',
          base: 'main',
          topN: 3,
          includeTests: false,
          includeConfig: false,
        },
      };

      const hash1 = computeInputHash(input);
      const hash2 = computeInputHash(input);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hash when diff changes', () => {
      const input1: DeterminismInput = {
        diffContent: 'diff A',
        configJson: '{}',
        profile: 'minimal',
        options: { scope: 'branch', base: 'main', topN: 3, includeTests: false, includeConfig: false },
      };

      const input2: DeterminismInput = {
        diffContent: 'diff B',
        configJson: '{}',
        profile: 'minimal',
        options: { scope: 'branch', base: 'main', topN: 3, includeTests: false, includeConfig: false },
      };

      expect(computeInputHash(input1)).not.toBe(computeInputHash(input2));
    });

    it('should produce different hash when config changes', () => {
      const input1: DeterminismInput = {
        diffContent: 'diff',
        configJson: '{"profile": "minimal"}',
        profile: 'minimal',
        options: { scope: 'branch', base: 'main', topN: 3, includeTests: false, includeConfig: false },
      };

      const input2: DeterminismInput = {
        diffContent: 'diff',
        configJson: '{"profile": "strict"}',
        profile: 'strict',
        options: { scope: 'branch', base: 'main', topN: 3, includeTests: false, includeConfig: false },
      };

      expect(computeInputHash(input1)).not.toBe(computeInputHash(input2));
    });
  });

  describe('computeOutputHash', () => {
    it('should produce consistent hash for same output', () => {
      const output: DeterminismOutput = {
        resultJson: JSON.stringify({ files: [], summary: { risk: 5.0 } }),
        filesAnalyzed: 10,
        signalsDetected: 5,
      };

      const hash1 = computeOutputHash(output);
      const hash2 = computeOutputHash(output);

      expect(hash1).toBe(hash2);
    });

    it('should ignore timestamp in output', () => {
      const output1: DeterminismOutput = {
        resultJson: JSON.stringify({ files: [], timestamp: '2024-01-01' }),
        filesAnalyzed: 10,
        signalsDetected: 5,
      };

      const output2: DeterminismOutput = {
        resultJson: JSON.stringify({ files: [], timestamp: '2024-01-02' }),
        filesAnalyzed: 10,
        signalsDetected: 5,
      };

      expect(computeOutputHash(output1)).toBe(computeOutputHash(output2));
    });
  });

  describe('checkDeterminism', () => {
    it('should return valid result', () => {
      const input: DeterminismInput = {
        diffContent: 'diff',
        configJson: '{}',
        profile: 'minimal',
        options: { scope: 'branch', base: 'main', topN: 3, includeTests: false, includeConfig: false },
      };

      const output: DeterminismOutput = {
        resultJson: '{"files": []}',
        filesAnalyzed: 5,
        signalsDetected: 2,
      };

      const result = checkDeterminism(input, output);

      expect(result.inputHash).toBeDefined();
      expect(result.outputHash).toBeDefined();
      expect(result.passed).toBe(true);
      expect(result.details.filesAnalyzed).toBe(5);
      expect(result.details.signalsDetected).toBe(2);
    });
  });

  describe('compareDeterminismResults', () => {
    it('should match identical results', () => {
      const result1 = {
        inputHash: 'abc123',
        outputHash: 'def456',
        passed: true,
        details: { diffHash: 'a', configHash: 'b', filesAnalyzed: 5, signalsDetected: 2 },
      };

      const result2 = { ...result1 };

      const comparison = compareDeterminismResults(result1, result2);

      expect(comparison.match).toBe(true);
      expect(comparison.differences).toHaveLength(0);
    });

    it('should detect input hash mismatch', () => {
      const result1 = {
        inputHash: 'abc123',
        outputHash: 'def456',
        passed: true,
        details: { diffHash: 'a', configHash: 'b', filesAnalyzed: 5, signalsDetected: 2 },
      };

      const result2 = {
        inputHash: 'xyz789', // Different
        outputHash: 'def456',
        passed: true,
        details: { diffHash: 'a', configHash: 'b', filesAnalyzed: 5, signalsDetected: 2 },
      };

      const comparison = compareDeterminismResults(result1, result2);

      expect(comparison.match).toBe(false);
      expect(comparison.differences.some((d) => d.includes('Input hash'))).toBe(true);
    });

    it('should detect output hash mismatch', () => {
      const result1 = {
        inputHash: 'abc123',
        outputHash: 'def456',
        passed: true,
        details: { diffHash: 'a', configHash: 'b', filesAnalyzed: 5, signalsDetected: 2 },
      };

      const result2 = {
        inputHash: 'abc123',
        outputHash: 'different', // Different
        passed: true,
        details: { diffHash: 'a', configHash: 'b', filesAnalyzed: 5, signalsDetected: 2 },
      };

      const comparison = compareDeterminismResults(result1, result2);

      expect(comparison.match).toBe(false);
      expect(comparison.differences.some((d) => d.includes('Output hash'))).toBe(true);
    });
  });

  describe('formatDeterminismResult', () => {
    it('should format result for console', () => {
      const result = {
        inputHash: 'abc123def456',
        outputHash: 'xyz789uvw012',
        passed: true,
        details: { diffHash: 'aaa', configHash: 'bbb', filesAnalyzed: 10, signalsDetected: 5 },
      };

      const formatted = formatDeterminismResult(result);

      expect(formatted).toContain('Determinism Check');
      expect(formatted).toContain('Input Hash');
      expect(formatted).toContain('Output Hash');
      expect(formatted).toContain('abc123def456');
      expect(formatted).toContain('xyz789uvw012');
    });
  });
});

