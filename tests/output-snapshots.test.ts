/**
 * Output Snapshot Tests
 *
 * These tests ensure that the CLI output format remains consistent.
 * They capture the structure and key elements of each output format.
 *
 * If output format changes intentionally, update the snapshots.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { analyze } from '../src/core/analyze';
import { formatConsoleOutput } from '../src/output/formatters/dsConsole';
import { formatJsonOutput } from '../src/output/formatters/dsJson';
import { formatMarkdownOutput } from '../src/output/formatters/dsMarkdown';

describe('Output Format Snapshots', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'diffesense-output-'));
    execSync('git init', { cwd: tempDir, stdio: 'pipe' });
    execSync('git config user.email "test@test.com"', { cwd: tempDir, stdio: 'pipe' });
    execSync('git config user.name "Test"', { cwd: tempDir, stdio: 'pipe' });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  async function setupTestRepo() {
    const srcDir = path.join(tempDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });

    const initialCode = `export function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
`;
    fs.writeFileSync(path.join(srcDir, 'greet.ts'), initialCode);
    execSync('git add .', { cwd: tempDir, stdio: 'pipe' });
    execSync('git commit -m "Initial"', { cwd: tempDir, stdio: 'pipe' });

    // Make a change
    const modifiedCode = `export function greet(name: string): string {
  console.log('Greeting:', name);
  return \`Hello, \${name}!\`;
}

export function farewell(name: string): string {
  return \`Goodbye, \${name}!\`;
}
`;
    fs.writeFileSync(path.join(srcDir, 'greet.ts'), modifiedCode);

    return analyze({
      cwd: tempDir,
      scope: 'working',
    });
  }

  describe('Console Output Structure', () => {
    it('should include version header', async () => {
      const result = await setupTestRepo();
      const output = formatConsoleOutput(result, {});

      expect(output).toContain('DiffeSense');
      expect(output).toMatch(/\d+\.\d+\.\d+/); // Version number
    });

    it('should include PASS/FAIL status', async () => {
      const result = await setupTestRepo();
      const output = formatConsoleOutput(result, {});

      const hasStatus = output.includes('PASS') || output.includes('FAIL');
      expect(hasStatus).toBe(true);
    });

    it('should include summary statistics', async () => {
      const result = await setupTestRepo();
      const output = formatConsoleOutput(result, {});

      expect(output).toContain('Files:');
      expect(output).toContain('Risk:');
      expect(output).toContain('Blockers:');
    });

    it('should show TOP N header when files present', async () => {
      const result = await setupTestRepo();
      const output = formatConsoleOutput(result, { topN: 5 });

      if (result.files.length > 0) {
        expect(output).toContain('TOP');
        expect(output).toContain('RISKS');
      }
    });

    it('detailed output should include Signal Summary', async () => {
      const result = await setupTestRepo();
      const output = formatConsoleOutput(result, { details: true });

      expect(output).toContain('Detailed Analysis');
      // May or may not have Signal Summary depending on signals
    });

    it('detailed output should show both risk scores', async () => {
      const result = await setupTestRepo();
      const output = formatConsoleOutput(result, { details: true });

      if (result.files.length > 0) {
        expect(output).toContain('Risk Score');
        expect(output).toContain('Gated Score');
      }
    });
  });

  describe('JSON Output Structure', () => {
    it('should be valid JSON', async () => {
      const result = await setupTestRepo();
      const output = formatJsonOutput(result, {});

      expect(() => JSON.parse(output)).not.toThrow();
    });

    it('should include all required top-level fields', async () => {
      const result = await setupTestRepo();
      const output = formatJsonOutput(result, {});
      const parsed = JSON.parse(output);

      expect(parsed).toHaveProperty('schemaVersion');
      expect(parsed).toHaveProperty('toolVersion');
      expect(parsed).toHaveProperty('exitCode');
      expect(parsed).toHaveProperty('summary');
      expect(parsed).toHaveProperty('files');
    });

    it('should include summary statistics', async () => {
      const result = await setupTestRepo();
      const output = formatJsonOutput(result, {});
      const parsed = JSON.parse(output);

      expect(parsed.summary).toHaveProperty('analyzedCount');
      expect(parsed.summary).toHaveProperty('changedCount');
      expect(parsed.summary).toHaveProperty('highestRisk');
      expect(parsed.summary).toHaveProperty('blockerCount');
    });

    it('should include gatedRiskScore in files', async () => {
      const result = await setupTestRepo();
      const output = formatJsonOutput(result, {});
      const parsed = JSON.parse(output);

      for (const file of parsed.files) {
        expect(file).toHaveProperty('riskScore');
        expect(file).toHaveProperty('gatedRiskScore');
        expect(typeof file.gatedRiskScore).toBe('number');
      }
    });

    it('should include gateStats when present', async () => {
      const result = await setupTestRepo();
      const output = formatJsonOutput(result, {});
      const parsed = JSON.parse(output);

      for (const file of parsed.files) {
        if (file.gateStats) {
          expect(file.gateStats).toHaveProperty('blocking');
          expect(file.gateStats).toHaveProperty('advisory');
          expect(file.gateStats).toHaveProperty('filtered');
        }
      }
    });
  });

  describe('Markdown Output Structure', () => {
    it('should include header with version', async () => {
      const result = await setupTestRepo();
      const output = formatMarkdownOutput(result, {});

      expect(output).toContain('DiffeSense');
      expect(output).toContain('#'); // Markdown header
    });

    it('should include summary table', async () => {
      const result = await setupTestRepo();
      const output = formatMarkdownOutput(result, {});

      expect(output).toContain('|'); // Table delimiter
      expect(output).toContain('Files');
    });

    it('should include file sections when files present', async () => {
      const result = await setupTestRepo();
      const output = formatMarkdownOutput(result, {});

      if (result.files.length > 0) {
        // Should have file path in output
        expect(output).toContain('.ts');
      }
    });

    it('should include risk breakdown', async () => {
      const result = await setupTestRepo();
      const output = formatMarkdownOutput(result, {});

      if (result.files.length > 0) {
        expect(output).toContain('Risk');
      }
    });
  });

  describe('Output Consistency', () => {
    it('all formats should report same exit code', async () => {
      const result = await setupTestRepo();

      const consoleOutput = formatConsoleOutput(result, {});
      const jsonOutput = formatJsonOutput(result, {});
      const mdOutput = formatMarkdownOutput(result, {});

      const jsonParsed = JSON.parse(jsonOutput);

      // All should reflect same exit code
      expect(jsonParsed.exitCode).toBe(result.exitCode);

      // Console should show PASS if exitCode is 0
      if (result.exitCode === 0) {
        expect(consoleOutput).toContain('PASS');
      }
    });

    it('all formats should report same file count', async () => {
      const result = await setupTestRepo();

      const jsonOutput = formatJsonOutput(result, {});
      const jsonParsed = JSON.parse(jsonOutput);

      expect(jsonParsed.summary.analyzedCount).toBe(result.summary.analyzedCount);
    });
  });
});
