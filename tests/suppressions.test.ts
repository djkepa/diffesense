import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  normalizePath,
  parseDuration,
  isExpired,
  matchesSuppression,
  isSecuritySignal,
  loadSuppressionsFile,
  saveSuppressionsFile,
  createEmptySuppressionsFile,
  addSuppression,
  removeSuppression,
  listSuppressions,
  cleanExpiredSuppressions,
  getSuppressionsHash,
  applySuppressions,
  getActiveSuppressions,
  isSuppressed,
  getSuppressionKey,
  calculateSpecificity,
  SuppressionEntry,
  SuppressionMatch,
} from '../src/core/suppressions';

describe('Suppressions Module', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'diffesense-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('normalizePath', () => {
    it('should convert Windows backslashes to forward slashes', () => {
      expect(normalizePath('src\\components\\Button.tsx')).toBe('src/components/Button.tsx');
      expect(normalizePath('src\\a\\b.ts')).toBe('src/a/b.ts');
    });

    it('should leave Unix paths unchanged', () => {
      expect(normalizePath('src/components/Button.tsx')).toBe('src/components/Button.tsx');
    });

    it('should handle mixed slashes', () => {
      expect(normalizePath('src\\components/Button.tsx')).toBe('src/components/Button.tsx');
    });
  });

  describe('parseDuration', () => {
    it('should parse days', () => {
      expect(parseDuration('7d')).toBe(7 * 24 * 60 * 60 * 1000);
      expect(parseDuration('30d')).toBe(30 * 24 * 60 * 60 * 1000);
    });

    it('should parse weeks', () => {
      expect(parseDuration('1w')).toBe(7 * 24 * 60 * 60 * 1000);
      expect(parseDuration('2w')).toBe(14 * 24 * 60 * 60 * 1000);
    });

    it('should parse months', () => {
      expect(parseDuration('1m')).toBe(30 * 24 * 60 * 60 * 1000);
    });

    it('should parse hours', () => {
      expect(parseDuration('24h')).toBe(24 * 60 * 60 * 1000);
    });

    it('should return null for invalid format', () => {
      expect(parseDuration('invalid')).toBeNull();
      expect(parseDuration('7x')).toBeNull();
      expect(parseDuration('')).toBeNull();
    });
  });

  describe('isExpired', () => {
    it('should return false for entries without expiresAt', () => {
      const entry: SuppressionEntry = {
        signalId: 'test-signal',
        createdAt: new Date().toISOString(),
      };
      expect(isExpired(entry)).toBe(false);
    });

    it('should return true for expired entries', () => {
      const entry: SuppressionEntry = {
        signalId: 'test-signal',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() - 1000).toISOString(), // 1 second ago
      };
      expect(isExpired(entry)).toBe(true);
    });

    it('should return false for non-expired entries', () => {
      const entry: SuppressionEntry = {
        signalId: 'test-signal',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 1000000).toISOString(), // Future
      };
      expect(isExpired(entry)).toBe(false);
    });
  });

  describe('matchesSuppression', () => {
    it('should match exact signal ID', () => {
      const entry: SuppressionEntry = {
        signalId: 'large-file',
        createdAt: new Date().toISOString(),
      };
      expect(matchesSuppression('large-file', 'any/path.ts', entry)).toBe(true);
      expect(matchesSuppression('deep-nesting', 'any/path.ts', entry)).toBe(false);
    });

    it('should match wildcard signal ID', () => {
      const entry: SuppressionEntry = {
        signalId: '*',
        createdAt: new Date().toISOString(),
      };
      expect(matchesSuppression('any-signal', 'any/path.ts', entry)).toBe(true);
    });

    it('should match pattern signal ID', () => {
      const entry: SuppressionEntry = {
        signalId: 'sec-*',
        createdAt: new Date().toISOString(),
      };
      expect(matchesSuppression('sec-xss', 'any/path.ts', entry)).toBe(true);
      expect(matchesSuppression('sec-injection', 'any/path.ts', entry)).toBe(true);
      expect(matchesSuppression('large-file', 'any/path.ts', entry)).toBe(false);
    });

    it('should match file glob pattern', () => {
      const entry: SuppressionEntry = {
        signalId: 'large-file',
        fileGlob: 'src/generated/**',
        createdAt: new Date().toISOString(),
      };
      expect(matchesSuppression('large-file', 'src/generated/types.ts', entry)).toBe(true);
      expect(matchesSuppression('large-file', 'src/components/Button.tsx', entry)).toBe(false);
    });

    it('should not match expired entries', () => {
      const entry: SuppressionEntry = {
        signalId: 'large-file',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() - 1000).toISOString(), // Expired
      };
      expect(matchesSuppression('large-file', 'any/path.ts', entry)).toBe(false);
    });

    it('should handle Windows paths with normalization', () => {
      const entry: SuppressionEntry = {
        signalId: 'large-file',
        fileGlob: 'src/a/**',
        createdAt: new Date().toISOString(),
      };
      // Windows path
      expect(matchesSuppression('large-file', 'src\\a\\b.ts', entry)).toBe(true);
    });

    // Golden glob examples (real-world patterns)
    describe('Golden glob patterns', () => {
      it('should match src/generated/** pattern', () => {
        const entry: SuppressionEntry = {
          signalId: 'large-file',
          fileGlob: 'src/generated/**',
          createdAt: new Date().toISOString(),
        };
        expect(matchesSuppression('large-file', 'src/generated/types.ts', entry)).toBe(true);
        expect(matchesSuppression('large-file', 'src/generated/api/client.ts', entry)).toBe(true);
        expect(matchesSuppression('large-file', 'src/components/Button.tsx', entry)).toBe(false);
      });

      it('should match **/*.test.ts pattern', () => {
        const entry: SuppressionEntry = {
          signalId: 'console-log',
          fileGlob: '**/*.test.ts',
          createdAt: new Date().toISOString(),
        };
        expect(matchesSuppression('console-log', 'src/utils.test.ts', entry)).toBe(true);
        expect(matchesSuppression('console-log', 'tests/unit/auth.test.ts', entry)).toBe(true);
        expect(matchesSuppression('console-log', 'src/utils.ts', entry)).toBe(false);
      });

      it('should match packages/*/src/** monorepo pattern', () => {
        const entry: SuppressionEntry = {
          signalId: 'deep-nesting',
          fileGlob: 'packages/*/src/**',
          createdAt: new Date().toISOString(),
        };
        expect(matchesSuppression('deep-nesting', 'packages/core/src/index.ts', entry)).toBe(true);
        expect(matchesSuppression('deep-nesting', 'packages/ui/src/Button.tsx', entry)).toBe(true);
        expect(matchesSuppression('deep-nesting', 'packages/core/tests/index.test.ts', entry)).toBe(
          false,
        );
        expect(matchesSuppression('deep-nesting', 'src/index.ts', entry)).toBe(false);
      });

      it('should match specific file extension pattern', () => {
        const entry: SuppressionEntry = {
          signalId: 'magic-number',
          fileGlob: '**/*.config.{js,ts}',
          createdAt: new Date().toISOString(),
        };
        expect(matchesSuppression('magic-number', 'jest.config.js', entry)).toBe(true);
        expect(matchesSuppression('magic-number', 'vite.config.ts', entry)).toBe(true);
        expect(matchesSuppression('magic-number', 'src/config.ts', entry)).toBe(false);
      });
    });
  });

  describe('isSecuritySignal', () => {
    it('should identify security prefixes', () => {
      expect(isSecuritySignal('sec-xss')).toBe(true);
      expect(isSecuritySignal('security-issue')).toBe(true);
      expect(isSecuritySignal('auth-bypass')).toBe(true);
      expect(isSecuritySignal('xss-innerHTML')).toBe(true);
    });

    it('should identify security keywords', () => {
      expect(isSecuritySignal('command-injection')).toBe(true);
      expect(isSecuritySignal('credential-leak')).toBe(true);
      expect(isSecuritySignal('password-exposed')).toBe(true);
    });

    it('should not match non-security signals', () => {
      expect(isSecuritySignal('large-file')).toBe(false);
      expect(isSecuritySignal('deep-nesting')).toBe(false);
      expect(isSecuritySignal('async-modified')).toBe(false);
    });
  });

  describe('File operations', () => {
    it('should create and load suppressions file', () => {
      const filePath = path.join(tempDir, '.diffesense', 'suppressions.json');
      const data = createEmptySuppressionsFile();
      data.suppressions.push({
        signalId: 'test-signal',
        reason: 'Testing',
        createdAt: new Date().toISOString(),
      });

      saveSuppressionsFile(filePath, data);
      const loaded = loadSuppressionsFile(filePath);

      expect(loaded).not.toBeNull();
      expect(loaded?.version).toBe(1);
      expect(loaded?.suppressions).toHaveLength(1);
      expect(loaded?.suppressions[0].signalId).toBe('test-signal');
    });

    it('should return null for non-existent file', () => {
      const loaded = loadSuppressionsFile(path.join(tempDir, 'nonexistent.json'));
      expect(loaded).toBeNull();
    });

    it('should handle invalid JSON gracefully', () => {
      const filePath = path.join(tempDir, 'invalid.json');
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, '{ invalid json }');

      const loaded = loadSuppressionsFile(filePath);
      expect(loaded).toBeNull();
    });
  });

  describe('addSuppression', () => {
    it('should add a new suppression', () => {
      const result = addSuppression(tempDir, {
        signalId: 'large-file',
        reason: 'Generated code',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('large-file');

      const { local } = listSuppressions(tempDir);
      expect(local).toHaveLength(1);
      expect(local[0].signalId).toBe('large-file');
    });

    it('should require reason for security signals', () => {
      const result = addSuppression(tempDir, {
        signalId: 'sec-xss-innerHTML',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('requires a --reason');
    });

    it('should allow security signals with reason', () => {
      const result = addSuppression(tempDir, {
        signalId: 'sec-xss-innerHTML',
        reason: 'Sanitized by DOMPurify',
      });

      expect(result.success).toBe(true);
    });

    it('should set default 30d expiration for security signals', () => {
      addSuppression(tempDir, {
        signalId: 'auth-bypass',
        reason: 'Known issue, tracked in JIRA-123',
      });

      const { local } = listSuppressions(tempDir);
      expect(local[0].expiresAt).toBeDefined();
    });

    it('should reject duplicate without --force', () => {
      addSuppression(tempDir, { signalId: 'large-file' });
      const result = addSuppression(tempDir, { signalId: 'large-file' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('already exists');
    });

    it('should update with --force', () => {
      addSuppression(tempDir, { signalId: 'large-file', reason: 'Original' });
      const result = addSuppression(tempDir, {
        signalId: 'large-file',
        reason: 'Updated',
        force: true,
      });

      expect(result.success).toBe(true);
      const { local } = listSuppressions(tempDir);
      expect(local[0].reason).toBe('Updated');
    });

    it('should parse expiration duration', () => {
      addSuppression(tempDir, {
        signalId: 'large-file',
        expiresIn: '7d',
      });

      const { local } = listSuppressions(tempDir);
      expect(local[0].expiresAt).toBeDefined();

      const expiresAt = new Date(local[0].expiresAt!);
      const now = new Date();
      const diffDays = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeGreaterThan(6);
      expect(diffDays).toBeLessThan(8);
    });
  });

  describe('removeSuppression', () => {
    it('should remove an existing suppression', () => {
      addSuppression(tempDir, { signalId: 'large-file' });
      const result = removeSuppression(tempDir, { signalId: 'large-file' });

      expect(result.success).toBe(true);
      const { local } = listSuppressions(tempDir);
      expect(local).toHaveLength(0);
    });

    it('should fail if suppression does not exist', () => {
      const result = removeSuppression(tempDir, { signalId: 'nonexistent' });
      expect(result.success).toBe(false);
    });
  });

  describe('cleanExpiredSuppressions', () => {
    it('should remove expired suppressions', () => {
      // Add a valid suppression
      addSuppression(tempDir, { signalId: 'valid-signal' });

      // Manually add an expired one
      const filePath = path.join(tempDir, '.diffesense', 'suppressions.json');
      const data = loadSuppressionsFile(filePath)!;
      data.suppressions.push({
        signalId: 'expired-signal',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() - 1000).toISOString(), // Expired
      });
      saveSuppressionsFile(filePath, data);

      expect(listSuppressions(tempDir).local).toHaveLength(2);

      const result = cleanExpiredSuppressions(tempDir);
      expect(result.removed).toBe(1);

      const { local } = listSuppressions(tempDir);
      expect(local).toHaveLength(1);
      expect(local[0].signalId).toBe('valid-signal');
    });
  });

  describe('getSuppressionsHash', () => {
    it('should return consistent hash for same suppressions', () => {
      addSuppression(tempDir, { signalId: 'signal-1' });
      const hash1 = getSuppressionsHash(tempDir);
      const hash2 = getSuppressionsHash(tempDir);
      expect(hash1).toBe(hash2);
    });

    it('should return different hash when suppressions change', () => {
      const hash1 = getSuppressionsHash(tempDir);
      addSuppression(tempDir, { signalId: 'signal-1' });
      const hash2 = getSuppressionsHash(tempDir);
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('applySuppressions', () => {
    it('should filter out suppressed signals', () => {
      const signals = [
        { id: 'large-file', message: 'Large file detected' },
        { id: 'deep-nesting', message: 'Deep nesting detected' },
        { id: 'async-modified', message: 'Async function modified' },
      ];

      const suppressions: SuppressionMatch[] = [
        {
          entry: {
            signalId: 'large-file',
            createdAt: new Date().toISOString(),
          },
          scope: 'local',
        },
      ];

      const result = applySuppressions(signals, 'src/file.ts', suppressions);

      expect(result.active).toHaveLength(2);
      expect(result.suppressed).toHaveLength(1);
      expect(result.suppressed[0].id).toBe('large-file');
      expect(result.stats.total).toBe(3);
      expect(result.stats.suppressed).toBe(1);
      expect(result.stats.active).toBe(2);
    });

    it('should not count suppressed signals in stats', () => {
      const signals = [
        { id: 'large-file', message: 'Large file detected' },
        { id: 'sec-xss', message: 'XSS detected' },
      ];

      const suppressions: SuppressionMatch[] = [
        {
          entry: {
            signalId: '*',
            createdAt: new Date().toISOString(),
          },
          scope: 'local',
        },
      ];

      const result = applySuppressions(signals, 'src/file.ts', suppressions);

      expect(result.active).toHaveLength(0);
      expect(result.suppressed).toHaveLength(2);
    });
  });

  describe('Integration: Suppression affects PASS/FAIL', () => {
    it('suppressing the only high-impact signal should affect counts', () => {
      // This test verifies the contract: suppressed signals are removed from analysis
      const signals = [{ id: 'sec-critical', message: 'Critical security issue' }];

      const suppressions: SuppressionMatch[] = [
        {
          entry: {
            signalId: 'sec-critical',
            reason: 'False positive',
            createdAt: new Date().toISOString(),
          },
          scope: 'local',
        },
      ];

      const result = applySuppressions(signals, 'src/file.ts', suppressions);

      // After suppression, no signals remain
      expect(result.active).toHaveLength(0);
      // This would mean no signals to score, potentially changing FAIL → PASS
    });
  });

  describe('Precedence: local overrides global', () => {
    it('should apply local suppressions after global (local wins)', () => {
      // Simulate: global suppresses signal X, local also suppresses X
      // Result: both should apply, but local takes precedence
      const signals = [
        { id: 'large-file', message: 'Large file' },
        { id: 'deep-nesting', message: 'Deep nesting' },
      ];

      // Global suppresses large-file
      const globalSuppression: SuppressionMatch = {
        entry: {
          signalId: 'large-file',
          reason: 'Global policy',
          createdAt: new Date().toISOString(),
        },
        scope: 'global',
      };

      // Local also suppresses large-file (with different reason)
      const localSuppression: SuppressionMatch = {
        entry: {
          signalId: 'large-file',
          reason: 'Project-specific override',
          createdAt: new Date().toISOString(),
        },
        scope: 'local',
      };

      // Order matters: global first, then local (local applied last = wins)
      const suppressions = [globalSuppression, localSuppression];

      const result = applySuppressions(signals, 'src/file.ts', suppressions);

      // Signal is suppressed (by local, which came last)
      expect(result.suppressed).toHaveLength(1);
      expect(result.active).toHaveLength(1);
    });

    it('local suppression should override global for same signal', () => {
      // More specific test: check that isSuppressed returns local match
      const suppressions: SuppressionMatch[] = [
        {
          entry: {
            signalId: 'test-signal',
            reason: 'Global',
            createdAt: new Date().toISOString(),
          },
          scope: 'global',
        },
        {
          entry: {
            signalId: 'test-signal',
            reason: 'Local override',
            createdAt: new Date().toISOString(),
          },
          scope: 'local',
        },
      ];

      const match = isSuppressed('test-signal', 'any/file.ts', suppressions);

      expect(match).not.toBeNull();
      // Local should be the winning match (checked in reverse order)
      expect(match!.scope).toBe('local');
      expect(match!.entry.reason).toBe('Local override');
    });

    it('more specific glob should match over less specific', () => {
      const suppressions: SuppressionMatch[] = [
        {
          entry: {
            signalId: 'large-file',
            fileGlob: 'src/**', // Less specific
            reason: 'Global src',
            createdAt: new Date().toISOString(),
          },
          scope: 'global',
        },
        {
          entry: {
            signalId: 'large-file',
            fileGlob: 'src/generated/**', // More specific
            reason: 'Generated code',
            createdAt: new Date().toISOString(),
          },
          scope: 'local',
        },
      ];

      // File in src/generated should match local (more specific)
      const match = isSuppressed('large-file', 'src/generated/types.ts', suppressions);
      expect(match).not.toBeNull();
      expect(match!.entry.reason).toBe('Generated code');
    });
  });

  describe('Cache invalidation contract', () => {
    it('suppressions hash should change when suppressions are added', () => {
      const hash1 = getSuppressionsHash(tempDir);

      addSuppression(tempDir, { signalId: 'new-signal' });

      const hash2 = getSuppressionsHash(tempDir);

      // Cache key must change
      expect(hash1).not.toBe(hash2);
    });

    it('suppressions hash should change when suppressions are removed', () => {
      addSuppression(tempDir, { signalId: 'signal-1' });
      const hash1 = getSuppressionsHash(tempDir);

      removeSuppression(tempDir, { signalId: 'signal-1' });
      const hash2 = getSuppressionsHash(tempDir);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('getSuppressionKey (canonical key)', () => {
    it('should create consistent key from signalId and fileGlob', () => {
      const key1 = getSuppressionKey('Large-File', 'src/Generated/**');
      const key2 = getSuppressionKey('large-file', 'src/generated/**');

      expect(key1).toBe(key2);
    });

    it('should handle undefined fileGlob', () => {
      const key1 = getSuppressionKey('test-signal', undefined);
      const key2 = getSuppressionKey('test-signal');

      expect(key1).toBe(key2);
      expect(key1).toBe('test-signal::');
    });

    it('should normalize Windows paths in fileGlob', () => {
      const key1 = getSuppressionKey('test', 'src\\components\\**');
      const key2 = getSuppressionKey('test', 'src/components/**');

      expect(key1).toBe(key2);
    });
  });

  describe('Stable file output (sorted suppressions)', () => {
    it('should save suppressions in sorted order', () => {
      // Add in random order
      addSuppression(tempDir, { signalId: 'z-signal' });
      addSuppression(tempDir, { signalId: 'a-signal' });
      addSuppression(tempDir, { signalId: 'm-signal' });

      const { local } = listSuppressions(tempDir);

      // Should be sorted alphabetically
      expect(local[0].signalId).toBe('a-signal');
      expect(local[1].signalId).toBe('m-signal');
      expect(local[2].signalId).toBe('z-signal');
    });

    it('should sort by signalId then fileGlob', () => {
      addSuppression(tempDir, { signalId: 'test', fileGlob: 'src/z/**' });
      addSuppression(tempDir, { signalId: 'test', fileGlob: 'src/a/**' });

      const { local } = listSuppressions(tempDir);

      expect(local[0].fileGlob).toBe('src/a/**');
      expect(local[1].fileGlob).toBe('src/z/**');
    });
  });

  describe('Case-insensitive duplicate detection', () => {
    it('should detect duplicates regardless of case', () => {
      addSuppression(tempDir, { signalId: 'Large-File' });
      const result = addSuppression(tempDir, { signalId: 'large-file' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('already exists');
    });

    it('should detect duplicates with different glob case', () => {
      addSuppression(tempDir, { signalId: 'test', fileGlob: 'src/Generated/**' });
      const result = addSuppression(tempDir, { signalId: 'test', fileGlob: 'src/generated/**' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('already exists');
    });
  });

  describe('calculateSpecificity (glob precedence)', () => {
    it('should return 0 for undefined glob (matches all)', () => {
      expect(calculateSpecificity(undefined)).toBe(0);
    });

    it('should return low score for double wildcard only', () => {
      expect(calculateSpecificity('**')).toBeLessThan(5);
    });

    it('should return higher score for concrete path segments', () => {
      const wildcardOnly = calculateSpecificity('**/*.ts');
      const withConcrete = calculateSpecificity('src/**/*.ts');
      const moreConcrete = calculateSpecificity('src/components/**/*.ts');

      expect(withConcrete).toBeGreaterThan(wildcardOnly);
      expect(moreConcrete).toBeGreaterThan(withConcrete);
    });

    it('should return highest score for exact file path', () => {
      const glob = calculateSpecificity('src/**/*.ts');
      const exact = calculateSpecificity('src/auth/middleware.ts');

      expect(exact).toBeGreaterThan(glob);
    });

    it('should normalize Windows paths', () => {
      const unix = calculateSpecificity('src/components/Button.tsx');
      const windows = calculateSpecificity('src\\components\\Button.tsx');

      expect(unix).toBe(windows);
    });
  });

  describe('isSuppressed precedence (explicit rules)', () => {
    it('local suppression should override global for same signal', () => {
      // Create both global and local suppressions for same signal
      const suppressions: SuppressionMatch[] = [
        {
          entry: {
            signalId: 'test-signal',
            createdAt: new Date().toISOString(),
          },
          scope: 'global',
          specificity: 0,
        },
        {
          entry: {
            signalId: 'test-signal',
            createdAt: new Date().toISOString(),
          },
          scope: 'local',
          specificity: 0,
        },
      ];

      const match = isSuppressed('test-signal', 'any/file.ts', suppressions);

      expect(match).not.toBeNull();
      expect(match!.scope).toBe('local'); // Local should win
    });

    it('more specific glob should win within same scope', () => {
      const suppressions: SuppressionMatch[] = [
        {
          entry: {
            signalId: 'console-log',
            fileGlob: 'src/**',
            createdAt: new Date().toISOString(),
          },
          scope: 'local',
          specificity: calculateSpecificity('src/**'),
        },
        {
          entry: {
            signalId: 'console-log',
            fileGlob: 'src/components/**',
            createdAt: new Date().toISOString(),
          },
          scope: 'local',
          specificity: calculateSpecificity('src/components/**'),
        },
      ];

      const match = isSuppressed('console-log', 'src/components/Button.tsx', suppressions);

      expect(match).not.toBeNull();
      expect(match!.entry.fileGlob).toBe('src/components/**'); // More specific wins
    });

    it('exact file path should beat glob pattern', () => {
      const suppressions: SuppressionMatch[] = [
        {
          entry: {
            signalId: 'magic-number',
            fileGlob: 'src/**/*.ts',
            createdAt: new Date().toISOString(),
          },
          scope: 'local',
          specificity: calculateSpecificity('src/**/*.ts'),
        },
        {
          entry: {
            signalId: 'magic-number',
            fileGlob: 'src/constants/values.ts',
            createdAt: new Date().toISOString(),
          },
          scope: 'local',
          specificity: calculateSpecificity('src/constants/values.ts'),
        },
      ];

      const match = isSuppressed('magic-number', 'src/constants/values.ts', suppressions);

      expect(match).not.toBeNull();
      expect(match!.entry.fileGlob).toBe('src/constants/values.ts'); // Exact wins
    });

    it('local specific should beat global specific', () => {
      const suppressions: SuppressionMatch[] = [
        {
          entry: {
            signalId: 'test',
            fileGlob: 'src/auth/**',
            createdAt: new Date().toISOString(),
          },
          scope: 'global',
          specificity: calculateSpecificity('src/auth/**'),
        },
        {
          entry: {
            signalId: 'test',
            fileGlob: 'src/**',
            createdAt: new Date().toISOString(),
          },
          scope: 'local',
          specificity: calculateSpecificity('src/**'),
        },
      ];

      const match = isSuppressed('test', 'src/auth/login.ts', suppressions);

      expect(match).not.toBeNull();
      // Local should win even though global has more specific glob
      expect(match!.scope).toBe('local');
    });
  });
});
