/**
 * Cache Hashing Utilities
 *
 * Functions for generating deterministic cache keys.
 */

import * as crypto from 'crypto';
import { CacheKeyComponents } from './types';

/**
 * Compute SHA256 hash of a string
 */
export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Compute short hash (first 16 chars of SHA256)
 */
export function shortHash(input: string): string {
  return sha256(input).substring(0, 16);
}

/**
 * Generate cache key from components
 *
 * The key is deterministic and changes when any component changes.
 */
export function generateCacheKey(components: CacheKeyComponents): string {
  const parts = [
    components.repoPath,
    components.headSha,
    components.base,
    components.scope,
    components.toolVersion,
    components.configHash,
    components.diffHash || '',
    components.suppressionsHash || '',
  ];

  const combined = parts.join('|');
  return shortHash(combined);
}

/**
 * Recursively sort object keys for deterministic serialization
 *
 * This is critical for cache correctness - nested objects must also
 * have their keys sorted, otherwise config changes might not invalidate cache.
 */
function stableStringifyDeep(obj: unknown): string {
  if (obj === null || obj === undefined) {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return '[' + obj.map((item) => stableStringifyDeep(item)).join(',') + ']';
  }

  if (typeof obj === 'object') {
    const sortedKeys = Object.keys(obj as Record<string, unknown>).sort();
    const pairs = sortedKeys.map((key) => {
      const value = (obj as Record<string, unknown>)[key];
      return JSON.stringify(key) + ':' + stableStringifyDeep(value);
    });
    return '{' + pairs.join(',') + '}';
  }

  // Primitives (string, number, boolean)
  return JSON.stringify(obj);
}

/**
 * Hash configuration object for cache key
 *
 * Uses deep stable stringify to ensure nested objects are also sorted.
 * This prevents cache hits when config has actually changed.
 */
export function hashConfig(config: Record<string, unknown>): string {
  const sorted = stableStringifyDeep(config);
  return shortHash(sorted);
}

/**
 * Hash diff content for cache key
 *
 * Used for working/staged changes where diff content determines cache validity.
 */
export function hashDiff(diffContent: string): string {
  if (!diffContent || diffContent.trim() === '') {
    return 'empty';
  }
  return shortHash(diffContent);
}
