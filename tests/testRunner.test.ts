import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  detectPackageManager,
  detectTestFramework,
  detectMonorepo,
  detectTestRunner,
  generateTestCommand,
  isTestFile,
  getRunCommand,
  getExecCommand,
  findTestMapping,
  DEFAULT_TEST_MAPPINGS,
} from '../src/core/testRunner';

// Mock fs module
vi.mock('fs');

describe('Test Runner Detection', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('detectPackageManager', () => {
    it('should detect npm from package-lock.json', () => {
      vi.mocked(fs.existsSync).mockImplementation((p: fs.PathLike) => {
        return String(p).includes('package-lock.json');
      });

      const pm = detectPackageManager('/repo');
      expect(pm).toBe('npm');
    });

    it('should detect yarn from yarn.lock', () => {
      vi.mocked(fs.existsSync).mockImplementation((p: fs.PathLike) => {
        return String(p).includes('yarn.lock');
      });

      const pm = detectPackageManager('/repo');
      expect(pm).toBe('yarn');
    });

    it('should detect pnpm from pnpm-lock.yaml', () => {
      vi.mocked(fs.existsSync).mockImplementation((p: fs.PathLike) => {
        return String(p).includes('pnpm-lock.yaml');
      });

      const pm = detectPackageManager('/repo');
      expect(pm).toBe('pnpm');
    });

    it('should detect bun from bun.lockb', () => {
      vi.mocked(fs.existsSync).mockImplementation((p: fs.PathLike) => {
        return String(p).includes('bun.lockb');
      });

      const pm = detectPackageManager('/repo');
      expect(pm).toBe('bun');
    });

    it('should default to npm when no lockfile found', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const pm = detectPackageManager('/repo');
      expect(pm).toBe('npm');
    });
  });

  describe('getRunCommand', () => {
    it('should return correct run commands', () => {
      expect(getRunCommand('npm')).toBe('npm run');
      expect(getRunCommand('yarn')).toBe('yarn');
      expect(getRunCommand('pnpm')).toBe('pnpm');
      expect(getRunCommand('bun')).toBe('bun');
    });
  });

  describe('getExecCommand', () => {
    it('should return correct exec commands', () => {
      expect(getExecCommand('npm')).toBe('npx');
      expect(getExecCommand('yarn')).toBe('yarn');
      expect(getExecCommand('pnpm')).toBe('pnpm exec');
      expect(getExecCommand('bun')).toBe('bunx');
    });
  });

  describe('detectTestFramework', () => {
    it('should detect vitest from dependencies', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          devDependencies: { vitest: '^1.0.0' },
        }),
      );

      const framework = detectTestFramework('/repo');
      expect(framework).toBe('vitest');
    });

    it('should detect jest from dependencies', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          devDependencies: { jest: '^29.0.0' },
        }),
      );

      const framework = detectTestFramework('/repo');
      expect(framework).toBe('jest');
    });

    it('should detect mocha from dependencies', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          devDependencies: { mocha: '^10.0.0' },
        }),
      );

      const framework = detectTestFramework('/repo');
      expect(framework).toBe('mocha');
    });

    it('should detect framework from test script', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          scripts: { test: 'vitest run' },
        }),
      );

      const framework = detectTestFramework('/repo');
      expect(framework).toBe('vitest');
    });

    it('should return unknown when no framework detected', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({}));

      const framework = detectTestFramework('/repo');
      expect(framework).toBe('unknown');
    });
  });

  describe('detectMonorepo', () => {
    it('should detect workspaces in package.json', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          workspaces: ['packages/*'],
        }),
      );

      const isMonorepo = detectMonorepo('/repo');
      expect(isMonorepo).toBe(true);
    });

    it('should detect pnpm workspaces', () => {
      vi.mocked(fs.existsSync).mockImplementation((p: fs.PathLike) => {
        const pathStr = String(p);
        return pathStr.includes('package.json') || pathStr.includes('pnpm-workspace.yaml');
      });
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({}));

      const isMonorepo = detectMonorepo('/repo');
      expect(isMonorepo).toBe(true);
    });

    it('should detect lerna', () => {
      vi.mocked(fs.existsSync).mockImplementation((p: fs.PathLike) => {
        const pathStr = String(p);
        return pathStr.includes('package.json') || pathStr.includes('lerna.json');
      });
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({}));

      const isMonorepo = detectMonorepo('/repo');
      expect(isMonorepo).toBe(true);
    });

    it('should return false for single package', () => {
      vi.mocked(fs.existsSync).mockImplementation((p: fs.PathLike) => {
        return String(p).includes('package.json');
      });
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({}));

      const isMonorepo = detectMonorepo('/repo');
      expect(isMonorepo).toBe(false);
    });
  });

  describe('isTestFile', () => {
    it('should identify .test.ts files', () => {
      expect(isTestFile('src/utils/helper.test.ts')).toBe(true);
    });

    it('should identify .spec.ts files', () => {
      expect(isTestFile('src/utils/helper.spec.ts')).toBe(true);
    });

    it('should identify __tests__ directory', () => {
      expect(isTestFile('src/__tests__/helper.ts')).toBe(true);
    });

    it('should identify test directory', () => {
      expect(isTestFile('test/helper.ts')).toBe(true);
    });

    it('should not identify regular source files', () => {
      expect(isTestFile('src/utils/helper.ts')).toBe(false);
    });
  });

  describe('findTestMapping', () => {
    it('should find matching pattern', () => {
      const mapping = findTestMapping('src/auth/login.ts', DEFAULT_TEST_MAPPINGS);

      expect(mapping).not.toBeNull();
      expect(mapping?.pattern).toBe('**/auth/**');
    });

    it('should return null for no match', () => {
      const mapping = findTestMapping('README.md', DEFAULT_TEST_MAPPINGS);

      expect(mapping).toBeNull();
    });

    it('should prefer higher priority patterns', () => {
      const customMappings = [
        { pattern: '**/*.ts', command: 'npm test', priority: 1 },
        { pattern: '**/auth/**', command: 'npm test -- auth', priority: 10 },
      ];

      const mapping = findTestMapping('src/auth/login.ts', customMappings);

      expect(mapping?.priority).toBe(10);
    });
  });

  describe('generateTestCommand', () => {
    it('should generate jest command', () => {
      const config = {
        packageManager: 'npm' as const,
        testFramework: 'jest' as const,
        baseCommand: 'npx jest',
        isMonorepo: false,
        workspaceRoot: '/repo',
      };

      vi.mocked(fs.existsSync).mockReturnValue(false);

      const cmd = generateTestCommand('src/utils/helper.ts', config);

      expect(cmd.command).toContain('jest');
      expect(cmd.command).toContain('testPathPattern');
    });

    it('should generate vitest command', () => {
      const config = {
        packageManager: 'npm' as const,
        testFramework: 'vitest' as const,
        baseCommand: 'npx vitest',
        isMonorepo: false,
        workspaceRoot: '/repo',
      };

      vi.mocked(fs.existsSync).mockReturnValue(false);

      const cmd = generateTestCommand('src/utils/helper.ts', config);

      expect(cmd.command).toContain('vitest');
      expect(cmd.command).toContain('run');
    });

    it('should have high confidence for test files', () => {
      const config = {
        packageManager: 'npm' as const,
        testFramework: 'vitest' as const,
        baseCommand: 'npx vitest',
        isMonorepo: false,
        workspaceRoot: '/repo',
      };

      const cmd = generateTestCommand('src/utils/helper.test.ts', config);

      expect(cmd.confidence).toBeGreaterThanOrEqual(0.9);
    });
  });
});

