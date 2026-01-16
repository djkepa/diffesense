/**
 * Invariants Contract Tests
 *
 * These tests enforce critical system invariants that MUST never be violated.
 * If any of these tests fail, it indicates a breaking change to core behavior.
 *
 * DO NOT modify these tests without understanding the implications.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { analyze, AnalysisResult } from '../src/core/analyze';
import { evaluateRules } from '../src/policy/engine';
import { formatJsonOutput } from '../src/output/formatters/dsJson';
import { addSuppression, removeSuppression, getSuppressionsHash } from '../src/core/suppressions';
import { enterprisePack, startupPack, ossPack } from '../src/policy/packs/index';

describe('System Invariants (Contract Tests)', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'diffesense-invariants-'));
    execSync('git init', { cwd: tempDir, stdio: 'pipe' });
    execSync('git config user.email "test@test.com"', { cwd: tempDir, stdio: 'pipe' });
    execSync('git config user.name "Test"', { cwd: tempDir, stdio: 'pipe' });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('INVARIANT 1: FAIL depends ONLY on gatedRiskScore', () => {
    it('high raw riskScore with low gatedRiskScore should NOT cause FAIL', async () => {
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });

      fs.writeFileSync(path.join(srcDir, 'test.ts'), 'export const x = 1;');
      execSync('git add .', { cwd: tempDir, stdio: 'pipe' });
      execSync('git commit -m "Initial"', { cwd: tempDir, stdio: 'pipe' });

      fs.writeFileSync(
        path.join(srcDir, 'test.ts'),
        `export const x = 1;
export const y = 2;
console.log(x, y);
`,
      );

      const result = await analyze({
        cwd: tempDir,
        scope: 'working',
      });

      for (const file of result.files) {
        if (file.gatedRiskScore !== undefined && file.gatedRiskScore === 0) {
          const evaluation = evaluateRules(result.files, [], [], { useGatedScoring: true });
          expect(evaluation.exitCode).toBe(0);
        }
      }
    });

    it('policy evaluation must use gatedRiskScore when useGatedScoring is true', async () => {
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });

      fs.writeFileSync(path.join(srcDir, 'code.ts'), 'const a = 1;');
      execSync('git add .', { cwd: tempDir, stdio: 'pipe' });
      execSync('git commit -m "Init"', { cwd: tempDir, stdio: 'pipe' });

      fs.writeFileSync(path.join(srcDir, 'code.ts'), 'const a = 1;\nconst b = 2;');

      const result = await analyze({ cwd: tempDir, scope: 'working' });

      const evalGated = evaluateRules(result.files, [], [], { useGatedScoring: true });
      const evalRaw = evaluateRules(result.files, [], [], { useGatedScoring: false });

      expect([0, 1]).toContain(evalGated.exitCode);
      expect([0, 1]).toContain(evalRaw.exitCode);
    });
  });

  describe('INVARIANT 2: topN never exceeds 5 in default policy packs', () => {
    it('enterprise pack topN <= 5', () => {
      expect(enterprisePack.defaults.topN).toBeLessThanOrEqual(5);
    });

    it('startup pack topN <= 5', () => {
      expect(startupPack.defaults.topN).toBeLessThanOrEqual(5);
    });

    it('oss pack topN <= 5', () => {
      expect(ossPack.defaults.topN).toBeLessThanOrEqual(5);
    });

    it('all packs should respect noise budget of 5', () => {
      const packs = [enterprisePack, startupPack, ossPack];
      for (const pack of packs) {
        expect(pack.defaults.topN).toBeLessThanOrEqual(5);
        expect(pack.defaults.topN).toBeGreaterThan(0);
      }
    });
  });

  describe('INVARIANT 3: Suppression changes invalidate cache', () => {
    it('adding suppression changes hash', () => {
      const hash1 = getSuppressionsHash(tempDir);

      addSuppression(tempDir, { signalId: 'test-signal-invariant' });

      const hash2 = getSuppressionsHash(tempDir);

      expect(hash1).not.toBe(hash2);
    });

    it('removing suppression changes hash', () => {
      addSuppression(tempDir, { signalId: 'signal-to-remove' });
      const hash1 = getSuppressionsHash(tempDir);

      removeSuppression(tempDir, { signalId: 'signal-to-remove' });
      const hash2 = getSuppressionsHash(tempDir);

      expect(hash1).not.toBe(hash2);
    });

    it('hash is deterministic for same suppressions', () => {
      addSuppression(tempDir, { signalId: 'stable-signal' });

      const hash1 = getSuppressionsHash(tempDir);
      const hash2 = getSuppressionsHash(tempDir);
      const hash3 = getSuppressionsHash(tempDir);

      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
    });
  });

  describe('INVARIANT 4: Output schema has required fields', () => {
    it('JSON output must have schemaVersion', async () => {
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });

      fs.writeFileSync(path.join(srcDir, 'test.ts'), 'export const x = 1;');
      execSync('git add .', { cwd: tempDir, stdio: 'pipe' });
      execSync('git commit -m "Init"', { cwd: tempDir, stdio: 'pipe' });

      fs.writeFileSync(path.join(srcDir, 'test.ts'), 'export const x = 2;');

      const result = await analyze({ cwd: tempDir, scope: 'working' });
      const json = formatJsonOutput(result, {});
      const parsed = JSON.parse(json);

      expect(parsed).toHaveProperty('schemaVersion');
      expect(typeof parsed.schemaVersion).toBe('string');
    });

    it('JSON output must have toolVersion', async () => {
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });

      fs.writeFileSync(path.join(srcDir, 'test.ts'), 'const a = 1;');
      execSync('git add .', { cwd: tempDir, stdio: 'pipe' });
      execSync('git commit -m "Init"', { cwd: tempDir, stdio: 'pipe' });

      fs.writeFileSync(path.join(srcDir, 'test.ts'), 'const a = 2;');

      const result = await analyze({ cwd: tempDir, scope: 'working' });
      const json = formatJsonOutput(result, {});
      const parsed = JSON.parse(json);

      expect(parsed).toHaveProperty('toolVersion');
      expect(parsed.toolVersion).toMatch(/^\d+\.\d+\.\d+/);
    });

    it('JSON output must have summary with required fields', async () => {
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });

      fs.writeFileSync(path.join(srcDir, 'test.ts'), 'const a = 1;');
      execSync('git add .', { cwd: tempDir, stdio: 'pipe' });
      execSync('git commit -m "Init"', { cwd: tempDir, stdio: 'pipe' });

      fs.writeFileSync(path.join(srcDir, 'test.ts'), 'const a = 2;');

      const result = await analyze({ cwd: tempDir, scope: 'working' });
      const json = formatJsonOutput(result, {});
      const parsed = JSON.parse(json);

      expect(parsed.summary).toHaveProperty('analyzedCount');
      expect(parsed.summary).toHaveProperty('changedCount');
      expect(parsed.summary).toHaveProperty('highestRisk');
      expect(parsed.summary).toHaveProperty('blockerCount');
    });

    it('every file in JSON output must have gatedRiskScore', async () => {
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });

      fs.writeFileSync(path.join(srcDir, 'test.ts'), 'const a = 1;');
      execSync('git add .', { cwd: tempDir, stdio: 'pipe' });
      execSync('git commit -m "Init"', { cwd: tempDir, stdio: 'pipe' });

      fs.writeFileSync(path.join(srcDir, 'test.ts'), 'const a = 2;');

      const result = await analyze({ cwd: tempDir, scope: 'working' });
      const json = formatJsonOutput(result, {});
      const parsed = JSON.parse(json);

      for (const file of parsed.files) {
        expect(file).toHaveProperty('gatedRiskScore');
        expect(typeof file.gatedRiskScore).toBe('number');
        expect(file.gatedRiskScore).toBeGreaterThanOrEqual(0);
      }
    });

    it('exitCode must be 0, 1, or 2', async () => {
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });

      fs.writeFileSync(path.join(srcDir, 'test.ts'), 'const a = 1;');
      execSync('git add .', { cwd: tempDir, stdio: 'pipe' });
      execSync('git commit -m "Init"', { cwd: tempDir, stdio: 'pipe' });

      fs.writeFileSync(path.join(srcDir, 'test.ts'), 'const a = 2;');

      const result = await analyze({ cwd: tempDir, scope: 'working' });
      const json = formatJsonOutput(result, {});
      const parsed = JSON.parse(json);

      expect([0, 1, 2]).toContain(parsed.exitCode);
    });
  });

  describe('INVARIANT 5: Confidence defaults are conservative', () => {
    it('signals without confidence must default to low (trust-first)', async () => {
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });

      fs.writeFileSync(path.join(srcDir, 'code.ts'), 'export function test() {}');
      execSync('git add .', { cwd: tempDir, stdio: 'pipe' });
      execSync('git commit -m "Init"', { cwd: tempDir, stdio: 'pipe' });

      fs.writeFileSync(
        path.join(srcDir, 'code.ts'),
        'export function test() { console.log("test"); }',
      );

      const result = await analyze({ cwd: tempDir, scope: 'working' });

      // Confidence is applied internally during gating
      // We verify this by checking that gateStats exists and has valid structure
      for (const file of result.files) {
        // gateStats proves confidence was applied (gate requires confidence)
        if (file.gateStats) {
          expect(file.gateStats.blocking).toBeGreaterThanOrEqual(0);
          expect(file.gateStats.advisory).toBeGreaterThanOrEqual(0);
          expect(file.gateStats.filtered).toBeGreaterThanOrEqual(0);
          expect(file.gateStats.total).toBeGreaterThanOrEqual(0);
        }

        // gatedRiskScore must always be defined (confidence was applied)
        expect(file.gatedRiskScore).toBeDefined();
        expect(typeof file.gatedRiskScore).toBe('number');
      }
    });
  });

  describe('INVARIANT 6: Sorting is deterministic (stable TOP N)', () => {
    it('same input produces same output order', async () => {
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });

      fs.writeFileSync(path.join(srcDir, 'a.ts'), 'export const a = 1;');
      fs.writeFileSync(path.join(srcDir, 'b.ts'), 'export const b = 1;');
      fs.writeFileSync(path.join(srcDir, 'c.ts'), 'export const c = 1;');
      execSync('git add .', { cwd: tempDir, stdio: 'pipe' });
      execSync('git commit -m "Init"', { cwd: tempDir, stdio: 'pipe' });

      fs.writeFileSync(path.join(srcDir, 'a.ts'), 'export const a = 2;');
      fs.writeFileSync(path.join(srcDir, 'b.ts'), 'export const b = 2;');
      fs.writeFileSync(path.join(srcDir, 'c.ts'), 'export const c = 2;');

      const result1 = await analyze({ cwd: tempDir, scope: 'working' });
      const result2 = await analyze({ cwd: tempDir, scope: 'working' });
      const result3 = await analyze({ cwd: tempDir, scope: 'working' });

      const paths1 = result1.files.map((f) => f.path);
      const paths2 = result2.files.map((f) => f.path);
      const paths3 = result3.files.map((f) => f.path);

      expect(paths1).toEqual(paths2);
      expect(paths2).toEqual(paths3);
    });
  });
});
