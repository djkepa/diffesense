/**
 * Cache Types
 *
 * Type definitions for the DiffeSense caching system.
 */

/**
 * Cache key components used to generate unique cache identifiers
 */
export interface CacheKeyComponents {
  /** Git repository root path */
  repoPath: string;
  /** Git HEAD commit SHA */
  headSha: string;
  /** Base branch or commit for comparison */
  base: string;
  /** Analysis scope (branch, staged, working, etc.) */
  scope: string;
  /** DiffeSense version */
  toolVersion: string;
  /** Serialized config affecting analysis */
  configHash: string;
  /** Optional: diff content hash for working/staged changes */
  diffHash?: string;
  /** Optional: suppressions hash for cache invalidation */
  suppressionsHash?: string;
}

/**
 * Cached analysis result with metadata
 */
export interface CachedResult<T = unknown> {
  /** Unique cache key */
  key: string;
  /** Cached data */
  data: T;
  /** When the cache entry was created */
  createdAt: string;
  /** Cache entry version (for invalidation) */
  version: number;
  /** Time to compute original result (ms) */
  computeTimeMs: number;
  /** Components used to generate cache key */
  keyComponents: CacheKeyComponents;
}

/**
 * Cache statistics for monitoring
 */
export interface CacheStats {
  /** Number of cache hits */
  hits: number;
  /** Number of cache misses */
  misses: number;
  /** Number of cache entries */
  entries: number;
  /** Total size of cache in bytes */
  sizeBytes: number;
  /** Last cleanup timestamp */
  lastCleanup: string | null;
}

/**
 * Cache configuration options
 */
export interface CacheConfig {
  /** Enable/disable caching */
  enabled: boolean;
  /** Cache directory path (relative to repo root) */
  cacheDir: string;
  /** Maximum age of cache entries in milliseconds */
  maxAgeMs: number;
  /** Maximum number of cache entries */
  maxEntries: number;
  /** Current cache version (bump to invalidate all) */
  version: number;
}

/**
 * Default cache configuration
 */
export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  enabled: true,
  cacheDir: '.diffesense/cache',
  maxAgeMs: 24 * 60 * 60 * 1000, // 24 hours
  maxEntries: 100,
  version: 1,
};
