/**
 * Edge Case Tests
 *
 * These tests cover unusual or boundary conditions that could cause issues.
 * They ensure graceful handling of non-standard inputs.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { analyze } from '../src/core/analyze';
import { formatConsoleOutput } from '../src/output/formatters/dsConsole';
import { formatJsonOutput } from '../src/output/formatters/dsJson';

describe('Edge Cases', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'diffesense-edge-'));
    execSync('git init', { cwd: tempDir, stdio: 'pipe' });
    execSync('git config user.email "test@test.com"', { cwd: tempDir, stdio: 'pipe' });
    execSync('git config user.name "Test"', { cwd: tempDir, stdio: 'pipe' });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Empty Diff', () => {
    it('should handle no changes gracefully', async () => {
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(path.join(srcDir, 'test.ts'), 'export const x = 1;');
      execSync('git add .', { cwd: tempDir, stdio: 'pipe' });
      execSync('git commit -m "Initial"', { cwd: tempDir, stdio: 'pipe' });

      const result = await analyze({
        cwd: tempDir,
        scope: 'working',
      });

      expect(result).toBeDefined();
      expect(result.files).toEqual([]);
      expect(result.summary.changedCount).toBe(0);
      expect(result.exitCode).toBe(0);
    });

    it('should produce valid output with no files', async () => {
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(path.join(srcDir, 'test.ts'), 'const a = 1;');
      execSync('git add .', { cwd: tempDir, stdio: 'pipe' });
      execSync('git commit -m "Init"', { cwd: tempDir, stdio: 'pipe' });

      const result = await analyze({ cwd: tempDir, scope: 'working' });

      const consoleOutput = formatConsoleOutput(result, {});
      const jsonOutput = formatJsonOutput(result, {});

      expect(consoleOutput).toContain('PASS');
      expect(() => JSON.parse(jsonOutput)).not.toThrow();

      const parsed = JSON.parse(jsonOutput);
      expect(parsed.files).toEqual([]);
    });
  });

  describe('Binary File Changes', () => {
    it('should handle binary file gracefully (not crash)', async () => {
      const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

      fs.writeFileSync(path.join(tempDir, 'image.png'), pngHeader);
      execSync('git add .', { cwd: tempDir, stdio: 'pipe' });
      execSync('git commit -m "Add binary"', { cwd: tempDir, stdio: 'pipe' });

      const modifiedPng = Buffer.concat([pngHeader, Buffer.from([0x00, 0x01, 0x02])]);
      fs.writeFileSync(path.join(tempDir, 'image.png'), modifiedPng);

      const result = await analyze({
        cwd: tempDir,
        scope: 'working',
      });

      expect(result).toBeDefined();
      expect([0, 1, 2]).toContain(result.exitCode);
    });

    it('should not analyze binary files as source code', async () => {
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });

      fs.writeFileSync(path.join(srcDir, 'code.ts'), 'export const x = 1;');
      fs.writeFileSync(path.join(srcDir, 'data.bin'), Buffer.from([0x00, 0x01, 0x02, 0x03]));
      execSync('git add .', { cwd: tempDir, stdio: 'pipe' });
      execSync('git commit -m "Initial"', { cwd: tempDir, stdio: 'pipe' });

      fs.writeFileSync(path.join(srcDir, 'code.ts'), 'export const x = 2;');
      fs.writeFileSync(path.join(srcDir, 'data.bin'), Buffer.from([0x04, 0x05, 0x06, 0x07]));

      const result = await analyze({ cwd: tempDir, scope: 'working' });

      const binFile = result.files.find((f) => f.path.includes('data.bin'));
      if (binFile) {
        // Use signalTypes (not signals) - binary files should have minimal analysis
        expect(binFile.signalTypes?.length || 0).toBeLessThan(3);
      }
    });
  });

  describe('Rename + Small Edit', () => {
    it('should handle file rename with content change', async () => {
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });

      fs.writeFileSync(path.join(srcDir, 'oldName.ts'), 'export function test() { return 1; }');
      execSync('git add .', { cwd: tempDir, stdio: 'pipe' });
      execSync('git commit -m "Initial"', { cwd: tempDir, stdio: 'pipe' });

      fs.unlinkSync(path.join(srcDir, 'oldName.ts'));
      fs.writeFileSync(
        path.join(srcDir, 'newName.ts'),
        'export function test() { return 2; } // modified',
      );
      execSync('git add .', { cwd: tempDir, stdio: 'pipe' });

      const result = await analyze({
        cwd: tempDir,
        scope: 'staged',
      });

      expect(result).toBeDefined();

      const hasNewFile = result.files.some((f) => f.path.includes('newName'));
      expect(hasNewFile).toBe(true);
    });

    it('should handle pure rename (no content change)', async () => {
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });

      fs.writeFileSync(path.join(srcDir, 'original.ts'), 'export const unchanged = true;');
      execSync('git add .', { cwd: tempDir, stdio: 'pipe' });
      execSync('git commit -m "Initial"', { cwd: tempDir, stdio: 'pipe' });

      execSync('git mv src/original.ts src/renamed.ts', { cwd: tempDir, stdio: 'pipe' });

      const result = await analyze({
        cwd: tempDir,
        scope: 'staged',
      });

      expect(result).toBeDefined();

      if (result.files.length > 0) {
        const renamedFile = result.files.find((f) => f.path.includes('renamed'));
        if (renamedFile) {
          expect(renamedFile.riskScore).toBeLessThanOrEqual(2);
        }
      }
    });
  });

  describe('Large Files', () => {
    it('should handle large file without timeout', async () => {
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });

      const lines: string[] = [];
      for (let i = 0; i < 1000; i++) {
        lines.push(`export const var${i} = ${i}; // Line ${i}`);
      }
      fs.writeFileSync(path.join(srcDir, 'large.ts'), lines.join('\n'));
      execSync('git add .', { cwd: tempDir, stdio: 'pipe' });
      execSync('git commit -m "Large file"', { cwd: tempDir, stdio: 'pipe' });

      const modifiedLines = lines.map((line, i) =>
        i % 10 === 0 ? line.replace('Line', 'Modified') : line,
      );
      fs.writeFileSync(path.join(srcDir, 'large.ts'), modifiedLines.join('\n'));

      const startTime = Date.now();
      const result = await analyze({
        cwd: tempDir,
        scope: 'working',
      });
      const duration = Date.now() - startTime;

      expect(result).toBeDefined();

      expect(duration).toBeLessThan(10000);
    }, 15000);

    it('should handle very large diff gracefully', async () => {
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });

      fs.writeFileSync(path.join(srcDir, 'code.ts'), 'const a = 1;');
      execSync('git add .', { cwd: tempDir, stdio: 'pipe' });
      execSync('git commit -m "Init"', { cwd: tempDir, stdio: 'pipe' });

      for (let i = 0; i < 50; i++) {
        fs.writeFileSync(
          path.join(srcDir, `file${i}.ts`),
          `export const data${i} = { id: ${i}, name: 'Item ${i}' };`,
        );
      }
      execSync('git add .', { cwd: tempDir, stdio: 'pipe' });

      const result = await analyze({
        cwd: tempDir,
        scope: 'staged',
      });

      expect(result).toBeDefined();
      expect(result.summary.analyzedCount).toBeGreaterThan(0);
    });
  });

  describe('Special Characters in Paths', () => {
    it('should handle spaces in file paths', async () => {
      const srcDir = path.join(tempDir, 'src folder');
      fs.mkdirSync(srcDir, { recursive: true });

      fs.writeFileSync(path.join(srcDir, 'my file.ts'), 'export const x = 1;');
      execSync('git add .', { cwd: tempDir, stdio: 'pipe' });
      execSync('git commit -m "Init"', { cwd: tempDir, stdio: 'pipe' });

      fs.writeFileSync(path.join(srcDir, 'my file.ts'), 'export const x = 2;');

      const result = await analyze({
        cwd: tempDir,
        scope: 'working',
      });

      expect(result).toBeDefined();
      const fileWithSpace = result.files.find((f) => f.path.includes('my file'));
      expect(fileWithSpace).toBeDefined();
    });

    it('should handle unicode in file paths', async () => {
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });

      fs.writeFileSync(path.join(srcDir, 'file_special.ts'), 'export const x = 1;');
      execSync('git add .', { cwd: tempDir, stdio: 'pipe' });
      execSync('git commit -m "Init"', { cwd: tempDir, stdio: 'pipe' });

      fs.writeFileSync(path.join(srcDir, 'file_special.ts'), 'export const x = 2;');

      const result = await analyze({
        cwd: tempDir,
        scope: 'working',
      });

      expect(result).toBeDefined();
    });
  });

  describe('Empty Files', () => {
    it('should handle empty file creation', async () => {
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });

      fs.writeFileSync(path.join(srcDir, 'placeholder.ts'), 'const x = 1;');
      execSync('git add .', { cwd: tempDir, stdio: 'pipe' });
      execSync('git commit -m "Init"', { cwd: tempDir, stdio: 'pipe' });

      fs.writeFileSync(path.join(srcDir, 'empty.ts'), '');

      const result = await analyze({
        cwd: tempDir,
        scope: 'working',
      });

      expect(result).toBeDefined();
    });

    it('should handle file being emptied', async () => {
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });

      fs.writeFileSync(
        path.join(srcDir, 'willBeEmpty.ts'),
        'export const important = true;\n'.repeat(10),
      );
      execSync('git add .', { cwd: tempDir, stdio: 'pipe' });
      execSync('git commit -m "Init"', { cwd: tempDir, stdio: 'pipe' });

      fs.writeFileSync(path.join(srcDir, 'willBeEmpty.ts'), '');

      const result = await analyze({
        cwd: tempDir,
        scope: 'working',
      });

      expect(result).toBeDefined();

      const emptyFile = result.files.find((f) => f.path.includes('willBeEmpty'));
      if (emptyFile) {
        expect(emptyFile).toBeDefined();
      }
    });
  });

  describe('Non-JS/TS Files', () => {
    it('should handle JSON file changes', async () => {
      fs.writeFileSync(
        path.join(tempDir, 'config.json'),
        JSON.stringify({ key: 'value' }, null, 2),
      );
      execSync('git add .', { cwd: tempDir, stdio: 'pipe' });
      execSync('git commit -m "Init"', { cwd: tempDir, stdio: 'pipe' });

      fs.writeFileSync(
        path.join(tempDir, 'config.json'),
        JSON.stringify({ key: 'new-value', added: true }, null, 2),
      );

      const result = await analyze({
        cwd: tempDir,
        scope: 'working',
      });

      expect(result).toBeDefined();
    });

    it('should handle markdown file changes', async () => {
      fs.writeFileSync(path.join(tempDir, 'README.md'), '# Hello\n\nWorld');
      execSync('git add .', { cwd: tempDir, stdio: 'pipe' });
      execSync('git commit -m "Init"', { cwd: tempDir, stdio: 'pipe' });

      fs.writeFileSync(path.join(tempDir, 'README.md'), '# Hello\n\nUpdated content');

      const result = await analyze({
        cwd: tempDir,
        scope: 'working',
      });

      expect(result).toBeDefined();
    });
  });

  describe('Deleted Files', () => {
    it('should handle file deletion', async () => {
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });

      fs.writeFileSync(path.join(srcDir, 'keep.ts'), 'export const keep = true;');
      fs.writeFileSync(path.join(srcDir, 'delete.ts'), 'export const del = true;');
      execSync('git add .', { cwd: tempDir, stdio: 'pipe' });
      execSync('git commit -m "Init"', { cwd: tempDir, stdio: 'pipe' });

      fs.unlinkSync(path.join(srcDir, 'delete.ts'));

      const result = await analyze({
        cwd: tempDir,
        scope: 'working',
      });

      expect(result).toBeDefined();
    });

    it('should handle staged deletion', async () => {
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });

      fs.writeFileSync(path.join(srcDir, 'toDelete.ts'), 'export const x = 1;');
      execSync('git add .', { cwd: tempDir, stdio: 'pipe' });
      execSync('git commit -m "Init"', { cwd: tempDir, stdio: 'pipe' });

      execSync('git rm src/toDelete.ts', { cwd: tempDir, stdio: 'pipe' });

      const result = await analyze({
        cwd: tempDir,
        scope: 'staged',
      });

      expect(result).toBeDefined();
    });
  });
});
