/**
 * DiffeSense Cache Module
 *
 * Provides caching for analysis results to improve performance.
 *
 * Usage:
 * ```typescript
 * import { AnalysisCache } from './cache';
 *
 * const cache = new AnalysisCache(repoRoot);
 *
 *
 * const cached = cache.get(keyComponents);
 * if (cached) {
 *   return cached.data;
 * }
 *
 *
 * const result = await analyze(...);
 *
 *
 * cache.set(keyComponents, result, computeTimeMs);
 * ```
 */

import * as path from 'path';
import { execSync } from 'child_process';
import {
  CacheKeyComponents,
  CachedResult,
  CacheConfig,
  CacheStats,
  DEFAULT_CACHE_CONFIG,
} from './types';
import { generateCacheKey, hashConfig, hashDiff } from './hash';
import {
  readCache,
  writeCache,
  deleteCache,
  clearCache,
  getCacheStats,
  cleanupCache,
  ensureCacheDir,
} from './storage';

export * from './types';
export * from './hash';

/**
 * Analysis cache manager
 */
export class AnalysisCache {
  private readonly cacheDir: string;
  private readonly config: CacheConfig;
  private hits = 0;
  private misses = 0;

  constructor(repoRoot: string, config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
    this.cacheDir = path.join(repoRoot, this.config.cacheDir);
  }

  /**
   * Get cached result if available
   */
  get<T>(components: CacheKeyComponents): CachedResult<T> | null {
    if (!this.config.enabled) {
      return null;
    }

    const key = generateCacheKey(components);
    const cached = readCache<T>(this.cacheDir, key, this.config);

    if (cached) {
      this.hits++;
      return cached;
    }

    this.misses++;
    return null;
  }

  /**
   * Store result in cache
   */
  set<T>(components: CacheKeyComponents, data: T, computeTimeMs: number): boolean {
    if (!this.config.enabled) {
      return false;
    }

    const key = generateCacheKey(components);

    const entry: CachedResult<T> = {
      key,
      data,
      createdAt: new Date().toISOString(),
      version: this.config.version,
      computeTimeMs,
      keyComponents: components,
    };

    return writeCache(this.cacheDir, entry);
  }

  /**
   * Invalidate cache entry
   */
  invalidate(components: CacheKeyComponents): boolean {
    const key = generateCacheKey(components);
    return deleteCache(this.cacheDir, key);
  }

  /**
   * Clear all cache entries
   */
  clear(): number {
    return clearCache(this.cacheDir);
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const stats = getCacheStats(this.cacheDir);
    stats.hits = this.hits;
    stats.misses = this.misses;
    return stats;
  }

  /**
   * Cleanup old entries
   */
  cleanup(): number {
    return cleanupCache(this.cacheDir, this.config);
  }

  /**
   * Get cache directory path
   */
  getCacheDir(): string {
    return this.cacheDir;
  }

  /**
   * Check if caching is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }
}

/**
 * Build cache key components for an analysis run
 */
export function buildCacheKeyComponents(options: {
  cwd: string;
  scope: string;
  base: string;
  toolVersion: string;
  config: Record<string, unknown>;
  diffContent?: string;
  suppressionsHash?: string;
}): CacheKeyComponents {
  const { cwd, scope, base, toolVersion, config, diffContent, suppressionsHash } = options;

  let headSha = 'unknown';
  try {
    headSha = execSync('git rev-parse HEAD', {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {}

  let repoPath = cwd;
  try {
    repoPath = execSync('git rev-parse --show-toplevel', {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {}

  return {
    repoPath: path.basename(repoPath),
    headSha,
    base,
    scope,
    toolVersion,
    configHash: hashConfig(config),
    diffHash: diffContent ? hashDiff(diffContent) : undefined,
    suppressionsHash,
  };
}

/**
 * Create a new cache instance for a repository
 */
export function createCache(repoRoot: string, config?: Partial<CacheConfig>): AnalysisCache {
  return new AnalysisCache(repoRoot, config);
}
