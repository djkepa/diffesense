import { describe, it, expect } from 'vitest';
import {
  ALWAYS_IGNORE,
  DEFAULT_IGNORE,
  TEST_PATTERNS,
  CONFIG_PATTERNS,
  buildIgnoreList,
  shouldIgnore,
  filterIgnored,
  getIgnoreReason,
} from '../src/core/ignore';

describe('ignore', () => {
  describe('buildIgnoreList', () => {
    it('should include ALWAYS_IGNORE patterns', () => {
      const list = buildIgnoreList();
      for (const pattern of ALWAYS_IGNORE) {
        expect(list).toContain(pattern);
      }
    });

    it('should include DEFAULT_IGNORE patterns by default', () => {
      const list = buildIgnoreList();
      for (const pattern of DEFAULT_IGNORE) {
        expect(list).toContain(pattern);
      }
    });

    it('should include TEST_PATTERNS by default', () => {
      const list = buildIgnoreList();
      for (const pattern of TEST_PATTERNS) {
        expect(list).toContain(pattern);
      }
    });

    it('should exclude TEST_PATTERNS when includeTests is true', () => {
      const list = buildIgnoreList({ includeTests: true });
      for (const pattern of TEST_PATTERNS) {
        expect(list).not.toContain(pattern);
      }
    });

    it('should exclude CONFIG_PATTERNS when includeConfig is true', () => {
      const list = buildIgnoreList({ includeConfig: true });
      for (const pattern of CONFIG_PATTERNS) {
        expect(list).not.toContain(pattern);
      }
    });

    it('should add custom patterns', () => {
      const custom = ['**/custom/**', '*.custom'];
      const list = buildIgnoreList({ patterns: custom });
      expect(list).toContain('**/custom/**');
      expect(list).toContain('*.custom');
    });
  });

  describe('shouldIgnore', () => {
    const defaultPatterns = buildIgnoreList();

    it('should ignore node_modules', () => {
      expect(shouldIgnore('node_modules/lodash/index.js', defaultPatterns)).toBe(true);
      expect(shouldIgnore('src/node_modules/test.js', defaultPatterns)).toBe(true);
    });

    it('should ignore lock files', () => {
      expect(shouldIgnore('package-lock.json', defaultPatterns)).toBe(true);
      expect(shouldIgnore('yarn.lock', defaultPatterns)).toBe(true);
      expect(shouldIgnore('pnpm-lock.yaml', defaultPatterns)).toBe(true);
    });

    it('should ignore build output', () => {
      expect(shouldIgnore('dist/index.js', defaultPatterns)).toBe(true);
      expect(shouldIgnore('build/bundle.js', defaultPatterns)).toBe(true);
      expect(shouldIgnore('.next/static/chunks/main.js', defaultPatterns)).toBe(true);
    });

    it('should ignore generated files', () => {
      expect(shouldIgnore('src/generated/types.ts', defaultPatterns)).toBe(true);
      expect(shouldIgnore('src/types.generated.ts', defaultPatterns)).toBe(true);
    });

    it('should ignore vendor files', () => {
      expect(shouldIgnore('vendor/jquery.js', defaultPatterns)).toBe(true);
    });

    it('should ignore minified files', () => {
      expect(shouldIgnore('dist/bundle.min.js', defaultPatterns)).toBe(true);
      expect(shouldIgnore('public/app.min.css', defaultPatterns)).toBe(true);
    });

    it('should ignore source maps', () => {
      expect(shouldIgnore('dist/index.js.map', defaultPatterns)).toBe(true);
      expect(shouldIgnore('build/app.css.map', defaultPatterns)).toBe(true);
    });

    it('should ignore test files by default', () => {
      expect(shouldIgnore('src/utils.test.ts', defaultPatterns)).toBe(true);
      expect(shouldIgnore('src/utils.spec.ts', defaultPatterns)).toBe(true);
      expect(shouldIgnore('__tests__/utils.ts', defaultPatterns)).toBe(true);
    });

    it('should NOT ignore regular source files', () => {
      expect(shouldIgnore('src/index.ts', defaultPatterns)).toBe(false);
      expect(shouldIgnore('src/components/Button.tsx', defaultPatterns)).toBe(false);
      expect(shouldIgnore('lib/utils.js', defaultPatterns)).toBe(false);
    });
  });

  describe('filterIgnored', () => {
    it('should filter out ignored files', () => {
      const files = [
        'src/index.ts',
        'node_modules/lodash/index.js',
        'dist/bundle.js',
        'src/components/Button.tsx',
      ];
      const patterns = buildIgnoreList();
      const filtered = filterIgnored(files, patterns);

      expect(filtered).toContain('src/index.ts');
      expect(filtered).toContain('src/components/Button.tsx');
      expect(filtered).not.toContain('node_modules/lodash/index.js');
      expect(filtered).not.toContain('dist/bundle.js');
    });
  });

  describe('getIgnoreReason', () => {
    it('should return reason for ignored files', () => {
      const patterns = buildIgnoreList();

      const nodeModulesReason = getIgnoreReason('node_modules/test.js', patterns);
      expect(nodeModulesReason).toContain('always-ignore');

      const testReason = getIgnoreReason('src/utils.test.ts', patterns);
      expect(testReason).toContain('Test file');
    });

    it('should return null for non-ignored files', () => {
      const patterns = buildIgnoreList();
      const reason = getIgnoreReason('src/index.ts', patterns);
      expect(reason).toBeNull();
    });
  });
});
