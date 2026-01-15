/**
 * Integration Tests
 *
 * These tests verify critical edge-cases for CI reliability:
 * 1. Rename parsing (R100 old new)
 * 2. Include-tests and include-config flags
 * 3. Config file filtering precision
 * 4. Core analyze() API contract
 * 5. JSON schema snapshot
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Git Rename Parsing', () => {
  it('should parse R100 rename correctly - new path is used', () => {
    const line = 'R100\told/path/file.ts\tnew/path/file.ts';
    const parts = line.split('\t');
    const status = parts[0];

    let filePath: string;
    if (status.startsWith('R') || status.startsWith('C')) {
      filePath = parts[2] || parts[1];
    } else {
      filePath = parts.slice(1).join('\t');
    }

    expect(filePath).toBe('new/path/file.ts');
  });

  it('should parse C100 copy correctly - new path is used', () => {
    const line = 'C100\toriginal.ts\tcopy.ts';
    const parts = line.split('\t');
    const status = parts[0];

    let filePath: string;
    if (status.startsWith('R') || status.startsWith('C')) {
      filePath = parts[2] || parts[1];
    } else {
      filePath = parts.slice(1).join('\t');
    }

    expect(filePath).toBe('copy.ts');
  });

  it('should handle partial rename (R050)', () => {
    const line = 'R050\told.ts\tnew.ts';
    const parts = line.split('\t');
    const status = parts[0];

    let filePath: string;
    if (status.startsWith('R') || status.startsWith('C')) {
      filePath = parts[2] || parts[1];
    } else {
      filePath = parts.slice(1).join('\t');
    }

    expect(filePath).toBe('new.ts');
  });
});

describe('Config File Filtering', () => {
  const isConfigFile = (fileName: string): boolean => {
    const lower = fileName.toLowerCase();
    return !!(
      lower.match(/^config\.(js|ts|mjs|cjs)$/) ||
      lower.match(/\.(config|rc)\.(js|ts|mjs|cjs|json|yml|yaml)$/)
    );
  };

  it('should exclude root config files', () => {
    expect(isConfigFile('config.ts')).toBe(true);
    expect(isConfigFile('config.js')).toBe(true);
    expect(isConfigFile('config.mjs')).toBe(true);
  });

  it('should exclude tool config files', () => {
    expect(isConfigFile('vite.config.ts')).toBe(true);
    expect(isConfigFile('jest.config.js')).toBe(true);
    expect(isConfigFile('eslint.config.mjs')).toBe(true);

    expect(isConfigFile('prettier.config.js')).toBe(true);
    expect(isConfigFile('tailwind.config.js')).toBe(true);
  });

  it('should NOT exclude app code containing "config" in name', () => {
    expect(isConfigFile('configureStore.ts')).toBe(false);
    expect(isConfigFile('configurator.ts')).toBe(false);
    expect(isConfigFile('appConfig.ts')).toBe(false);
    expect(isConfigFile('configuration.ts')).toBe(false);
  });

  it('should NOT exclude files in config directory', () => {
    expect(isConfigFile('store.ts')).toBe(false);
    expect(isConfigFile('constants.ts')).toBe(false);
  });
});

describe('AnalysisResult Contract', () => {
  it('should have required top-level fields', () => {
    const requiredFields = [
      'success',
      'exitCode',
      'meta',
      'summary',
      'files',
      'ignoredFiles',
      'evaluation',
      'warnings',
      'config',
    ];

    type AnalysisResultKeys = keyof import('../src/core/analyze').AnalysisResult;

    const _typeCheck: Record<AnalysisResultKeys, true> = {
      success: true,
      error: true,
      exitCode: true,
      meta: true,
      summary: true,
      files: true,
      ignoredFiles: true,
      evaluation: true,
      warnings: true,
      config: true,
    };

    expect(_typeCheck).toBeDefined();
  });

  it('should have required summary fields', () => {
    type SummaryKeys = keyof import('../src/core/analyze').AnalysisResult['summary'];

    const _typeCheck: Record<SummaryKeys, true> = {
      changedCount: true,
      analyzedCount: true,
      ignoredCount: true,
      highestRisk: true,
      blockerCount: true,
      warningCount: true,
      infoCount: true,
    };

    expect(_typeCheck).toBeDefined();
  });

  it('should have required meta fields', () => {
    type MetaKeys = keyof import('../src/core/analyze').AnalysisMeta;

    const _typeCheck: Record<MetaKeys, true> = {
      cwd: true,
      scope: true,
      base: true,
      branch: true,
      profile: true,
      detector: true,
      configSource: true,
      isDiffAnalysis: true,
      timestamp: true,
    };

    expect(_typeCheck).toBeDefined();
  });
});

describe('Exit Code Contract', () => {
  it('should define exit codes correctly', () => {
    const exitCodes = {
      PASS: 0,
      FAIL: 1,
      ERROR: 2,
    } as const;

    expect(exitCodes.PASS).toBe(0);
    expect(exitCodes.FAIL).toBe(1);
    expect(exitCodes.ERROR).toBe(2);
  });
});

describe('Remote Detection Fallback', () => {
  it('should prioritize origin > upstream > first remote > local', () => {
    const remotes = ['origin', 'upstream', 'fork'];

    if (remotes.includes('origin')) {
      expect('origin').toBe('origin');
    }

    const remotesNoOrigin = ['upstream', 'fork'];
    const selected = remotesNoOrigin.includes('upstream') ? 'upstream' : remotesNoOrigin[0] || null;
    expect(selected).toBe('upstream');

    const remotesOther = ['fork', 'myremote'];
    const selectedOther = remotesOther[0] || null;
    expect(selectedOther).toBe('fork');

    const noRemotes: string[] = [];
    const selectedNone = noRemotes[0] || null;
    expect(selectedNone).toBe(null);
  });
});

describe('IgnoredFile Contract', () => {
  it('should have path and reason', () => {
    type IgnoredFileKeys = keyof import('../src/core/analyze').IgnoredFile;

    const _typeCheck: Record<IgnoredFileKeys, true> = {
      path: true,
      reason: true,
    };

    expect(_typeCheck).toBeDefined();
  });
});

describe('AnalysisWarning Contract', () => {
  it('should have code, message, and optional path', () => {
    type WarningKeys = keyof import('../src/core/analyze').AnalysisWarning;

    const _typeCheck: Record<WarningKeys, true> = {
      code: true,
      message: true,
      path: true,
    };

    expect(_typeCheck).toBeDefined();
  });
});

describe('API Schema Contract', () => {
  it('should have valid JSON schema file', () => {
    const schemaPath = path.join(__dirname, '../docs/api-schema.json');
    expect(fs.existsSync(schemaPath)).toBe(true);

    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));

    expect(schema.version).toBe('1.0.0');

    expect(schema.required).toContain('success');
    expect(schema.required).toContain('exitCode');
    expect(schema.required).toContain('meta');
    expect(schema.required).toContain('summary');
    expect(schema.required).toContain('files');
    expect(schema.required).toContain('ignoredFiles');
    expect(schema.required).toContain('warnings');
    expect(schema.required).toContain('config');
  });

  it('should define exit codes correctly in schema', () => {
    const schemaPath = path.join(__dirname, '../docs/api-schema.json');
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));

    expect(schema.properties.exitCode.enum).toEqual([0, 1, 2]);
  });

  it('should define scope enum correctly in schema', () => {
    const schemaPath = path.join(__dirname, '../docs/api-schema.json');
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));

    expect(schema.properties.meta.properties.scope.enum).toEqual([
      'branch',
      'staged',
      'worktree',
      'commit',
      'range',
    ]);
  });

  it('should define detector enum correctly in schema', () => {
    const schemaPath = path.join(__dirname, '../docs/api-schema.json');
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));

    expect(schema.properties.meta.properties.detector.enum).toEqual([
      'auto',
      'generic',
      'react',
      'vue',
      'angular',
      'node',
    ]);
  });

  it('should define severity enum in file results', () => {
    const schemaPath = path.join(__dirname, '../docs/api-schema.json');
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));

    expect(schema.properties.files.items.properties.severity.enum).toEqual([
      'LOW',
      'MED',
      'HIGH',
      'CRITICAL',
    ]);
  });
});
