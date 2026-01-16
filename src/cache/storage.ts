/**
 * Cache Storage
 *
 * File-based cache storage for DiffeSense analysis results.
 */

import * as fs from 'fs';
import * as path from 'path';
import { CachedResult, CacheConfig, CacheStats, DEFAULT_CACHE_CONFIG } from './types';

/**
 * Ensure cache directory exists
 */
export function ensureCacheDir(cacheDir: string): void {
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
}

/**
 * Get cache file path for a key
 */
export function getCacheFilePath(cacheDir: string, key: string): string {
  return path.join(cacheDir, `${key}.json`);
}

/**
 * Read cached result from disk
 *
 * Returns null if cache miss or invalid.
 */
export function readCache<T>(
  cacheDir: string,
  key: string,
  config: CacheConfig = DEFAULT_CACHE_CONFIG,
): CachedResult<T> | null {
  const filePath = getCacheFilePath(cacheDir, key);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const cached = JSON.parse(content) as CachedResult<T>;

    // Validate cache entry
    if (!cached || !cached.key || !cached.data) {
      return null;
    }

    // Check version
    if (cached.version !== config.version) {
      // Cache invalidated by version bump
      fs.unlinkSync(filePath);
      return null;
    }

    // Check age
    const age = Date.now() - new Date(cached.createdAt).getTime();
    if (age > config.maxAgeMs) {
      // Cache expired
      fs.unlinkSync(filePath);
      return null;
    }

    return cached;
  } catch {
    // Invalid cache file, remove it
    try {
      fs.unlinkSync(filePath);
    } catch {
      // Ignore cleanup errors
    }
    return null;
  }
}

/**
 * Write result to cache
 */
export function writeCache<T>(cacheDir: string, result: CachedResult<T>): boolean {
  ensureCacheDir(cacheDir);

  const filePath = getCacheFilePath(cacheDir, result.key);

  try {
    const content = JSON.stringify(result, null, 2);
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete a cache entry
 */
export function deleteCache(cacheDir: string, key: string): boolean {
  const filePath = getCacheFilePath(cacheDir, key);

  if (!fs.existsSync(filePath)) {
    return false;
  }

  try {
    fs.unlinkSync(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Clear all cache entries
 */
export function clearCache(cacheDir: string): number {
  if (!fs.existsSync(cacheDir)) {
    return 0;
  }

  let cleared = 0;

  try {
    const files = fs.readdirSync(cacheDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          fs.unlinkSync(path.join(cacheDir, file));
          cleared++;
        } catch {
          // Ignore individual file errors
        }
      }
    }
  } catch {
    // Ignore directory errors
  }

  return cleared;
}

/**
 * Get cache statistics
 */
export function getCacheStats(cacheDir: string): CacheStats {
  const stats: CacheStats = {
    hits: 0,
    misses: 0,
    entries: 0,
    sizeBytes: 0,
    lastCleanup: null,
  };

  if (!fs.existsSync(cacheDir)) {
    return stats;
  }

  try {
    const files = fs.readdirSync(cacheDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        stats.entries++;
        try {
          const filePath = path.join(cacheDir, file);
          const fileStat = fs.statSync(filePath);
          stats.sizeBytes += fileStat.size;
        } catch {
          // Ignore stat errors
        }
      }
    }
  } catch {
    // Ignore directory errors
  }

  return stats;
}

/**
 * Cleanup old cache entries
 *
 * Removes entries older than maxAgeMs and trims to maxEntries.
 */
export function cleanupCache(cacheDir: string, config: CacheConfig = DEFAULT_CACHE_CONFIG): number {
  if (!fs.existsSync(cacheDir)) {
    return 0;
  }

  let removed = 0;
  const now = Date.now();

  try {
    const files = fs
      .readdirSync(cacheDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        const filePath = path.join(cacheDir, f);
        try {
          const stat = fs.statSync(filePath);
          return { name: f, path: filePath, mtime: stat.mtimeMs };
        } catch {
          return null;
        }
      })
      .filter((f): f is NonNullable<typeof f> => f !== null)
      .sort((a, b) => b.mtime - a.mtime); // Newest first

    // Remove old entries
    for (const file of files) {
      const age = now - file.mtime;
      if (age > config.maxAgeMs) {
        try {
          fs.unlinkSync(file.path);
          removed++;
        } catch {
          // Ignore
        }
      }
    }

    // Trim to maxEntries (keep newest)
    const remaining = files.filter((f) => {
      const age = now - f.mtime;
      return age <= config.maxAgeMs;
    });

    if (remaining.length > config.maxEntries) {
      const toRemove = remaining.slice(config.maxEntries);
      for (const file of toRemove) {
        try {
          fs.unlinkSync(file.path);
          removed++;
        } catch {
          // Ignore
        }
      }
    }
  } catch {
    // Ignore directory errors
  }

  return removed;
}
