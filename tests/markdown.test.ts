import { describe, it, expect } from 'vitest';
import { formatMarkdownOutput } from '../src/output/formatters/dsMarkdown';
import { EvaluationResult, RuleResult, AnalyzedFile } from '../src/policy/engine';
import { OutputContext } from '../src/output/formatters/dsConsole';

// Helper to create mock analyzed file
function createMockFile(
  path: string,
  riskScore: number,
  blastRadius: number = 0,
  options: Partial<AnalyzedFile> = {},
): AnalyzedFile {
  return {
    path,
    riskScore,
    blastRadius,
    evidence: [],
    riskReasons: [`Risk from ${path}`],
    signals: [],
    changedLines: 10,
    isDiffAnalysis: true,
    ...options,
  };
}

// Helper to create mock rule result
function createMockResult(
  path: string,
  riskScore: number,
  severity: 'blocker' | 'warning' | 'info' = 'warning',
): RuleResult {
  return {
    file: createMockFile(path, riskScore),
    severity,
    rule: {
      id: 'test-rule',
      name: 'Test Rule',
      condition: 'always',
      severity,
      message: 'Test message',
    },
    message: 'Test message',
    actions: [{ type: 'review', text: 'Review this file' }],
  };
}

describe('Markdown Formatter', () => {
  const mockContext: OutputContext = {
    scope: 'branch',
    base: 'main',
    branch: 'feature',
    changedCount: 10,
    analyzedCount: 10,
    profile: 'minimal',
  };

  describe('formatMarkdownOutput', () => {
    it('should format PR comment with status and risk', () => {
      const result: EvaluationResult = {
        blockers: [],
        warnings: [createMockResult('src/api.ts', 7.0)],
        infos: [],
        exitCode: 0,
      };

      const output = formatMarkdownOutput(result, mockContext);

      expect(output).toContain('## DiffeSense Risk Report');
      expect(output).toContain('**Status:**');
      expect(output).toContain('**PR Risk:**');
      expect(output).toContain('**Top risks:**');
    });

    it('should show PASS status when no blockers', () => {
      const result: EvaluationResult = {
        blockers: [],
        warnings: [],
        infos: [createMockResult('src/utils.ts', 3.0, 'info')],
        exitCode: 0,
      };

      const output = formatMarkdownOutput(result, mockContext);

      expect(output).toContain('✔ PASS');
    });

    it('should show FAIL status when blockers exist', () => {
      const result: EvaluationResult = {
        blockers: [createMockResult('src/auth.ts', 9.0, 'blocker')],
        warnings: [],
        infos: [],
        exitCode: 1,
      };

      const output = formatMarkdownOutput(result, mockContext);

      expect(output).toContain('✖ FAIL');
    });

    it('should show WARN status when warnings exist but no blockers', () => {
      const result: EvaluationResult = {
        blockers: [],
        warnings: [createMockResult('src/api.ts', 6.0)],
        infos: [],
        exitCode: 0,
      };

      const output = formatMarkdownOutput(result, mockContext);

      expect(output).toContain('! WARN');
    });

    it('should include table with File | Risk | Why | Next action', () => {
      const result: EvaluationResult = {
        blockers: [],
        warnings: [createMockResult('src/api.ts', 7.0)],
        infos: [],
        exitCode: 0,
      };

      const output = formatMarkdownOutput(result, mockContext);

      expect(output).toContain('| File | Risk | Why | Next action |');
      expect(output).toContain('|------|------|-----|-------------|');
      expect(output).toContain('`src/api.ts`');
      expect(output).toContain('7.0');
    });

    it('should show hidden issues count when limited', () => {
      const result: EvaluationResult = {
        blockers: [],
        warnings: [
          createMockResult('src/a.ts', 8.0),
          createMockResult('src/b.ts', 7.0),
          createMockResult('src/c.ts', 6.0),
          createMockResult('src/d.ts', 5.0),
          createMockResult('src/e.ts', 4.0),
        ],
        infos: [],
        exitCode: 0,
      };

      const output = formatMarkdownOutput(result, mockContext, { topN: 3 });

      expect(output).toContain('+2 more issue(s) not shown');
      expect(output).toContain('--show-all');
    });

    it('should include selection criteria rationale', () => {
      const result: EvaluationResult = {
        blockers: [],
        warnings: [createMockResult('src/api.ts', 7.0)],
        infos: [],
        exitCode: 0,
      };

      const output = formatMarkdownOutput(result, mockContext);

      expect(output).toContain('**Selection criteria:**');
      expect(output.toLowerCase()).toContain('risk');
    });

    it('should include collapsible details section', () => {
      const result: EvaluationResult = {
        blockers: [],
        warnings: [createMockResult('src/api.ts', 7.0)],
        infos: [],
        exitCode: 0,
      };

      const output = formatMarkdownOutput(result, mockContext, { includeDetails: true });

      expect(output).toContain('<details>');
      expect(output).toContain('<summary>📋 Details</summary>');
      expect(output).toContain('</details>');
    });

    it('should show clean message when no issues', () => {
      const result: EvaluationResult = {
        blockers: [],
        warnings: [],
        infos: [],
        exitCode: 0,
      };

      const output = formatMarkdownOutput(result, mockContext);

      expect(output).toContain('All changed files are within acceptable risk levels');
      expect(output).toContain('✨');
    });

    it('should include footer with stats', () => {
      const result: EvaluationResult = {
        blockers: [],
        warnings: [createMockResult('src/api.ts', 7.0)],
        infos: [],
        exitCode: 0,
      };

      const output = formatMarkdownOutput(result, mockContext);

      expect(output).toContain('10 files analyzed');
      expect(output).toContain('Profile: minimal');
      expect(output).toContain('Exit: 0');
    });

    it('should show all issues when showAll is true', () => {
      const result: EvaluationResult = {
        blockers: [],
        warnings: [
          createMockResult('src/a.ts', 8.0),
          createMockResult('src/b.ts', 7.0),
          createMockResult('src/c.ts', 6.0),
          createMockResult('src/d.ts', 5.0),
          createMockResult('src/e.ts', 4.0),
        ],
        infos: [],
        exitCode: 0,
      };

      const output = formatMarkdownOutput(result, mockContext, { showAll: true });

      // Should show all 5 files
      expect(output).toContain('`src/a.ts`');
      expect(output).toContain('`src/b.ts`');
      expect(output).toContain('`src/c.ts`');
      expect(output).toContain('`src/d.ts`');
      expect(output).toContain('`src/e.ts`');
      // Should not show hidden message
      expect(output).not.toContain('more issue(s) not shown');
    });
  });
});

