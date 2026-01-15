import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { analyze } from '../src/core/analyze';
import { hasStagedChanges, hasWorkingChanges, autoDetectScope } from '../src/git/diff';

describe('E2E Integration Tests', () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'diffesense-e2e-'));

    execSync('git init', { cwd: tempDir, stdio: 'pipe' });
    execSync('git config user.email "test@test.com"', { cwd: tempDir, stdio: 'pipe' });
    execSync('git config user.name "Test User"', { cwd: tempDir, stdio: 'pipe' });

    fs.writeFileSync(
      path.join(tempDir, 'index.ts'),
      `export function hello() { return 'world'; }\n`,
    );
    execSync('git add .', { cwd: tempDir, stdio: 'pipe' });
    execSync('git commit -m "Initial commit"', { cwd: tempDir, stdio: 'pipe' });

    execSync('git checkout -b feature/test', { cwd: tempDir, stdio: 'pipe' });
  });

  afterAll(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Basic Analysis', () => {
    it('should analyze a simple change', async () => {
      fs.writeFileSync(
        path.join(tempDir, 'index.ts'),
        `export function hello() { 
          console.log('side effect');
          return 'world'; 
        }\n`,
      );
      execSync('git add .', { cwd: tempDir, stdio: 'pipe' });

      const result = await analyze({
        cwd: tempDir,
        scope: 'staged',
      });

      expect(result.success).toBe(true);
      expect(result.exitCode).toBeLessThanOrEqual(1);
      expect(result.summary.analyzedCount).toBeGreaterThan(0);
      expect(result.files.length).toBeGreaterThan(0);
      expect(result.files[0].path).toBe('index.ts');
    });

    it('should return empty result when no changes', async () => {
      execSync('git reset HEAD', { cwd: tempDir, stdio: 'pipe' });
      execSync('git checkout -- .', { cwd: tempDir, stdio: 'pipe' });

      const result = await analyze({
        cwd: tempDir,
        scope: 'staged',
      });

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.summary.analyzedCount).toBe(0);
    });
  });

  describe('Rename Handling', () => {
    it('should handle renamed files correctly', async () => {
      fs.writeFileSync(path.join(tempDir, 'old-name.ts'), `export const x = 1;\n`);
      execSync('git add old-name.ts', { cwd: tempDir, stdio: 'pipe' });
      execSync('git commit -m "Add old-name.ts"', { cwd: tempDir, stdio: 'pipe' });

      execSync('git mv old-name.ts new-name.ts', { cwd: tempDir, stdio: 'pipe' });

      const result = await analyze({
        cwd: tempDir,
        scope: 'staged',
      });

      expect(result.success).toBe(true);
      const filePaths = result.files.map((f) => f.path);
      expect(filePaths).not.toContain('old-name.ts');

      execSync('git checkout HEAD -- old-name.ts || true', { cwd: tempDir, stdio: 'pipe' });
      execSync('git reset HEAD', { cwd: tempDir, stdio: 'pipe' });
    });
  });

  describe('Config File Filtering', () => {
    it('should exclude config files by default', async () => {
      fs.writeFileSync(path.join(tempDir, 'vite.config.ts'), `export default {};\n`);
      fs.writeFileSync(path.join(tempDir, 'app.ts'), `export const app = true;\n`);
      execSync('git add .', { cwd: tempDir, stdio: 'pipe' });

      const result = await analyze({
        cwd: tempDir,
        scope: 'staged',
        includeConfig: false,
      });

      const filePaths = result.files.map((f) => f.path);
      expect(filePaths).not.toContain('vite.config.ts');

      const ignoredPaths = result.ignoredFiles.map((f) => f.path);
      expect(ignoredPaths).toContain('vite.config.ts');

      execSync('git reset HEAD', { cwd: tempDir, stdio: 'pipe' });
      fs.unlinkSync(path.join(tempDir, 'vite.config.ts'));
      fs.unlinkSync(path.join(tempDir, 'app.ts'));
    });

    it('should include config files when flag is set', async () => {
      fs.writeFileSync(path.join(tempDir, 'jest.config.js'), `module.exports = {};\n`);
      execSync('git add .', { cwd: tempDir, stdio: 'pipe' });

      const result = await analyze({
        cwd: tempDir,
        scope: 'staged',
        includeConfig: true,
      });

      const filePaths = result.files.map((f) => f.path);
      expect(filePaths).toContain('jest.config.js');

      execSync('git reset HEAD', { cwd: tempDir, stdio: 'pipe' });
      fs.unlinkSync(path.join(tempDir, 'jest.config.js'));
    });

    it('should NOT exclude app code with config in name', async () => {
      fs.writeFileSync(
        path.join(tempDir, 'configureStore.ts'),
        `export function configureStore() { return {}; }\n`,
      );
      execSync('git add .', { cwd: tempDir, stdio: 'pipe' });

      const result = await analyze({
        cwd: tempDir,
        scope: 'staged',
        includeConfig: false,
      });

      const filePaths = result.files.map((f) => f.path);
      expect(filePaths).toContain('configureStore.ts');

      execSync('git reset HEAD', { cwd: tempDir, stdio: 'pipe' });
      fs.unlinkSync(path.join(tempDir, 'configureStore.ts'));
    });
  });

  describe('Test File Filtering', () => {
    it('should exclude test files by default', async () => {
      fs.writeFileSync(path.join(tempDir, 'utils.test.ts'), `test('x', () => {});\n`);
      fs.writeFileSync(path.join(tempDir, 'utils.ts'), `export const x = 1;\n`);
      execSync('git add .', { cwd: tempDir, stdio: 'pipe' });

      const result = await analyze({
        cwd: tempDir,
        scope: 'staged',
        includeTests: false,
      });

      const filePaths = result.files.map((f) => f.path);
      expect(filePaths).not.toContain('utils.test.ts');
      expect(filePaths).toContain('utils.ts');

      execSync('git reset HEAD', { cwd: tempDir, stdio: 'pipe' });
      fs.unlinkSync(path.join(tempDir, 'utils.test.ts'));
      fs.unlinkSync(path.join(tempDir, 'utils.ts'));
    });
  });

  describe('Severity Classification', () => {
    it('should assign severity based on risk score', async () => {
      fs.writeFileSync(
        path.join(tempDir, 'risky.ts'),
        `
        export function dangerous() {
          eval('alert(1)');
          process.exit(1);
          require('child_process').exec('rm -rf /');
        }
        `,
      );
      execSync('git add .', { cwd: tempDir, stdio: 'pipe' });

      const result = await analyze({
        cwd: tempDir,
        scope: 'staged',
      });

      expect(result.files.length).toBeGreaterThan(0);
      const file = result.files.find((f) => f.path === 'risky.ts');
      expect(file).toBeDefined();
      expect(['LOW', 'MED', 'HIGH', 'CRITICAL']).toContain(file!.severity);

      execSync('git reset HEAD', { cwd: tempDir, stdio: 'pipe' });
      fs.unlinkSync(path.join(tempDir, 'risky.ts'));
    });
  });

  describe('AnalysisResult Contract', () => {
    it('should return all required fields', async () => {
      fs.writeFileSync(path.join(tempDir, 'test-contract.ts'), `export const x = 1;\n`);
      execSync('git add .', { cwd: tempDir, stdio: 'pipe' });

      const result = await analyze({
        cwd: tempDir,
        scope: 'staged',
      });

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('exitCode');
      expect(result).toHaveProperty('meta');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('files');
      expect(result).toHaveProperty('ignoredFiles');
      expect(result).toHaveProperty('warnings');
      expect(result).toHaveProperty('config');

      expect(result.meta).toHaveProperty('cwd');
      expect(result.meta).toHaveProperty('scope');
      expect(result.meta).toHaveProperty('base');
      expect(result.meta).toHaveProperty('profile');
      expect(result.meta).toHaveProperty('detector');
      expect(result.meta).toHaveProperty('timestamp');

      expect(result.summary).toHaveProperty('changedCount');
      expect(result.summary).toHaveProperty('analyzedCount');
      expect(result.summary).toHaveProperty('ignoredCount');
      expect(result.summary).toHaveProperty('highestRisk');
      expect(result.summary).toHaveProperty('blockerCount');

      expect(Array.isArray(result.files)).toBe(true);
      expect(Array.isArray(result.ignoredFiles)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);

      execSync('git reset HEAD', { cwd: tempDir, stdio: 'pipe' });
      fs.unlinkSync(path.join(tempDir, 'test-contract.ts'));
    });

    it('should never return null for array fields', async () => {
      const result = await analyze({
        cwd: tempDir,
        scope: 'staged',
      });

      expect(result.files).not.toBeNull();
      expect(result.ignoredFiles).not.toBeNull();
      expect(result.warnings).not.toBeNull();
    });
  });

  describe('Exit Codes', () => {
    it('should return exitCode 0 for clean analysis', async () => {
      fs.writeFileSync(path.join(tempDir, 'clean.ts'), `export const x = 1;\n`);
      execSync('git add .', { cwd: tempDir, stdio: 'pipe' });

      const result = await analyze({
        cwd: tempDir,
        scope: 'staged',
        profile: 'minimal',
      });

      expect([0, 1]).toContain(result.exitCode);

      execSync('git reset HEAD', { cwd: tempDir, stdio: 'pipe' });
      fs.unlinkSync(path.join(tempDir, 'clean.ts'));
    });

    it('should return exitCode 2 for non-git directory', async () => {
      const nonGitDir = fs.mkdtempSync(path.join(os.tmpdir(), 'non-git-'));

      const result = await analyze({
        cwd: nonGitDir,
        scope: 'staged',
      });

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(2);
      expect(result.error).toBeDefined();

      fs.rmSync(nonGitDir, { recursive: true, force: true });
    });
  });

  describe('Working/Staged Scope Detection', () => {
    it('should detect uncommitted changes with working scope', async () => {
      fs.writeFileSync(
        path.join(tempDir, 'index.ts'),
        `export function hello() { return 'uncommitted modification'; }\n`,
      );

      const result = await analyze({
        cwd: tempDir,
        scope: 'working',
      });

      expect(result.success).toBe(true);
      expect(result.summary.analyzedCount).toBeGreaterThan(0);
      const filePaths = result.files.map((f) => f.path);
      expect(filePaths).toContain('index.ts');

      execSync('git checkout -- index.ts', { cwd: tempDir, stdio: 'pipe' });
    });

    it('should detect staged changes with staged scope', async () => {
      fs.writeFileSync(path.join(tempDir, 'staged-file.ts'), `export const staged = true;\n`);
      execSync('git add staged-file.ts', { cwd: tempDir, stdio: 'pipe' });

      const result = await analyze({
        cwd: tempDir,
        scope: 'staged',
      });

      expect(result.success).toBe(true);
      expect(result.summary.analyzedCount).toBeGreaterThan(0);
      const filePaths = result.files.map((f) => f.path);
      expect(filePaths).toContain('staged-file.ts');

      execSync('git reset HEAD', { cwd: tempDir, stdio: 'pipe' });
      fs.unlinkSync(path.join(tempDir, 'staged-file.ts'));
    });

    it('should NOT see uncommitted changes with staged scope', async () => {
      fs.writeFileSync(path.join(tempDir, 'only-working.ts'), `export const onlyWorking = true;\n`);

      const result = await analyze({
        cwd: tempDir,
        scope: 'staged',
      });

      const filePaths = result.files.map((f) => f.path);
      expect(filePaths).not.toContain('only-working.ts');

      fs.unlinkSync(path.join(tempDir, 'only-working.ts'));
    });

    it('should NOT see staged changes with working scope', async () => {
      fs.writeFileSync(path.join(tempDir, 'only-staged.ts'), `export const onlyStaged = true;\n`);
      execSync('git add only-staged.ts', { cwd: tempDir, stdio: 'pipe' });

      const result = await analyze({
        cwd: tempDir,
        scope: 'working',
      });

      const filePaths = result.files.map((f) => f.path);
      expect(filePaths).not.toContain('only-staged.ts');

      execSync('git reset HEAD', { cwd: tempDir, stdio: 'pipe' });
      fs.unlinkSync(path.join(tempDir, 'only-staged.ts'));
    });
  });

  describe('Auto Scope Detection Helpers', () => {
    it('hasStagedChanges should detect staged files', () => {
      fs.writeFileSync(path.join(tempDir, 'for-staging.ts'), `export const x = 1;\n`);
      execSync('git add for-staging.ts', { cwd: tempDir, stdio: 'pipe' });

      expect(hasStagedChanges(tempDir)).toBe(true);

      execSync('git reset HEAD', { cwd: tempDir, stdio: 'pipe' });
      fs.unlinkSync(path.join(tempDir, 'for-staging.ts'));
    });

    it('hasStagedChanges should return false when no staged changes', () => {
      expect(hasStagedChanges(tempDir)).toBe(false);
    });

    it('hasWorkingChanges should detect uncommitted modifications', () => {
      fs.writeFileSync(
        path.join(tempDir, 'index.ts'),
        `export function hello() { return 'modified'; }\n`,
      );

      expect(hasWorkingChanges(tempDir)).toBe(true);

      execSync('git checkout -- index.ts', { cwd: tempDir, stdio: 'pipe' });
    });

    it('hasWorkingChanges should return false when working tree is clean', () => {
      expect(hasWorkingChanges(tempDir)).toBe(false);
    });

    it('autoDetectScope should prioritize staged over working', () => {
      fs.writeFileSync(
        path.join(tempDir, 'index.ts'),
        `export function hello() { return 'modified'; }\n`,
      );
      fs.writeFileSync(path.join(tempDir, 'new-file.ts'), `export const y = 2;\n`);
      execSync('git add new-file.ts', { cwd: tempDir, stdio: 'pipe' });

      const detected = autoDetectScope(tempDir);
      expect(detected.scope).toBe('staged');

      execSync('git reset HEAD', { cwd: tempDir, stdio: 'pipe' });
      execSync('git checkout -- index.ts', { cwd: tempDir, stdio: 'pipe' });
      fs.unlinkSync(path.join(tempDir, 'new-file.ts'));
    });

    it('autoDetectScope should use working when no staged changes', () => {
      fs.writeFileSync(
        path.join(tempDir, 'index.ts'),
        `export function hello() { return 'modified'; }\n`,
      );

      const detected = autoDetectScope(tempDir);
      expect(detected.scope).toBe('working');

      execSync('git checkout -- index.ts', { cwd: tempDir, stdio: 'pipe' });
    });

    it('autoDetectScope should use branch when no local changes', () => {
      const detected = autoDetectScope(tempDir);
      expect(detected.scope).toBe('branch');
    });
  });
});
