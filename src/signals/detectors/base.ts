/**
 * Base Signal Detector
 */

import {
  Signal,
  SignalClass,
  Severity,
  Confidence,
  SignalCategory,
  ChangedRange,
  Evidence,
  ActionRecommendation,
  getSignalClassFromId,
  getSeverityFromClassAndWeight,
} from '../types';

/**
 * Detector context with diff information
 */
export interface DetectorContext {
  filePath: string;
  content: string;
  lines: string[];
  changedRanges?: ChangedRange[];
  contextLines?: number;
}

export interface DetectorOptions {
  changedRanges?: ChangedRange[];
  contextLines?: number;
}

export interface PatternDef {
  id: string;
  pattern: RegExp;
  category: SignalCategory;
  title: string;
  reason: string;
  weight: number;
  signalClass?: SignalClass;
  confidence?: Confidence;
  tags?: string[];
  criticalOnly?: boolean;
  framework?: 'react' | 'vue' | 'angular' | 'node' | 'generic';
}

export class BaseDetector {
  protected ctx: DetectorContext;
  protected changedLineNumbers: Set<number>;
  protected focusLineNumbers: Set<number>;

  constructor(content: string, filePath: string, changedRanges?: ChangedRange[], contextLines = 5) {
    this.ctx = {
      filePath,
      content,
      lines: content.split('\n'),
      changedRanges,
      contextLines,
    };

    this.changedLineNumbers = new Set<number>();
    this.focusLineNumbers = new Set<number>();

    if (changedRanges && changedRanges.length > 0) {
      for (const range of changedRanges) {
        for (let line = range.startLine; line <= range.endLine; line++) {
          this.changedLineNumbers.add(line);
        }
        const start = Math.max(1, range.startLine - contextLines);
        const end = Math.min(this.ctx.lines.length, range.endLine + contextLines);
        for (let line = start; line <= end; line++) {
          this.focusLineNumbers.add(line);
        }
      }
    } else {
      for (let i = 1; i <= this.ctx.lines.length; i++) {
        this.focusLineNumbers.add(i);
        this.changedLineNumbers.add(i);
      }
    }
  }

  protected isChangedLine(lineNumber: number): boolean {
    return this.changedLineNumbers.has(lineNumber);
  }

  protected shouldAnalyzeLine(lineNumber: number): boolean {
    return this.focusLineNumbers.has(lineNumber);
  }

  protected getSnippet(startLine: number, endLine?: number): string {
    const start = Math.max(0, startLine - 1);
    const end = endLine ? Math.min(this.ctx.lines.length, endLine) : start + 1;
    return this.ctx.lines.slice(start, end).join('\n');
  }

  protected createSignal(params: {
    id: string;
    title: string;
    category: SignalCategory;
    reason: string;
    weight: number;
    lines?: number[];
    snippet?: string;
    confidence?: Confidence;
    signalClass?: SignalClass;
    tags?: string[];
    evidence?: Evidence;
    actions?: ActionRecommendation[];
    meta?: Record<string, unknown>;
  }): Signal {
    const signalClass = params.signalClass || getSignalClassFromId(params.id);
    const severity = getSeverityFromClassAndWeight(signalClass, params.weight);
    const inChangedRange = params.lines?.some((l) => this.isChangedLine(l)) ?? false;

    return {
      id: params.id,
      title: params.title,
      class: signalClass,
      category: params.category,
      severity,
      confidence: params.confidence || 'medium',
      weight: params.weight,
      filePath: this.ctx.filePath,
      lines: params.lines || [],
      snippet: params.snippet,
      reason: params.reason,
      evidence: params.evidence || { kind: 'regex' },
      actions: params.actions,
      tags: params.tags,
      inChangedRange,
      meta: params.meta,
    };
  }

  detect(): Signal[] {
    return [
      ...this.detectComplexity(),
      ...this.detectSideEffects(),
      ...this.detectAsync(),
      ...this.detectSignaturePatterns(),
      ...this.detectSecurity(),
      ...this.detectCorrectness(),
      ...this.detectMaintainability(),
    ];
  }

  protected detectComplexity(): Signal[] {
    const signals: Signal[] = [];
    const { lines } = this.ctx;
    const loc = lines.length;

    const changedLineCount = this.changedLineNumbers.size;
    const changeRatio = changedLineCount / loc;

    if (loc > 500 && changeRatio > 0.1) {
      signals.push(
        this.createSignal({
          id: 'large-file',
          title: 'Large File',
          category: 'complexity',
          reason: `Large file (${loc} lines) with ${changedLineCount} lines changed (${(
            changeRatio * 100
          ).toFixed(0)}%)`,
          weight: 0.8 * changeRatio,
          signalClass: 'maintainability',
          confidence: 'high',
          tags: ['complexity', 'size'],
          evidence: { kind: 'heuristic', details: { loc, changedLineCount, changeRatio } },
        }),
      );
    } else if (loc > 300 && changeRatio > 0.15) {
      signals.push(
        this.createSignal({
          id: 'large-file',
          title: 'Medium-Large File',
          category: 'complexity',
          reason: `Medium-large file (${loc} lines) with ${changedLineCount} lines changed`,
          weight: 0.4 * changeRatio,
          signalClass: 'maintainability',
          confidence: 'high',
          tags: ['complexity', 'size'],
          evidence: { kind: 'heuristic', details: { loc, changedLineCount, changeRatio } },
        }),
      );
    }

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const line = lines[i];
      const leadingSpaces = line.match(/^(\s*)/)?.[1]?.length || 0;
      const indentLevel = Math.floor(leadingSpaces / 2);

      if (indentLevel >= 5 && line.trim().length > 0) {
        signals.push(
          this.createSignal({
            id: 'deep-nesting',
            title: 'Deep Nesting',
            category: 'complexity',
            reason: `Deep nesting at level ${indentLevel} makes code harder to understand`,
            weight: 0.3,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'maintainability',
            confidence: 'high',
            tags: ['complexity', 'nesting'],
            evidence: { kind: 'heuristic', details: { indentLevel } },
          }),
        );
      }
    }

    const functionStarts = this.findFunctionStarts();
    for (const { line, length, endLine } of functionStarts) {
      let hasChangedLine = false;
      for (let l = line; l <= endLine; l++) {
        if (this.isChangedLine(l)) {
          hasChangedLine = true;
          break;
        }
      }

      if (hasChangedLine && length > 50) {
        signals.push(
          this.createSignal({
            id: 'long-function',
            title: 'Long Function',
            category: 'complexity',
            reason: `Function is ${length} lines long, consider breaking it down`,
            weight: 0.5,
            lines: [line],
            snippet: this.getSnippet(line, Math.min(line + 5, endLine)),
            signalClass: 'maintainability',
            confidence: 'medium',
            tags: ['complexity', 'function-length'],
            evidence: { kind: 'heuristic', details: { length, startLine: line, endLine } },
          }),
        );
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const line = lines[i];
      const paramMatch = line.match(
        /(?:function\s+\w+|(?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?)?\(([^)]{80,})\)/,
      );
      if (paramMatch) {
        const params = paramMatch[1].split(',').length;
        if (params >= 5) {
          signals.push(
            this.createSignal({
              id: 'high-params',
              title: 'High Parameter Count',
              category: 'complexity',
              reason: `Function has ${params} parameters, consider using an options object`,
              weight: 0.3,
              lines: [lineNum],
              snippet: this.getSnippet(lineNum),
              signalClass: 'maintainability',
              confidence: 'high',
              tags: ['complexity', 'parameters'],
              evidence: { kind: 'regex', pattern: 'function params', details: { params } },
            }),
          );
        }
      }
    }

    return signals;
  }

  /**
   * Detect side-effect signals - ONLY in changed/focus lines
   */
  protected detectSideEffects(): Signal[] {
    const signals: Signal[] = [];
    const { lines } = this.ctx;

    const patterns: PatternDef[] = [
      {
        id: 'network-fetch',
        pattern: /\bfetch\s*\(/,
        category: 'side-effect',
        title: 'Fetch Call',
        reason: 'Network fetch call - verify error handling and loading states',
        weight: 0.5,
        tags: ['network', 'async'],
      },
      {
        id: 'network-axios',
        pattern: /\baxios\b/,
        category: 'side-effect',
        title: 'Axios Call',
        reason: 'Axios HTTP call - verify error handling and timeouts',
        weight: 0.5,
        tags: ['network', 'async'],
      },
      {
        id: 'network-websocket',
        pattern: /\bWebSocket\b/,
        category: 'side-effect',
        title: 'WebSocket',
        reason: 'WebSocket connection - verify cleanup and reconnection logic',
        weight: 0.6,
        tags: ['network', 'realtime'],
      },

      {
        id: 'storage-local',
        pattern: /localStorage\b/,
        category: 'side-effect',
        title: 'LocalStorage Access',
        reason: 'LocalStorage access - consider SSR compatibility',
        weight: 0.4,
        tags: ['storage', 'browser'],
      },
      {
        id: 'storage-session',
        pattern: /sessionStorage\b/,
        category: 'side-effect',
        title: 'SessionStorage Access',
        reason: 'SessionStorage access - consider SSR compatibility',
        weight: 0.4,
        tags: ['storage', 'browser'],
      },
      {
        id: 'storage-indexeddb',
        pattern: /indexedDB\b/,
        category: 'side-effect',
        title: 'IndexedDB',
        reason: 'IndexedDB access - verify async handling',
        weight: 0.5,
        tags: ['storage', 'browser', 'async'],
      },

      {
        id: 'timer-timeout',
        pattern: /\bsetTimeout\s*\(/,
        category: 'side-effect',
        title: 'setTimeout',
        reason: 'setTimeout - verify cleanup on unmount',
        weight: 0.3,
        tags: ['timer', 'async'],
      },
      {
        id: 'timer-interval',
        pattern: /\bsetInterval\s*\(/,
        category: 'side-effect',
        title: 'setInterval',
        reason: 'setInterval - verify cleanup to prevent memory leaks',
        weight: 0.4,
        tags: ['timer', 'async', 'memory'],
      },

      {
        id: 'global-window',
        pattern: /\bwindow\./,
        category: 'side-effect',
        title: 'Window Access',
        reason: 'Window object access - consider SSR compatibility',
        weight: 0.3,
        tags: ['global', 'browser'],
      },
      {
        id: 'global-mutation',
        pattern: /\bglobal\./,
        category: 'side-effect',
        title: 'Global Access',
        reason: 'Global object mutation - verify scope and side effects',
        weight: 0.3,
        tags: ['global'],
      },

      {
        id: 'process-env',
        pattern: /process\.env/,
        category: 'side-effect',
        title: 'Environment Variable',
        reason: 'Environment variable access - verify availability',
        weight: 0.2,
        tags: ['process', 'config'],
      },
      {
        id: 'process-exit',
        pattern: /process\.exit/,
        category: 'side-effect',
        title: 'Process Exit',
        reason: 'Process exit call - verify this is intentional',
        weight: 0.7,
        signalClass: 'behavioral',
        tags: ['process', 'critical'],
      },
      {
        id: 'process-child',
        pattern: /child_process/,
        category: 'side-effect',
        title: 'Child Process',
        reason: 'Child process spawn - verify security and cleanup',
        weight: 0.6,
        signalClass: 'behavioral',
        tags: ['process', 'security'],
      },

      {
        id: 'fs-operation',
        pattern: /\bfs\./,
        category: 'side-effect',
        title: 'File System Operation',
        reason: 'File system operation - verify error handling',
        weight: 0.5,
        tags: ['filesystem', 'node'],
      },
      {
        id: 'fs-sync',
        pattern: /\breadFileSync\b|\bwriteFileSync\b/,
        category: 'side-effect',
        title: 'Sync File Operation',
        reason: 'Synchronous file operation - consider async alternative',
        weight: 0.6,
        signalClass: 'behavioral',
        tags: ['filesystem', 'sync', 'performance'],
      },

      {
        id: 'database-query',
        pattern: /\.query\s*\(|\.execute\s*\(/,
        category: 'side-effect',
        title: 'Database Query',
        reason: 'Database query - verify SQL injection prevention',
        weight: 0.5,
        signalClass: 'behavioral',
        tags: ['database', 'security'],
      },
      {
        id: 'database-orm',
        pattern: /\bprisma\.|\.findMany\(|\.findUnique\(|\.create\(|\.update\(/,
        category: 'side-effect',
        title: 'ORM Operation',
        reason: 'ORM database operation - verify transaction handling',
        weight: 0.5,
        signalClass: 'behavioral',
        tags: ['database', 'orm'],
      },

      {
        id: 'dom-manipulation',
        pattern: /document\.(getElementById|querySelector|createElement)/,
        category: 'side-effect',
        title: 'DOM Manipulation',
        reason: 'Direct DOM manipulation - consider using framework methods',
        weight: 0.4,
        tags: ['dom', 'browser'],
      },
      {
        id: 'dom-innerhtml',
        pattern: /\.innerHTML\s*=|\.outerHTML\s*=/,
        category: 'side-effect',
        title: 'innerHTML Assignment',
        reason: 'innerHTML assignment - verify XSS prevention',
        weight: 0.5,
        signalClass: 'behavioral',
        tags: ['dom', 'security', 'xss'],
      },

      {
        id: 'logging-console',
        pattern: /console\.(log|warn|error|info)/,
        category: 'side-effect',
        title: 'Console Output',
        reason: 'Console output - remove before production',
        weight: 0.1,
        signalClass: 'maintainability',
        tags: ['logging', 'debug'],
      },
    ];

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const line = lines[i];
      for (const patternDef of patterns) {
        if (patternDef.pattern.test(line)) {
          signals.push(
            this.createSignal({
              id: patternDef.id,
              title: patternDef.title,
              category: patternDef.category,
              reason: patternDef.reason,
              weight: patternDef.weight,
              lines: [lineNum],
              snippet: this.getSnippet(lineNum),
              signalClass: patternDef.signalClass,
              confidence: patternDef.confidence || 'medium',
              tags: patternDef.tags,
              evidence: { kind: 'regex', pattern: patternDef.pattern.source },
            }),
          );
        }
      }
    }

    return signals;
  }

  /**
   * Detect async patterns - ONLY in changed/focus lines
   */
  protected detectAsync(): Signal[] {
    const signals: Signal[] = [];
    const { lines } = this.ctx;

    const asyncLines: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      if (/\basync\s+/.test(lines[i])) {
        asyncLines.push(lineNum);
      }
    }

    if (asyncLines.length > 0) {
      signals.push(
        this.createSignal({
          id: 'async-await',
          title: 'Async Functions',
          category: 'async',
          reason: `${asyncLines.length} async function(s) in changed area - verify error handling`,
          weight: asyncLines.length * 0.2,
          lines: asyncLines,
          signalClass: 'behavioral',
          confidence: 'high',
          tags: ['async', 'error-handling'],
          evidence: { kind: 'regex', pattern: 'async', details: { count: asyncLines.length } },
        }),
      );
    }

    const promisePatterns = [
      { pattern: /new\s+Promise\s*\(/, name: 'new Promise' },
      { pattern: /\.then\s*\(/, name: '.then()' },
      { pattern: /\.catch\s*\(/, name: '.catch()' },
      { pattern: /Promise\.all/, name: 'Promise.all' },
      { pattern: /Promise\.race/, name: 'Promise.race' },
    ];

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const line = lines[i];
      for (const { pattern, name } of promisePatterns) {
        if (pattern.test(line)) {
          signals.push(
            this.createSignal({
              id: 'promise-pattern',
              title: 'Promise Pattern',
              category: 'async',
              reason: `${name} - verify proper error handling and race conditions`,
              weight: 0.2,
              lines: [lineNum],
              snippet: this.getSnippet(lineNum),
              signalClass: 'behavioral',
              confidence: 'medium',
              tags: ['async', 'promise'],
              evidence: { kind: 'regex', pattern: pattern.source },
            }),
          );
          break;
        }
      }
    }

    const eventPatterns = [
      /\.addEventListener\s*\(/,
      /\.on\s*\(\s*['"][^'"]+['"]/,
      /\.once\s*\(/,
      /\.removeEventListener\s*\(/,
    ];

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const line = lines[i];
      for (const pattern of eventPatterns) {
        if (pattern.test(line)) {
          signals.push(
            this.createSignal({
              id: 'event-handler',
              title: 'Event Handler',
              category: 'async',
              reason: 'Event handler - verify cleanup on unmount/destroy',
              weight: 0.3,
              lines: [lineNum],
              snippet: this.getSnippet(lineNum),
              signalClass: 'behavioral',
              confidence: 'medium',
              tags: ['events', 'cleanup'],
              evidence: { kind: 'regex', pattern: pattern.source },
            }),
          );
          break;
        }
      }
    }

    return signals;
  }

  protected detectSignaturePatterns(): Signal[] {
    const signals: Signal[] = [];
    const { lines, filePath } = this.ctx;

    const exportPatterns = [
      {
        pattern: /export\s+(?:default\s+)?function\s+(\w+)/,
        name: 'exported function',
      },
      {
        pattern: /export\s+(?:default\s+)?class\s+(\w+)/,
        name: 'exported class',
      },
      {
        pattern: /export\s+const\s+(\w+)\s*=/,
        name: 'exported const',
      },
      {
        pattern: /module\.exports\s*=/,
        name: 'module.exports',
      },
    ];

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const line = lines[i];
      for (const { pattern, name } of exportPatterns) {
        const match = line.match(pattern);
        if (match) {
          const exportName = match[1] || 'default';
          signals.push(
            this.createSignal({
              id: 'export-change',
              title: 'Export Change',
              category: 'signature',
              reason: `Changed ${name} "${exportName}" - verify dependent modules`,
              weight: 0.3,
              lines: [lineNum],
              snippet: this.getSnippet(lineNum),
              signalClass: 'behavioral',
              confidence: 'high',
              tags: ['api', 'export', 'breaking-change'],
              evidence: { kind: 'regex', pattern: pattern.source, details: { exportName } },
            }),
          );
        }
      }
    }

    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      const typeExportLines: number[] = [];
      for (let i = 0; i < lines.length; i++) {
        const lineNum = i + 1;
        if (!this.shouldAnalyzeLine(lineNum)) continue;

        if (/export\s+(?:type|interface)\s+\w+/.test(lines[i])) {
          typeExportLines.push(lineNum);
        }
      }

      if (typeExportLines.length > 0) {
        signals.push(
          this.createSignal({
            id: 'type-export-change',
            title: 'Type Export Change',
            category: 'signature',
            reason: `${typeExportLines.length} exported type(s) changed - verify type compatibility`,
            weight: typeExportLines.length * 0.2,
            lines: typeExportLines,
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['typescript', 'types', 'api'],
            evidence: {
              kind: 'regex',
              pattern: 'export type/interface',
              details: { count: typeExportLines.length },
            },
          }),
        );
      }
    }

    return signals;
  }

  /**
   * Find function start positions and approximate lengths
   */
  private findFunctionStarts(): Array<{ line: number; length: number; endLine: number }> {
    const results: Array<{ line: number; length: number; endLine: number }> = [];
    const { lines } = this.ctx;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (
        /(?:function\s+\w+|(?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?\(|(?:async\s+)?(?:\w+|\([^)]*\))\s*=>)/.test(
          line,
        )
      ) {
        let length = 1;
        let endLine = i + 1;
        const startIndent = line.match(/^(\s*)/)?.[1]?.length || 0;

        for (let j = i + 1; j < lines.length && j < i + 200; j++) {
          const nextLine = lines[j];
          const nextIndent = nextLine.match(/^(\s*)/)?.[1]?.length || 0;

          if (nextLine.trim() === '}' && nextIndent <= startIndent) {
            length = j - i + 1;
            endLine = j + 1;
            break;
          }

          if (
            nextIndent <= startIndent &&
            /(?:function\s+\w+|(?:const|let|var)\s+\w+\s*=)/.test(nextLine)
          ) {
            length = j - i;
            endLine = j;
            break;
          }
        }

        if (length > 10) {
          results.push({ line: i + 1, length, endLine });
        }
      }
    }

    return results;
  }

  /**
   * SEC-001 to SEC-024: Security signals
   */
  protected detectSecurity(): Signal[] {
    const signals: Signal[] = [];
    const { lines, content, filePath } = this.ctx;

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const line = lines[i];

      if (/\beval\s*\(|new\s+Function\s*\(/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'sec-eval',
            title: 'Dynamic Code Execution',
            category: 'side-effect',
            reason: 'eval/Function() executes arbitrary code - critical security risk',
            weight: 1.0,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'critical',
            confidence: 'high',
            tags: ['security', 'eval', 'injection'],
            evidence: { kind: 'regex', pattern: 'eval|new Function' },
            actions: [
              {
                type: 'review_request',
                text: 'Security review required - dynamic code execution',
                reviewers: ['@security-team'],
              },
            ],
          }),
        );
      }

      if (/dangerouslySetInnerHTML|innerHTML\s*=|insertAdjacentHTML/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'sec-xss-sink',
            title: 'XSS Sink',
            category: 'side-effect',
            reason: 'HTML injection sink - verify input sanitization',
            weight: 0.9,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'critical',
            confidence: 'high',
            tags: ['security', 'xss', 'injection'],
            evidence: { kind: 'regex', pattern: 'innerHTML|dangerouslySetInnerHTML' },
            actions: [
              {
                type: 'mitigation_steps',
                text: 'Prevent XSS',
                steps: [
                  'Use DOMPurify to sanitize HTML',
                  'Validate and escape user input',
                  'Use textContent instead of innerHTML when possible',
                ],
              },
            ],
          }),
        );
      }

      if (/exec\s*\(|execSync\s*\(|spawn\s*\(|spawnSync\s*\(/.test(line)) {
        const hasUserInput = /\$\{|\+\s*\w+|`.*\$/.test(line);
        signals.push(
          this.createSignal({
            id: 'sec-command-injection',
            title: hasUserInput ? 'Command Injection Risk' : 'Shell Execution',
            category: 'side-effect',
            reason: hasUserInput
              ? 'Shell command with dynamic input - command injection risk'
              : 'Shell command execution - verify input validation',
            weight: hasUserInput ? 1.0 : 0.7,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'critical',
            confidence: hasUserInput ? 'high' : 'medium',
            tags: ['security', 'command-injection', 'shell'],
            evidence: { kind: 'regex', pattern: 'exec|spawn' },
            actions: hasUserInput
              ? [
                  {
                    type: 'review_request',
                    text: 'Security review - potential command injection',
                    reviewers: ['@security-team'],
                  },
                ]
              : undefined,
          }),
        );
      }

      if (
        /(?:api[_-]?key|secret|password|token|auth|credential)\s*[=:]\s*['"][^'"]{8,}['"]/i.test(
          line,
        )
      ) {
        signals.push(
          this.createSignal({
            id: 'sec-hardcoded-secret',
            title: 'Hardcoded Secret',
            category: 'side-effect',
            reason: 'Potential hardcoded secret/credential in code',
            weight: 0.9,
            lines: [lineNum],
            snippet: '*** REDACTED ***',
            signalClass: 'critical',
            confidence: 'medium',
            tags: ['security', 'secrets', 'credentials'],
            evidence: { kind: 'regex', pattern: 'hardcoded secret pattern' },
            actions: [
              {
                type: 'mitigation_steps',
                text: 'Remove hardcoded secrets',
                steps: [
                  'Use environment variables',
                  'Use secrets manager (Vault, AWS Secrets, etc.)',
                  'Add to .gitignore if config file',
                ],
              },
            ],
          }),
        );
      }

      if (
        /console\.(log|info|debug|warn)\s*\([^)]*(?:password|token|secret|auth|credential)/i.test(
          line,
        )
      ) {
        signals.push(
          this.createSignal({
            id: 'sec-sensitive-log',
            title: 'Sensitive Data Logging',
            category: 'side-effect',
            reason: 'Logging potentially sensitive data',
            weight: 0.7,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'critical',
            confidence: 'medium',
            tags: ['security', 'logging', 'pii'],
            evidence: { kind: 'regex', pattern: 'console.log with sensitive' },
          }),
        );
      }

      if (/createHash\s*\(\s*['"](?:md5|sha1)['"]\)|\.digest\s*\(\s*['"]hex['"]/.test(line)) {
        if (/md5|sha1/i.test(line)) {
          signals.push(
            this.createSignal({
              id: 'sec-weak-crypto',
              title: 'Weak Cryptography',
              category: 'side-effect',
              reason: 'MD5/SHA1 are weak for security - use SHA256 or bcrypt',
              weight: 0.6,
              lines: [lineNum],
              snippet: this.getSnippet(lineNum),
              signalClass: 'behavioral',
              confidence: 'high',
              tags: ['security', 'crypto', 'weak'],
              evidence: { kind: 'regex', pattern: 'md5|sha1' },
            }),
          );
        }
      }

      if (/cors\s*\(\s*\{[^}]*origin\s*:\s*['"]\*['"]|Access-Control-Allow-Origin.*\*/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'sec-cors-wildcard',
            title: 'CORS Wildcard Origin',
            category: 'side-effect',
            reason: 'CORS allows any origin - verify this is intended',
            weight: 0.6,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['security', 'cors'],
            evidence: { kind: 'regex', pattern: 'origin: *' },
          }),
        );
      }

      if (/\.(query|execute)\s*\(\s*[`'"].*\$\{|\.(query|execute)\s*\(\s*\w+\s*\+/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'sec-sql-injection',
            title: 'SQL Injection Risk',
            category: 'side-effect',
            reason: 'SQL query with string concatenation - use parameterized queries',
            weight: 0.9,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'critical',
            confidence: 'high',
            tags: ['security', 'sql-injection', 'database'],
            evidence: { kind: 'regex', pattern: 'query with concatenation' },
            actions: [
              {
                type: 'mitigation_steps',
                text: 'Prevent SQL injection',
                steps: [
                  'Use parameterized queries',
                  'Use prepared statements',
                  'Use ORM with proper escaping',
                ],
              },
            ],
          }),
        );
      }

      if (/Object\.assign\s*\([^,]+,\s*(?:req\.body|req\.query|JSON\.parse)/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'sec-prototype-pollution',
            title: 'Prototype Pollution Risk',
            category: 'side-effect',
            reason: 'Object.assign with untrusted input - prototype pollution risk',
            weight: 0.7,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'critical',
            confidence: 'medium',
            tags: ['security', 'prototype-pollution'],
            evidence: { kind: 'regex', pattern: 'Object.assign with untrusted' },
          }),
        );
      }

      if (/fetch\s*\(\s*(?:req\.body|req\.query|req\.params)/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'sec-ssrf',
            title: 'SSRF Risk',
            category: 'side-effect',
            reason: 'Fetching URL from user input - SSRF vulnerability',
            weight: 0.9,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'critical',
            confidence: 'medium',
            tags: ['security', 'ssrf', 'network'],
            evidence: { kind: 'regex', pattern: 'fetch with user input' },
          }),
        );
      }

      if (/JSON\.parse\s*\(\s*(?:req\.body|atob|Buffer\.from)/.test(line)) {
        const nearbyTry = lines
          .slice(Math.max(0, i - 5), i)
          .join('\n')
          .includes('try');
        if (!nearbyTry) {
          signals.push(
            this.createSignal({
              id: 'sec-unsafe-deserialize',
              title: 'Unsafe Deserialization',
              category: 'side-effect',
              reason: 'JSON.parse on untrusted input without try/catch',
              weight: 0.5,
              lines: [lineNum],
              snippet: this.getSnippet(lineNum),
              signalClass: 'behavioral',
              confidence: 'medium',
              tags: ['security', 'deserialization'],
              evidence: { kind: 'regex', pattern: 'JSON.parse untrusted' },
            }),
          );
        }
      }
    }

    if (filePath.endsWith('package.json')) {
      for (let i = 0; i < lines.length; i++) {
        const lineNum = i + 1;
        if (!this.shouldAnalyzeLine(lineNum)) continue;

        const line = lines[i];

        if (/postinstall|preinstall|prepare/.test(line)) {
          signals.push(
            this.createSignal({
              id: 'sec-npm-script',
              title: 'NPM Lifecycle Script',
              category: 'side-effect',
              reason: 'NPM lifecycle script changed - verify command is safe',
              weight: 0.7,
              lines: [lineNum],
              snippet: this.getSnippet(lineNum),
              signalClass: 'critical',
              confidence: 'high',
              tags: ['security', 'npm', 'supply-chain'],
              evidence: { kind: 'regex', pattern: 'postinstall|preinstall' },
            }),
          );
        }
      }
    }

    return signals;
  }

  /**
   * COR-001 to COR-018: Correctness signals
   */
  protected detectCorrectness(): Signal[] {
    const signals: Signal[] = [];
    const { lines, content } = this.ctx;

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const line = lines[i];

      if (/^\s*(?:fetch|axios|Promise)\s*\(|^\s*\w+\.\w+Async\s*\(/.test(line)) {
        const hasAwait = /await\s/.test(line);
        const hasThen = /\.then\s*\(/.test(lines.slice(i, i + 3).join(''));
        const hasCatch = /\.catch\s*\(/.test(lines.slice(i, i + 5).join(''));
        if (!hasAwait && !hasThen) {
          signals.push(
            this.createSignal({
              id: 'cor-unhandled-promise',
              title: 'Unhandled Promise',
              category: 'async',
              reason: 'Promise without await or .then() - result ignored',
              weight: 0.6,
              lines: [lineNum],
              snippet: this.getSnippet(lineNum),
              signalClass: 'behavioral',
              confidence: 'medium',
              tags: ['correctness', 'async', 'promise'],
              evidence: { kind: 'heuristic', pattern: 'promise without await/then' },
            }),
          );
        }
      }

      if (/catch\s*\([^)]*\)\s*\{\s*\}|catch\s*\{\s*\}/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'cor-swallowed-error',
            title: 'Swallowed Error',
            category: 'side-effect',
            reason: 'Empty catch block hides errors - at least log the error',
            weight: 0.7,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['correctness', 'error-handling'],
            evidence: { kind: 'regex', pattern: 'catch { }' },
          }),
        );
      }

      if (/!\s*\w+\s*&&|!!\w+\s*&&|\?\.\[|\?\.\(/.test(line)) {
      }

      if (/:\s*any\b|as\s+any\b/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'cor-any-type',
            title: 'TypeScript any',
            category: 'complexity',
            reason: 'Using "any" type bypasses TypeScript safety',
            weight: 0.3,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'maintainability',
            confidence: 'high',
            tags: ['correctness', 'typescript', 'type-safety'],
            evidence: { kind: 'regex', pattern: ': any|as any' },
          }),
        );
      }

      if (
        /let\s+\w+\s*=/.test(line) &&
        /async/.test(lines.slice(Math.max(0, i - 10), i + 10).join(''))
      ) {
        const varName = line.match(/let\s+(\w+)\s*=/)?.[1];
        const nearbyContent = lines.slice(i, Math.min(lines.length, i + 20)).join('\n');
        if (varName && new RegExp(`${varName}\\s*=`).test(nearbyContent.substring(line.length))) {
          signals.push(
            this.createSignal({
              id: 'cor-race-condition',
              title: 'Potential Race Condition',
              category: 'async',
              reason: 'Mutable variable reassigned in async context - race condition risk',
              weight: 0.5,
              lines: [lineNum],
              snippet: this.getSnippet(lineNum),
              signalClass: 'behavioral',
              confidence: 'low',
              tags: ['correctness', 'async', 'race-condition'],
              evidence: { kind: 'heuristic', pattern: 'let in async' },
            }),
          );
        }
      }

      if (/setInterval\s*\(/.test(line)) {
        const nearbyContent = lines.slice(i, Math.min(lines.length, i + 30)).join('\n');
        if (!/clearInterval/.test(nearbyContent)) {
          signals.push(
            this.createSignal({
              id: 'cor-interval-no-clear',
              title: 'Interval Without Cleanup',
              category: 'async',
              reason: 'setInterval without clearInterval - memory leak risk',
              weight: 0.6,
              lines: [lineNum],
              snippet: this.getSnippet(lineNum),
              signalClass: 'behavioral',
              confidence: 'medium',
              tags: ['correctness', 'timer', 'memory-leak'],
              evidence: { kind: 'heuristic', pattern: 'setInterval without clear' },
            }),
          );
        }
      }

      if (/while\s*\(\s*true\s*\)|for\s*\(\s*;\s*;\s*\)/.test(line)) {
        const nearbyContent = lines.slice(i, Math.min(lines.length, i + 20)).join('\n');
        if (!/break|return|throw|maxRetries|retryCount|attempt/.test(nearbyContent)) {
          signals.push(
            this.createSignal({
              id: 'cor-infinite-loop',
              title: 'Potential Infinite Loop',
              category: 'complexity',
              reason: 'Infinite loop without visible exit condition',
              weight: 0.7,
              lines: [lineNum],
              snippet: this.getSnippet(lineNum),
              signalClass: 'behavioral',
              confidence: 'medium',
              tags: ['correctness', 'loop', 'infinite'],
              evidence: { kind: 'regex', pattern: 'while(true)' },
            }),
          );
        }
      }

      if (/new\s+RegExp\s*\(|\/[^/]+\/[gimsuvy]*/.test(line)) {
        if (/\(\?=|\(\?!|\(\?<=|\(\?<!|\{[\d,]+\}.*\{[\d,]+\}/.test(line)) {
          signals.push(
            this.createSignal({
              id: 'cor-complex-regex',
              title: 'Complex Regex',
              category: 'complexity',
              reason: 'Complex regex pattern - risk of catastrophic backtracking',
              weight: 0.4,
              lines: [lineNum],
              snippet: this.getSnippet(lineNum),
              signalClass: 'behavioral',
              confidence: 'medium',
              tags: ['correctness', 'regex', 'performance'],
              evidence: { kind: 'regex', pattern: 'complex regex' },
            }),
          );
        }
      }
    }

    return signals;
  }

  /**
   * MAINT-001 to MAINT-016: Maintainability signals
   */
  protected detectMaintainability(): Signal[] {
    const signals: Signal[] = [];
    const { lines, content, filePath } = this.ctx;

    const todoLines: number[] = [];
    const commentedCodeLines: number[] = [];
    const magicNumberLines: number[] = [];
    const duplicatePatterns: Map<string, number[]> = new Map();

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const line = lines[i];

      if (/\/\/\s*(TODO|FIXME|HACK|XXX)\b/i.test(line)) {
        const hasTicket = /#\d+|\[[\w-]+\]|JIRA|ISSUE|TICKET/i.test(line);
        if (!hasTicket) {
          todoLines.push(lineNum);
        }
      }

      if (
        /^[\s]*\/\/\s*(?:const|let|var|function|class|if|for|while|return|import|export)/.test(line)
      ) {
        commentedCodeLines.push(lineNum);
      }

      if (/[^a-zA-Z0-9_](?<![\d.])[1-9]\d{2,}(?!\d)/.test(line)) {
        if (!/\b(?:port|status|code|error|http|width|height|size|index|length)\b/i.test(line)) {
          const numMatch = line.match(/\b(\d{3,})\b/);
          if (numMatch) {
            const num = parseInt(numMatch[1], 10);

            if (
              ![
                80, 443, 3000, 8080, 8000, 200, 201, 204, 400, 401, 403, 404, 500, 1000, 1024, 2048,
                4096,
              ].includes(num)
            ) {
              magicNumberLines.push(lineNum);
            }
          }
        }
      }

      if (/export\s+(?:const|function|class)\s+(\w+)/.test(line)) {
        const exportName = line.match(/export\s+(?:const|function|class)\s+(\w+)/)?.[1];
        if (exportName) {
          const usageCount = (content.match(new RegExp(`\\b${exportName}\\b`, 'g')) || []).length;
          if (usageCount === 1) {
            signals.push(
              this.createSignal({
                id: 'maint-unused-export',
                title: `Potentially Unused Export: ${exportName}`,
                category: 'complexity',
                reason: 'Export not used within file - verify external usage',
                weight: 0.2,
                lines: [lineNum],
                snippet: this.getSnippet(lineNum),
                signalClass: 'maintainability',
                confidence: 'low',
                tags: ['maintainability', 'dead-code'],
                evidence: { kind: 'heuristic', details: { exportName } },
              }),
            );
          }
        }
      }

      if (/throw\s+new\s+Error\s*\(\s*['"][^'"]{0,20}['"]\s*\)/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'maint-vague-error',
            title: 'Vague Error Message',
            category: 'complexity',
            reason: 'Error message is short - add more context for debugging',
            weight: 0.2,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'maintainability',
            confidence: 'medium',
            tags: ['maintainability', 'error-message'],
            evidence: { kind: 'regex', pattern: 'short error message' },
          }),
        );
      }

      const trimmed = line.trim();
      if (trimmed.length > 30 && !/^[\s]*\/\/|^[\s]*\*|^[\s]*import|^[\s]*export/.test(line)) {
        if (!duplicatePatterns.has(trimmed)) {
          duplicatePatterns.set(trimmed, []);
        }
        duplicatePatterns.get(trimmed)!.push(lineNum);
      }
    }

    if (todoLines.length > 0) {
      signals.push(
        this.createSignal({
          id: 'maint-todo-no-ticket',
          title: 'TODO Without Ticket',
          category: 'complexity',
          reason: `${todoLines.length} TODO/FIXME without ticket reference`,
          weight: 0.1 * todoLines.length,
          lines: todoLines.slice(0, 5),
          signalClass: 'maintainability',
          confidence: 'high',
          tags: ['maintainability', 'todo'],
          evidence: { kind: 'regex', details: { count: todoLines.length } },
        }),
      );
    }

    if (commentedCodeLines.length > 3) {
      signals.push(
        this.createSignal({
          id: 'maint-commented-code',
          title: 'Commented-Out Code',
          category: 'complexity',
          reason: `${commentedCodeLines.length} lines of commented-out code`,
          weight: 0.2,
          lines: commentedCodeLines.slice(0, 5),
          signalClass: 'maintainability',
          confidence: 'high',
          tags: ['maintainability', 'dead-code'],
          evidence: { kind: 'heuristic', details: { count: commentedCodeLines.length } },
        }),
      );
    }

    if (magicNumberLines.length > 2) {
      signals.push(
        this.createSignal({
          id: 'maint-magic-numbers',
          title: 'Magic Numbers',
          category: 'complexity',
          reason: `${magicNumberLines.length} magic numbers - consider named constants`,
          weight: 0.2,
          lines: magicNumberLines.slice(0, 5),
          signalClass: 'maintainability',
          confidence: 'medium',
          tags: ['maintainability', 'magic-numbers'],
          evidence: { kind: 'heuristic', details: { count: magicNumberLines.length } },
        }),
      );
    }

    for (const [pattern, lineNums] of duplicatePatterns) {
      if (lineNums.length >= 3) {
        signals.push(
          this.createSignal({
            id: 'maint-duplicate-code',
            title: 'Duplicate Code Pattern',
            category: 'complexity',
            reason: `Same code pattern repeated ${lineNums.length} times`,
            weight: 0.3,
            lines: lineNums.slice(0, 3),
            snippet: pattern.substring(0, 100),
            signalClass: 'maintainability',
            confidence: 'medium',
            tags: ['maintainability', 'duplication'],
            evidence: { kind: 'heuristic', details: { count: lineNums.length } },
          }),
        );
        break;
      }
    }

    if (filePath.includes('.test.') || filePath.includes('.spec.')) {
      for (let i = 0; i < lines.length; i++) {
        const lineNum = i + 1;
        if (!this.shouldAnalyzeLine(lineNum)) continue;

        const line = lines[i];

        if (/\.skip\s*\(|\.only\s*\(|xit\s*\(|xdescribe\s*\(/.test(line)) {
          signals.push(
            this.createSignal({
              id: 'maint-test-disabled',
              title: 'Disabled Test',
              category: 'side-effect',
              reason: 'Test disabled with .skip/.only - verify this is intentional',
              weight: 0.5,
              lines: [lineNum],
              snippet: this.getSnippet(lineNum),
              signalClass: 'behavioral',
              confidence: 'high',
              tags: ['maintainability', 'testing'],
              evidence: { kind: 'regex', pattern: '.skip|.only|xit' },
            }),
          );
        }
      }
    }

    return signals;
  }
}
