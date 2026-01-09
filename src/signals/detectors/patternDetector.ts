/**
 * Pattern-based Signal Detector
 */

import {
  Signal,
  ChangedRange,
  SignalClass,
  Severity,
  Confidence,
  SignalCategory,
  getSignalClassFromId,
  getSeverityFromClassAndWeight,
} from '../types';
import { PatternRegistry, getPatternRegistry, PatternDef } from '../../patterns';

export interface PatternDetectorOptions {
  changedRanges?: ChangedRange[];
  contextLines?: number;
  framework?: 'react' | 'vue' | 'angular' | 'node' | 'generic';
  customPatterns?: PatternDef[];
  excludePatterns?: string[];
}

export class PatternDetector {
  private registry: PatternRegistry;
  private changedLineNumbers: Set<number>;
  private focusLineNumbers: Set<number>;
  private filePath: string;
  private lines: string[];
  private content: string;
  private framework?: string;

  constructor(content: string, filePath: string, options: PatternDetectorOptions = {}) {
    const { changedRanges, contextLines = 5, framework, customPatterns } = options;

    this.filePath = filePath;
    this.content = content;
    this.lines = content.split('\n');
    this.framework = framework;

    this.registry = customPatterns ? new PatternRegistry(customPatterns) : getPatternRegistry();

    this.changedLineNumbers = new Set<number>();
    this.focusLineNumbers = new Set<number>();

    if (changedRanges && changedRanges.length > 0) {
      for (const range of changedRanges) {
        for (let line = range.startLine; line <= range.endLine; line++) {
          this.changedLineNumbers.add(line);
        }

        const start = Math.max(1, range.startLine - contextLines);
        const end = Math.min(this.lines.length, range.endLine + contextLines);
        for (let line = start; line <= end; line++) {
          this.focusLineNumbers.add(line);
        }
      }
    } else {
      for (let i = 1; i <= this.lines.length; i++) {
        this.focusLineNumbers.add(i);
        this.changedLineNumbers.add(i);
      }
    }
  }

  private isChangedLine(lineNumber: number): boolean {
    return this.changedLineNumbers.has(lineNumber);
  }

  private getSnippet(lineNumber: number): string {
    const idx = lineNumber - 1;
    if (idx >= 0 && idx < this.lines.length) {
      return this.lines[idx];
    }
    return '';
  }

  private createSignalFromPattern(
    pattern: PatternDef,
    lineNumber: number,
    matchText: string,
  ): Signal {
    const signalClass: SignalClass = pattern.signalClass || getSignalClassFromId(pattern.id);
    const severity: Severity = getSeverityFromClassAndWeight(signalClass, pattern.weight);
    const inChangedRange = this.isChangedLine(lineNumber);

    return {
      id: pattern.id,
      title: pattern.name,
      class: signalClass,
      category: pattern.category as SignalCategory,
      severity,
      confidence: (pattern.confidence as Confidence) || 'medium',
      weight: pattern.weight,
      filePath: this.filePath,
      lines: [lineNumber],
      snippet: this.getSnippet(lineNumber),
      reason: pattern.description,
      evidence: {
        kind: 'regex',
        pattern: pattern.match.source,
        details: { matchText },
      },
      tags: pattern.tags || [pattern.framework || 'generic'],
      inChangedRange,
      meta: {
        patternId: pattern.id,
        framework: pattern.framework,
      },
    };
  }

  detect(): Signal[] {
    const signals: Signal[] = [];

    const patterns = this.framework
      ? this.registry.getByFramework(this.framework)
      : this.registry.getAll();

    for (let i = 0; i < this.lines.length; i++) {
      const lineNum = i + 1;
      if (!this.focusLineNumbers.has(lineNum)) continue;

      const line = this.lines[i];

      for (const pattern of patterns) {
        if (!pattern.enabled) continue;

        const match = pattern.match.exec(line);
        if (match) {
          signals.push(this.createSignalFromPattern(pattern, lineNum, match[0]));
        }
      }
    }

    return this.deduplicateSignals(signals);
  }

  private deduplicateSignals(signals: Signal[]): Signal[] {
    const seen = new Set<string>();
    const result: Signal[] = [];

    for (const signal of signals) {
      const key = `${signal.id}:${signal.lines[0] || 0}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(signal);
      }
    }

    return result;
  }
}

export function detectWithPatterns(
  content: string,
  filePath: string,
  options: PatternDetectorOptions = {},
): Signal[] {
  const detector = new PatternDetector(content, filePath, options);
  return detector.detect();
}
