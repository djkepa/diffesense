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
}
