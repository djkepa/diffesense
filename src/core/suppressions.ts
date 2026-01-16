/**
 * Suppressions Module
 *
 * Manages signal suppressions for reducing noise and handling known issues.
 *
 * Storage layers (in order of precedence):
 * 1. Project local (gitignored): .diffesense/suppressions.json
 * 2. Global: ~/.config/diffesense/suppressions.json
 *
 * Features:
 * - Time-based expiration (--expires-in)
 * - Glob-based file matching
 * - Security signal friction (requires reason)
 * - Auto-cleanup of expired suppressions
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createHash } from 'crypto';
import { minimatch } from 'minimatch';
import { z } from 'zod';

export const SUPPRESSIONS_SCHEMA_VERSION = 1;

export const SuppressionEntrySchema = z.object({
  signalId: z.string().describe('Signal ID or pattern to suppress'),
  fileGlob: z.string().optional().describe('Optional file glob pattern'),
  reason: z.string().optional().describe('Reason for suppression'),
  createdAt: z.string().describe('ISO timestamp when created'),
  expiresAt: z.string().optional().describe('ISO timestamp when expires'),
  createdBy: z.string().optional().describe('User who created the suppression'),
});

export type SuppressionEntry = z.infer<typeof SuppressionEntrySchema>;

export const SuppressionsFileSchema = z.object({
  version: z.number().describe('Schema version'),
  suppressions: z.array(SuppressionEntrySchema).describe('List of suppressions'),
});

export type SuppressionsFile = z.infer<typeof SuppressionsFileSchema>;

export type SuppressionScope = 'local' | 'global';

export interface AddSuppressionOptions {
  signalId: string;
  fileGlob?: string;
  reason?: string;
  expiresIn?: string;
  scope?: SuppressionScope;
  force?: boolean;
}

export interface RemoveSuppressionOptions {
  signalId: string;
  fileGlob?: string;
  scope?: SuppressionScope;
}

export interface SuppressionMatch {
  entry: SuppressionEntry;
  scope: SuppressionScope;
  specificity?: number;
}

const LOCAL_SUPPRESSIONS_DIR = '.diffesense';
const LOCAL_SUPPRESSIONS_FILE = 'suppressions.json';
const GLOBAL_CONFIG_DIR = path.join(os.homedir(), '.config', 'diffesense');
const GLOBAL_SUPPRESSIONS_FILE = 'suppressions.json';

/**
 * Get the path to the local suppressions file
 */
export function getLocalSuppressionsPath(cwd: string): string {
  return path.join(cwd, LOCAL_SUPPRESSIONS_DIR, LOCAL_SUPPRESSIONS_FILE);
}

/**
 * Get the path to the global suppressions file
 */
export function getGlobalSuppressionsPath(): string {
  return path.join(GLOBAL_CONFIG_DIR, GLOBAL_SUPPRESSIONS_FILE);
}

/**
 * Normalize path for cross-platform matching (Windows -> Unix style)
 */
export function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

/**
 * Get current username safely (works in CI/minimal environments)
 */
function getCurrentUsername(): string {
  try {
    return os.userInfo().username;
  } catch {
    return process.env.USER || process.env.USERNAME || 'unknown';
  }
}

/**
 * Create canonical key for suppression (for deduplication)
 */
export function getSuppressionKey(signalId: string, fileGlob?: string): string {
  const normalizedGlob = fileGlob ? normalizePath(fileGlob) : '';
  return `${signalId.toLowerCase()}::${normalizedGlob.toLowerCase()}`;
}

/**
 * Sort suppressions for stable file output (prevents merge conflicts)
 */
function sortSuppressions(suppressions: SuppressionEntry[]): SuppressionEntry[] {
  return [...suppressions].sort((a, b) => {
    const sigCmp = a.signalId.localeCompare(b.signalId);
    if (sigCmp !== 0) return sigCmp;

    const globA = a.fileGlob || '';
    const globB = b.fileGlob || '';
    const globCmp = globA.localeCompare(globB);
    if (globCmp !== 0) return globCmp;

    return a.createdAt.localeCompare(b.createdAt);
  });
}

/**
 * Check if running on Windows (for case-insensitive matching)
 */
function isWindows(): boolean {
  return process.platform === 'win32';
}

/**
 * Calculate specificity score for a suppression
 *
 * Higher score = more specific match
 * - No glob (applies to all files): 0
 * - Glob with wildcards: based on concrete path segments
 * - Exact file path: highest
 *
 * This ensures "most specific match wins" behavior
 */
export function calculateSpecificity(glob: string | undefined): number {
  if (!glob) return 0;

  const normalized = normalizePath(glob);

  // Count concrete path segments (non-wildcard)
  const segments = normalized.split('/').filter((s) => s.length > 0);
  let score = 0;

  for (const seg of segments) {
    if (seg === '**') {
      // Double wildcard: low specificity
      score += 1;
    } else if (seg === '*') {
      // Single wildcard: low specificity
      score += 1;
    } else if (seg.includes('*')) {
      // Partial wildcard (e.g., *.ts): medium specificity
      score += 5;
    } else {
      // Concrete segment: high specificity
      score += 10;
    }
  }

  // Bonus for exact file match (no wildcards at all)
  if (!normalized.includes('*')) {
    score += 50;
  }

  return score;
}

/**
 * Parse duration string to milliseconds
 * Supports: 1d, 7d, 30d, 1w, 2w, etc.
 */
export function parseDuration(duration: string): number | null {
  const match = duration.match(/^(\d+)(d|w|m|h)$/);
  if (!match) return null;

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    case 'w':
      return value * 7 * 24 * 60 * 60 * 1000;
    case 'm':
      return value * 30 * 24 * 60 * 60 * 1000;
    default:
      return null;
  }
}

/**
 * Load suppressions from a file with validation
 */
export function loadSuppressionsFile(filePath: string): SuppressionsFile | null {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(content);

    const result = SuppressionsFileSchema.safeParse(parsed);
    if (!result.success) {
      console.warn(`Warning: Invalid suppressions file at ${filePath}: ${result.error.message}`);
      return null;
    }

    return result.data;
  } catch (error) {
    console.warn(`Warning: Could not read suppressions file at ${filePath}`);
    return null;
  }
}

/**
 * Save suppressions to a file
 */
export function saveSuppressionsFile(filePath: string, data: SuppressionsFile): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Create empty suppressions file
 */
export function createEmptySuppressionsFile(): SuppressionsFile {
  return {
    version: SUPPRESSIONS_SCHEMA_VERSION,
    suppressions: [],
  };
}

/**
 * Check if a suppression is expired
 */
export function isExpired(entry: SuppressionEntry): boolean {
  if (!entry.expiresAt) return false;
  return new Date(entry.expiresAt) < new Date();
}

/**
 * Check if a signal matches a suppression entry
 */
export function matchesSuppression(
  signalId: string,
  filePath: string,
  entry: SuppressionEntry,
): boolean {
  if (isExpired(entry)) return false;

  const signalPattern = entry.signalId;
  const signalMatches =
    signalPattern === signalId ||
    signalPattern === '*' ||
    (signalPattern.includes('*') && minimatch(signalId, signalPattern));

  if (!signalMatches) return false;

  if (!entry.fileGlob) return true;

  const normalizedPath = normalizePath(filePath);
  const normalizedGlob = normalizePath(entry.fileGlob);

  // Use case-insensitive matching on Windows
  return minimatch(normalizedPath, normalizedGlob, {
    dot: true,
    nocase: isWindows(),
  });
}

/**
 * Load all suppressions (global + local, with local taking precedence)
 */
export function loadAllSuppressions(cwd: string): {
  local: SuppressionsFile | null;
  global: SuppressionsFile | null;
} {
  const localPath = getLocalSuppressionsPath(cwd);
  const globalPath = getGlobalSuppressionsPath();

  return {
    local: loadSuppressionsFile(localPath),
    global: loadSuppressionsFile(globalPath),
  };
}

/**
 * Get all active (non-expired) suppressions
 *
 * Returns suppressions ordered by precedence:
 * 1. Global suppressions first (lower priority)
 * 2. Local suppressions second (higher priority, can override global)
 *
 * Each suppression includes a specificity score for fine-grained precedence.
 * When checking if a signal is suppressed, the LAST matching entry wins,
 * which means local entries override global ones.
 */
export function getActiveSuppressions(cwd: string): SuppressionMatch[] {
  const { local, global } = loadAllSuppressions(cwd);
  const result: SuppressionMatch[] = [];

  // Global first (lower priority - will be checked first but overridden by later matches)
  if (global) {
    for (const entry of global.suppressions) {
      if (!isExpired(entry)) {
        result.push({
          entry,
          scope: 'global',
          specificity: calculateSpecificity(entry.fileGlob),
        });
      }
    }
  }

  // Local second (higher priority - last match wins)
  if (local) {
    for (const entry of local.suppressions) {
      if (!isExpired(entry)) {
        result.push({
          entry,
          scope: 'local',
          specificity: calculateSpecificity(entry.fileGlob),
        });
      }
    }
  }

  return result;
}

/**
 * Check if a signal should be suppressed
 *
 * Precedence rules:
 * 1. Local suppressions override global (scope precedence)
 * 2. Within the same scope, more specific globs win (specificity precedence)
 * 3. If equal specificity, later entries win (order precedence)
 *
 * This is achieved by:
 * - Collecting all matching suppressions
 * - Sorting by scope (local > global), then specificity (higher wins)
 * - Returning the best match
 */
export function isSuppressed(
  signalId: string,
  filePath: string,
  suppressions: SuppressionMatch[],
): SuppressionMatch | null {
  // Collect all matching suppressions
  const matches: SuppressionMatch[] = [];

  for (const supp of suppressions) {
    if (matchesSuppression(signalId, filePath, supp.entry)) {
      matches.push(supp);
    }
  }

  if (matches.length === 0) return null;

  // Sort by precedence: local > global, then by specificity (higher wins)
  matches.sort((a, b) => {
    // Local always beats global
    if (a.scope !== b.scope) {
      return a.scope === 'local' ? 1 : -1;
    }

    // Within same scope, higher specificity wins
    const specA = a.specificity ?? 0;
    const specB = b.specificity ?? 0;
    return specA - specB;
  });

  // Return the best match (last after sorting)
  return matches[matches.length - 1];
}

/**
 * Check if a signal ID is security-related (requires reason)
 */
export function isSecuritySignal(signalId: string): boolean {
  const securityPrefixes = ['sec-', 'security-', 'auth-', 'xss-', 'sqli-', 'csrf-'];
  const securityKeywords = [
    'injection',
    'credential',
    'password',
    'token',
    'secret',
    'vulnerability',
  ];

  const lowerId = signalId.toLowerCase();

  if (securityPrefixes.some((prefix) => lowerId.startsWith(prefix))) {
    return true;
  }

  return securityKeywords.some((kw) => lowerId.includes(kw));
}

/**
 * Add a suppression
 */
export function addSuppression(
  cwd: string,
  options: AddSuppressionOptions,
): { success: boolean; message: string } {
  const scope = options.scope || 'local';
  const filePath = scope === 'local' ? getLocalSuppressionsPath(cwd) : getGlobalSuppressionsPath();

  if (isSecuritySignal(options.signalId) && !options.reason) {
    return {
      success: false,
      message: `Security signal "${options.signalId}" requires a --reason. Please provide a justification.`,
    };
  }

  let data = loadSuppressionsFile(filePath) || createEmptySuppressionsFile();

  // Use canonical key for duplicate detection
  const newKey = getSuppressionKey(options.signalId, options.fileGlob);
  const existing = data.suppressions.find(
    (s) => getSuppressionKey(s.signalId, s.fileGlob) === newKey,
  );

  if (existing && !options.force) {
    return {
      success: false,
      message: `Suppression already exists for "${options.signalId}"${
        options.fileGlob ? ` with file pattern "${options.fileGlob}"` : ''
      }. Use --force to update.`,
    };
  }

  let expiresAt: string | undefined;
  if (options.expiresIn) {
    const duration = parseDuration(options.expiresIn);
    if (!duration) {
      return {
        success: false,
        message: `Invalid duration format: "${options.expiresIn}". Use format like "7d", "2w", "30d".`,
      };
    }
    expiresAt = new Date(Date.now() + duration).toISOString();
  } else if (isSecuritySignal(options.signalId)) {
    expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  }

  const newEntry: SuppressionEntry = {
    signalId: options.signalId,
    fileGlob: options.fileGlob,
    reason: options.reason,
    createdAt: new Date().toISOString(),
    expiresAt,
    createdBy: getCurrentUsername(),
  };

  if (existing) {
    const index = data.suppressions.indexOf(existing);
    data.suppressions[index] = newEntry;
  } else {
    data.suppressions.push(newEntry);
  }

  data.suppressions = sortSuppressions(data.suppressions);

  saveSuppressionsFile(filePath, data);

  const expiresMsg = expiresAt
    ? ` (expires: ${new Date(expiresAt).toLocaleDateString()})`
    : ' (no expiration)';

  return {
    success: true,
    message: `Suppression added for "${options.signalId}"${
      options.fileGlob ? ` matching "${options.fileGlob}"` : ''
    }${expiresMsg}`,
  };
}

/**
 * Remove a suppression
 */
export function removeSuppression(
  cwd: string,
  options: RemoveSuppressionOptions,
): { success: boolean; message: string } {
  const scope = options.scope || 'local';
  const filePath = scope === 'local' ? getLocalSuppressionsPath(cwd) : getGlobalSuppressionsPath();

  const data = loadSuppressionsFile(filePath);
  if (!data) {
    return {
      success: false,
      message: `No suppressions file found at ${scope} scope.`,
    };
  }

  const initialCount = data.suppressions.length;
  const removeKey = getSuppressionKey(options.signalId, options.fileGlob);
  data.suppressions = data.suppressions.filter(
    (s) => getSuppressionKey(s.signalId, s.fileGlob) !== removeKey,
  );

  if (data.suppressions.length === initialCount) {
    return {
      success: false,
      message: `No suppression found for "${options.signalId}"${
        options.fileGlob ? ` with pattern "${options.fileGlob}"` : ''
      }.`,
    };
  }

  saveSuppressionsFile(filePath, data);

  return {
    success: true,
    message: `Suppression removed for "${options.signalId}"${
      options.fileGlob ? ` matching "${options.fileGlob}"` : ''
    }.`,
  };
}

/**
 * List all suppressions
 */
export function listSuppressions(
  cwd: string,
  scope?: SuppressionScope,
): {
  local: SuppressionEntry[];
  global: SuppressionEntry[];
  expired: { entry: SuppressionEntry; scope: SuppressionScope }[];
} {
  const { local, global } = loadAllSuppressions(cwd);
  const expired: { entry: SuppressionEntry; scope: SuppressionScope }[] = [];

  const localEntries = local?.suppressions || [];
  const globalEntries = global?.suppressions || [];

  for (const entry of localEntries) {
    if (isExpired(entry)) {
      expired.push({ entry, scope: 'local' });
    }
  }
  for (const entry of globalEntries) {
    if (isExpired(entry)) {
      expired.push({ entry, scope: 'global' });
    }
  }

  if (scope === 'local') {
    return { local: localEntries, global: [], expired };
  }
  if (scope === 'global') {
    return { local: [], global: globalEntries, expired };
  }

  return { local: localEntries, global: globalEntries, expired };
}

/**
 * Clean expired suppressions
 */
export function cleanExpiredSuppressions(
  cwd: string,
  scope?: SuppressionScope,
): { removed: number; message: string } {
  let removed = 0;

  const cleanScope = (s: SuppressionScope) => {
    const filePath = s === 'local' ? getLocalSuppressionsPath(cwd) : getGlobalSuppressionsPath();
    const data = loadSuppressionsFile(filePath);
    if (!data) return;

    const before = data.suppressions.length;
    data.suppressions = data.suppressions.filter((entry) => !isExpired(entry));
    const after = data.suppressions.length;

    if (before !== after) {
      saveSuppressionsFile(filePath, data);
      removed += before - after;
    }
  };

  if (!scope || scope === 'local') {
    cleanScope('local');
  }
  if (!scope || scope === 'global') {
    cleanScope('global');
  }

  return {
    removed,
    message:
      removed > 0 ? `Cleaned ${removed} expired suppression(s).` : 'No expired suppressions.',
  };
}

/**
 * Calculate hash of all suppressions (for cache invalidation)
 */
export function getSuppressionsHash(cwd: string): string {
  const { local, global } = loadAllSuppressions(cwd);

  const content = JSON.stringify({
    local: local?.suppressions || [],
    global: global?.suppressions || [],
  });

  return createHash('sha256').update(content).digest('hex').substring(0, 16);
}

/**
 * Apply suppressions to signals array
 * Returns filtered signals and stats
 */
export function applySuppressions<T extends { id: string }>(
  signals: T[],
  filePath: string,
  suppressions: SuppressionMatch[],
): {
  active: T[];
  suppressed: T[];
  stats: { total: number; suppressed: number; active: number };
} {
  const active: T[] = [];
  const suppressed: T[] = [];

  for (const signal of signals) {
    if (isSuppressed(signal.id, filePath, suppressions)) {
      suppressed.push(signal);
    } else {
      active.push(signal);
    }
  }

  return {
    active,
    suppressed,
    stats: {
      total: signals.length,
      suppressed: suppressed.length,
      active: active.length,
    },
  };
}
