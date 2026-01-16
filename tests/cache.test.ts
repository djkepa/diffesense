import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  AnalysisCache,
  createCache,
  buildCacheKeyComponents,
  generateCacheKey,
  hashConfig,
  hashDiff,
  sha256,
  shortHash,
  CacheKeyComponents,
} from '../src/cache';

describe('Cache Hash Functions', () => {
  describe('sha256', () => {
    it('should produce consistent hash for same input', () => {
      const hash1 = sha256('test input');
      const hash2 = sha256('test input');
      expect(hash1).toBe(hash2);
    });

    it('should produce different hash for different input', () => {
      const hash1 = sha256('input 1');
      const hash2 = sha256('input 2');
      expect(hash1).not.toBe(hash2);
    });

    it('should produce 64 character hex string', () => {
      const hash = sha256('test');
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]+$/);
    });
  });

  describe('shortHash', () => {
    it('should produce 16 character hash', () => {
      const hash = shortHash('test input');
      expect(hash).toHaveLength(16);
    });

    it('should be deterministic', () => {
      const hash1 = shortHash('same input');
      const hash2 = shortHash('same input');
      expect(hash1).toBe(hash2);
    });
  });

  describe('hashConfig', () => {
    it('should produce consistent hash for equivalent objects', () => {
      const config1 = { a: 1, b: 2 };
      const config2 = { b: 2, a: 1 };

      const hash1 = hashConfig(config1);
      const hash2 = hashConfig(config2);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hash for different configs', () => {
      const config1 = { threshold: 7.0 };
      const config2 = { threshold: 8.0 };

      const hash1 = hashConfig(config1);
      const hash2 = hashConfig(config2);

      expect(hash1).not.toBe(hash2);
    });

    it('should handle nested objects with stable ordering', () => {
      // This is critical: nested objects must also be sorted
      const config1 = {
        rules: { severity: 'high', threshold: 5 },
        output: { format: 'json' },
      };
      const config2 = {
        output: { format: 'json' },
        rules: { threshold: 5, severity: 'high' },
      };

      const hash1 = hashConfig(config1);
      const hash2 = hashConfig(config2);

      // Same content, different order -> should produce same hash
      expect(hash1).toBe(hash2);
    });

    it('should detect changes in nested objects', () => {
      const config1 = {
        rules: { severity: 'high', threshold: 5 },
      };
      const config2 = {
        rules: { severity: 'high', threshold: 6 }, // Changed
      };

      const hash1 = hashConfig(config1);
      const hash2 = hashConfig(config2);

      // Different nested value -> different hash
      expect(hash1).not.toBe(hash2);
    });

    it('should handle deeply nested objects', () => {
      const config1 = {
        a: { b: { c: { d: 1 } } },
      };
      const config2 = {
        a: { b: { c: { d: 1 } } },
      };
      const config3 = {
        a: { b: { c: { d: 2 } } }, // Deep change
      };

      expect(hashConfig(config1)).toBe(hashConfig(config2));
      expect(hashConfig(config1)).not.toBe(hashConfig(config3));
    });

    it('should handle arrays in config', () => {
      const config1 = { ignore: ['a', 'b', 'c'] };
      const config2 = { ignore: ['a', 'b', 'c'] };
      const config3 = { ignore: ['a', 'b', 'd'] }; // Changed

      expect(hashConfig(config1)).toBe(hashConfig(config2));
      expect(hashConfig(config1)).not.toBe(hashConfig(config3));
    });

    it('should handle null and undefined values', () => {
      const config1 = { a: null, b: undefined };
      const config2 = { b: undefined, a: null };

      expect(hashConfig(config1)).toBe(hashConfig(config2));
    });
  });

  describe('hashDiff', () => {
    it('should return "empty" for empty diff', () => {
      expect(hashDiff('')).toBe('empty');
      expect(hashDiff('   ')).toBe('empty');
    });

    it('should produce consistent hash for same diff', () => {
      const diff = '--- a/file.ts\n+++ b/file.ts\n@@ -1 +1 @@\n-old\n+new';
      const hash1 = hashDiff(diff);
      const hash2 = hashDiff(diff);
      expect(hash1).toBe(hash2);
    });
  });

  describe('generateCacheKey', () => {
    it('should generate consistent key from components', () => {
      const components: CacheKeyComponents = {
        repoPath: 'my-repo',
        headSha: 'abc123',
        base: 'main',
        scope: 'branch',
        toolVersion: '1.0.0',
        configHash: 'config123',
      };

      const key1 = generateCacheKey(components);
      const key2 = generateCacheKey(components);

      expect(key1).toBe(key2);
      expect(key1).toHaveLength(16);
    });

    it('should generate different key when any component changes', () => {
      const base: CacheKeyComponents = {
        repoPath: 'my-repo',
        headSha: 'abc123',
        base: 'main',
        scope: 'branch',
        toolVersion: '1.0.0',
        configHash: 'config123',
      };

      const withDifferentHead = { ...base, headSha: 'def456' };
      const withDifferentBase = { ...base, base: 'develop' };
      const withDifferentVersion = { ...base, toolVersion: '1.1.0' };

      const keyBase = generateCacheKey(base);
      const keyHead = generateCacheKey(withDifferentHead);
      const keyBaseBranch = generateCacheKey(withDifferentBase);
      const keyVersion = generateCacheKey(withDifferentVersion);

      expect(keyHead).not.toBe(keyBase);
      expect(keyBaseBranch).not.toBe(keyBase);
      expect(keyVersion).not.toBe(keyBase);
    });
  });
});

describe('AnalysisCache', () => {
  let tempDir: string;
  let cache: AnalysisCache;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'diffesense-cache-test-'));
    cache = createCache(tempDir, { enabled: true });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  const sampleComponents: CacheKeyComponents = {
    repoPath: 'test-repo',
    headSha: 'abc123def456',
    base: 'main',
    scope: 'branch',
    toolVersion: '1.0.0',
    configHash: 'config-hash',
  };

  describe('get and set', () => {
    it('should return null for cache miss', () => {
      const result = cache.get(sampleComponents);
      expect(result).toBeNull();
    });

    it('should return cached data after set', () => {
      const data = { files: [], summary: { risk: 5 } };

      cache.set(sampleComponents, data, 100);
      const result = cache.get(sampleComponents);

      expect(result).not.toBeNull();
      expect(result?.data).toEqual(data);
    });

    it('should include metadata in cached result', () => {
      const data = { test: true };

      cache.set(sampleComponents, data, 250);
      const result = cache.get(sampleComponents);

      expect(result?.computeTimeMs).toBe(250);
      expect(result?.keyComponents).toEqual(sampleComponents);
      expect(result?.createdAt).toBeDefined();
    });
  });

  describe('invalidate', () => {
    it('should remove cached entry', () => {
      const data = { cached: true };

      cache.set(sampleComponents, data, 100);
      expect(cache.get(sampleComponents)).not.toBeNull();

      cache.invalidate(sampleComponents);
      expect(cache.get(sampleComponents)).toBeNull();
    });

    it('should return false for non-existent entry', () => {
      const result = cache.invalidate(sampleComponents);
      expect(result).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      const data = { test: true };

      cache.set(sampleComponents, data, 100);
      cache.set({ ...sampleComponents, headSha: 'different' }, data, 100);

      const cleared = cache.clear();
      expect(cleared).toBeGreaterThanOrEqual(2);

      expect(cache.get(sampleComponents)).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should track hits and misses', () => {
      cache.get(sampleComponents);
      cache.get(sampleComponents);

      cache.set(sampleComponents, { data: true }, 100);
      cache.get(sampleComponents);

      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(2);
    });

    it('should count entries', () => {
      cache.set(sampleComponents, { a: 1 }, 100);
      cache.set({ ...sampleComponents, headSha: 'other' }, { b: 2 }, 100);

      const stats = cache.getStats();
      expect(stats.entries).toBe(2);
    });
  });

  describe('disabled cache', () => {
    it('should not store when disabled', () => {
      const disabledCache = createCache(tempDir, { enabled: false });

      disabledCache.set(sampleComponents, { data: true }, 100);
      const result = disabledCache.get(sampleComponents);

      expect(result).toBeNull();
    });
  });
});

describe('buildCacheKeyComponents', () => {
  it('should build components from options', () => {
    const components = buildCacheKeyComponents({
      cwd: process.cwd(),
      scope: 'branch',
      base: 'main',
      toolVersion: '1.5.1',
      config: { threshold: 7.0 },
    });

    expect(components.scope).toBe('branch');
    expect(components.base).toBe('main');
    expect(components.toolVersion).toBe('1.5.1');
    expect(components.configHash).toBeDefined();
    expect(components.configHash).toHaveLength(16);
  });

  it('should include diff hash when provided', () => {
    const components = buildCacheKeyComponents({
      cwd: process.cwd(),
      scope: 'working',
      base: 'main',
      toolVersion: '1.5.1',
      config: {},
      diffContent: '+new line\n-old line',
    });

    expect(components.diffHash).toBeDefined();
    expect(components.diffHash).not.toBe('empty');
  });
});
