import { describe, it, expect } from 'vitest';
import {
  parseConfig,
  formatValidationErrors,
  getDefaultConfig,
  DiffeSenseConfig,
} from '../src/config/schema';

describe('Config Schema', () => {
  describe('parseConfig', () => {
    it('should parse valid minimal config', () => {
      const result = parseConfig({
        version: 1,
        profile: 'minimal',
      });

      expect(result.valid).toBe(true);
      expect(result.config?.profile).toBe('minimal');
      expect(result.errors).toHaveLength(0);
    });

    it('should parse valid full config', () => {
      const result = parseConfig({
        version: 1,
        profile: 'react',
        scope: {
          default: 'branch',
          base: 'main',
        },
        thresholds: {
          fail: 7.5,
          warn: 5.0,
        },
        topN: 5,
        contextLines: 10,
        ignore: ['**/dist/**', '**/*.lock'],
        actions: {
          mapping: [
            {
              pattern: '**/auth/**',
              commands: ['npm test -- auth'],
              reviewers: ['@security-team'],
            },
          ],
        },
        rules: [
          {
            id: 'custom-rule',
            when: { riskGte: 8.0 },
            then: { severity: 'blocker' },
          },
        ],
      });

      expect(result.valid).toBe(true);
      expect(result.config?.profile).toBe('react');
      expect(result.config?.thresholds?.fail).toBe(7.5);
      expect(result.config?.topN).toBe(5);
    });

    it('should reject invalid profile', () => {
      const result = parseConfig({
        profile: 'invalid-profile',
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].path).toContain('profile');
    });

    it('should reject invalid version', () => {
      const result = parseConfig({
        version: 99,
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path.includes('version'))).toBe(true);
    });

    it('should reject threshold out of range', () => {
      const result = parseConfig({
        thresholds: {
          fail: 15, // > 10
        },
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes('10'))).toBe(true);
    });

    it('should accept ignore as array', () => {
      const result = parseConfig({
        ignore: ['**/dist/**', '**/*.lock'],
      });

      expect(result.valid).toBe(true);
    });

    it('should accept ignore as object', () => {
      const result = parseConfig({
        ignore: {
          patterns: ['**/dist/**'],
          includeTests: true,
        },
      });

      expect(result.valid).toBe(true);
    });

    it('should warn about deprecated fields', () => {
      const result = parseConfig({
        thresholds: {
          failAboveRisk: 7.0, // deprecated
        },
      });

      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('deprecated');
    });

    it('should validate custom patterns', () => {
      const result = parseConfig({
        customPatterns: [
          {
            id: 'my-pattern',
            name: 'My Pattern',
            description: 'Detects something',
            match: 'myFunction\\(',
            category: 'side-effect',
            signalType: 'my-signal',
            weight: 0.5,
            signalClass: 'behavioral',
          },
        ],
      });

      expect(result.valid).toBe(true);
      expect(result.config?.customPatterns).toHaveLength(1);
    });

    it('should reject invalid custom pattern weight', () => {
      const result = parseConfig({
        customPatterns: [
          {
            id: 'my-pattern',
            name: 'My Pattern',
            description: 'Detects something',
            match: 'myFunction\\(',
            category: 'side-effect',
            signalType: 'my-signal',
            weight: 5, // > 1
            signalClass: 'behavioral',
          },
        ],
      });

      expect(result.valid).toBe(false);
    });

    it('should validate rules', () => {
      const result = parseConfig({
        rules: [
          {
            id: 'my-rule',
            description: 'My custom rule',
            when: {
              riskGte: 7.0,
              pathMatches: ['**/critical/**'],
              signalClasses: ['critical'],
            },
            then: {
              severity: 'blocker',
              actions: [
                {
                  type: 'review',
                  text: 'Request senior review',
                },
              ],
            },
          },
        ],
      });

      expect(result.valid).toBe(true);
      expect(result.config?.rules).toHaveLength(1);
    });

    it('should validate exceptions', () => {
      const result = parseConfig({
        exceptions: [
          {
            id: 'legacy-exception',
            paths: ['**/legacy/**'],
            until: '2026-12-31',
            reason: 'Legacy code migration',
          },
        ],
      });

      expect(result.valid).toBe(true);
      expect(result.config?.exceptions).toHaveLength(1);
    });
  });

  describe('getDefaultConfig', () => {
    it('should return valid default config', () => {
      const config = getDefaultConfig();

      expect(config.version).toBe(1);
      expect(config.profile).toBe('minimal');
      expect(config.contextLines).toBe(5);
    });
  });

  describe('formatValidationErrors', () => {
    it('should format errors nicely', () => {
      const result = parseConfig({
        profile: 'invalid',
        thresholds: { fail: 999 },
      });

      const formatted = formatValidationErrors(result);

      expect(formatted).toContain('Configuration errors');
      expect(formatted).toContain('profile');
    });

    it('should include warnings', () => {
      const result = parseConfig({
        thresholds: { failAboveRisk: 7.0 },
      });

      const formatted = formatValidationErrors(result);

      expect(formatted).toContain('Warning');
      expect(formatted).toContain('deprecated');
    });
  });
});

