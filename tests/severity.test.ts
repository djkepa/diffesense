import { describe, it, expect } from 'vitest';
import { getRiskSeverity, getSeverityColor, sortFilesBySeverity } from '../src/core/severity';

describe('Risk Severity', () => {
  describe('getRiskSeverity', () => {
    it('should classify CRITICAL (>= 8.0)', () => {
      expect(getRiskSeverity(10.0)).toBe('CRITICAL');
      expect(getRiskSeverity(8.0)).toBe('CRITICAL');
      expect(getRiskSeverity(8.5)).toBe('CRITICAL');
    });

    it('should classify HIGH (6.0-7.9)', () => {
      expect(getRiskSeverity(7.9)).toBe('HIGH');
      expect(getRiskSeverity(6.0)).toBe('HIGH');
      expect(getRiskSeverity(7.0)).toBe('HIGH');
    });

    it('should classify MED (3.0-5.9)', () => {
      expect(getRiskSeverity(5.9)).toBe('MED');
      expect(getRiskSeverity(3.0)).toBe('MED');
      expect(getRiskSeverity(4.5)).toBe('MED');
    });

    it('should classify LOW (< 3.0)', () => {
      expect(getRiskSeverity(2.9)).toBe('LOW');
      expect(getRiskSeverity(0.0)).toBe('LOW');
      expect(getRiskSeverity(1.5)).toBe('LOW');
    });
  });

  describe('getSeverityColor', () => {
    it('should return correct colors', () => {
      expect(getSeverityColor('CRITICAL')).toBe('red');
      expect(getSeverityColor('HIGH')).toBe('yellow');
      expect(getSeverityColor('MED')).toBe('cyan');
      expect(getSeverityColor('LOW')).toBe('gray');
    });
  });

  describe('sortFilesBySeverity', () => {
    it('should sort by severity first (CRITICAL > HIGH > MED > LOW)', () => {
      const files = [
        { path: 'low.ts', riskScore: 1.0 },
        { path: 'critical.ts', riskScore: 9.0 },
        { path: 'med.ts', riskScore: 4.0 },
        { path: 'high.ts', riskScore: 7.0 },
      ];

      const sorted = sortFilesBySeverity(files);

      expect(sorted[0].path).toBe('critical.ts');
      expect(sorted[1].path).toBe('high.ts');
      expect(sorted[2].path).toBe('med.ts');
      expect(sorted[3].path).toBe('low.ts');
    });

    it('should sort by risk score desc within same severity', () => {
      const files = [
        { path: 'a.ts', riskScore: 8.0 },
        { path: 'b.ts', riskScore: 9.5 },
        { path: 'c.ts', riskScore: 8.5 },
      ];

      const sorted = sortFilesBySeverity(files);

      expect(sorted[0].riskScore).toBe(9.5);
      expect(sorted[1].riskScore).toBe(8.5);
      expect(sorted[2].riskScore).toBe(8.0);
    });

    it('should sort by path asc when risk scores are equal', () => {
      const files = [
        { path: 'z.ts', riskScore: 8.0 },
        { path: 'a.ts', riskScore: 8.0 },
        { path: 'm.ts', riskScore: 8.0 },
      ];

      const sorted = sortFilesBySeverity(files);

      expect(sorted[0].path).toBe('a.ts');
      expect(sorted[1].path).toBe('m.ts');
      expect(sorted[2].path).toBe('z.ts');
    });

    it('should handle mixed sorting criteria', () => {
      const files = [
        { path: 'z-low.ts', riskScore: 2.0 },
        { path: 'a-critical.ts', riskScore: 9.0 },
        { path: 'b-critical.ts', riskScore: 9.0 },
        { path: 'high-1.ts', riskScore: 7.5 },
        { path: 'high-2.ts', riskScore: 7.0 },
        { path: 'med.ts', riskScore: 4.0 },
      ];

      const sorted = sortFilesBySeverity(files);

      expect(sorted[0].path).toBe('a-critical.ts');
      expect(sorted[1].path).toBe('b-critical.ts');
      expect(sorted[2].path).toBe('high-1.ts');
      expect(sorted[3].path).toBe('high-2.ts');
      expect(sorted[4].path).toBe('med.ts');
      expect(sorted[5].path).toBe('z-low.ts');
    });

    it('should not mutate original array', () => {
      const files = [
        { path: 'b.ts', riskScore: 5.0 },
        { path: 'a.ts', riskScore: 8.0 },
      ];

      const original = [...files];
      sortFilesBySeverity(files);

      expect(files).toEqual(original);
    });

    it('should produce deterministic TOP 5 (stable sorting contract)', () => {
      const files = [
        { path: 'src/auth/login.ts', riskScore: 8.5 },
        { path: 'src/auth/logout.ts', riskScore: 8.5 },
        { path: 'src/api/users.ts', riskScore: 7.2 },
        { path: 'src/api/posts.ts', riskScore: 7.2 },
        { path: 'src/utils/format.ts', riskScore: 4.5 },
        { path: 'src/utils/validate.ts', riskScore: 4.5 },
        { path: 'src/components/Button.tsx', riskScore: 3.0 },
        { path: 'src/components/Modal.tsx', riskScore: 3.0 },
        { path: 'src/index.ts', riskScore: 2.0 },
        { path: 'src/App.tsx', riskScore: 2.0 },
      ];

      const sorted1 = sortFilesBySeverity(files);
      const sorted2 = sortFilesBySeverity(files);
      const sorted3 = sortFilesBySeverity([...files].reverse());

      const top5_1 = sorted1.slice(0, 5).map((f) => f.path);
      const top5_2 = sorted2.slice(0, 5).map((f) => f.path);
      const top5_3 = sorted3.slice(0, 5).map((f) => f.path);

      expect(top5_1).toEqual(top5_2);
      expect(top5_1).toEqual(top5_3);

      expect(top5_1).toEqual([
        'src/auth/login.ts',
        'src/auth/logout.ts',
        'src/api/posts.ts',
        'src/api/users.ts',
        'src/utils/format.ts',
      ]);
    });
  });
});
