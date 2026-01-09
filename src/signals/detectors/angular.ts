/**
 * Angular Signal Detector - Operating Document Compliant
 *
 * Angular-specific signal detection extending the base detector.
 * Detects services, observables, lifecycle hooks, dependency injection.
 *
 * Supports TRUE DIFF ANALYSIS - focuses on changed lines only.
 * Produces signals in canonical format (Operating Document Section 5.1)
 */

import { Signal, ChangedRange } from '../types';
import { BaseDetector } from './base';

/**
 * Angular-specific detector
 */
export class AngularDetector extends BaseDetector {
  constructor(
    content: string,
    filePath: string,
    changedRanges?: ChangedRange[],
    contextLines = 5,
  ) {
    super(content, filePath, changedRanges, contextLines);
  }

  /**
   * Detect all signals including Angular-specific ones
   */
  detect(): Signal[] {
    const baseSignals = super.detect();

    if (!this.isAngularFile()) {
      return baseSignals;
    }

    return [
      ...baseSignals,
      ...this.detectComponentPatterns(),
      ...this.detectServicePatterns(),
      ...this.detectRxJSPatterns(),
    ];
  }

  /**
   * Check if this is an Angular file
   */
  private isAngularFile(): boolean {
    const { filePath, content } = this.ctx;

    // Check file naming conventions
    if (
      filePath.includes('.component.') ||
      filePath.includes('.service.') ||
      filePath.includes('.directive.') ||
      filePath.includes('.pipe.') ||
      filePath.includes('.module.') ||
      filePath.includes('.guard.') ||
      filePath.includes('.interceptor.') ||
      filePath.includes('.resolver.')
    ) {
      return true;
    }

    return /from\s+['"]@angular\//.test(content);
  }

  /**
   * Detect Angular component patterns - ONLY in changed/focus lines
   */
  private detectComponentPatterns(): Signal[] {
    const signals: Signal[] = [];
    const { lines, content } = this.ctx;

    // Subscription tracking
    let hasSubscribe = false;
    let hasUnsubscribe = false;
    let hasAsyncPipe = false;
    let hasTakeUntil = false;
    const subscribeLines: number[] = [];

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const line = lines[i];
      if (/\.subscribe\s*\(/.test(line)) {
        hasSubscribe = true;
        subscribeLines.push(lineNum);
      }
      if (/\.unsubscribe\s*\(/.test(line)) hasUnsubscribe = true;
      if (/\|\s*async/.test(line)) hasAsyncPipe = true;
      if (/takeUntil|takeUntilDestroyed/.test(line)) hasTakeUntil = true;
    }

    if (hasSubscribe && !hasUnsubscribe && !hasAsyncPipe && !hasTakeUntil) {
      signals.push(
        this.createSignal({
          id: 'angular-subscription-leak',
          title: 'Subscription Memory Leak',
          category: 'async',
          reason: 'Subscription without unsubscribe - use takeUntil, async pipe, or manual unsubscribe',
          weight: 0.8,
          lines: subscribeLines,
          signalClass: 'behavioral',
          confidence: 'high',
          tags: ['angular', 'rxjs', 'memory'],
          evidence: { kind: 'heuristic', details: { hasSubscribe, hasUnsubscribe, hasAsyncPipe, hasTakeUntil } },
          actions: [
            {
              type: 'mitigation_steps',
              text: 'Fix subscription leak',
              steps: [
                'Use async pipe in template instead of .subscribe()',
                'Add takeUntil(destroy$) before subscribe',
                'Use takeUntilDestroyed() from @angular/core/rxjs-interop',
                'Store subscription and unsubscribe in ngOnDestroy',
              ],
            },
          ],
        }),
      );
    }

    // Direct DOM manipulation
    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const line = lines[i];

      if (/document\.|ElementRef|nativeElement/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'angular-dom-access',
            title: 'Direct DOM Access',
            category: 'side-effect',
            reason: 'Direct DOM access - use Renderer2 for SSR compatibility and security',
            weight: 0.5,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['angular', 'dom', 'ssr'],
            evidence: { kind: 'regex', pattern: 'document|ElementRef|nativeElement' },
          }),
        );
      }

      // @Input/@Output decorators
      if (/@Input\s*\(|@Output\s*\(/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'angular-io-decorator',
            title: 'Component Input/Output',
            category: 'signature',
            reason: 'Component API change - verify parent components are updated',
            weight: 0.2,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['angular', 'component', 'api'],
            evidence: { kind: 'regex', pattern: '@Input|@Output' },
          }),
        );
      }

      // ViewChild/ContentChild
      if (/@ViewChild\s*\(|@ContentChild\s*\(|@ViewChildren\s*\(/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'angular-viewchild',
            title: 'ViewChild Query',
            category: 'side-effect',
            reason: 'ViewChild query - verify timing (available after ngAfterViewInit)',
            weight: 0.3,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['angular', 'viewchild', 'lifecycle'],
            evidence: { kind: 'regex', pattern: '@ViewChild|@ContentChild' },
          }),
        );
      }

      // HostListener/HostBinding
      if (/@HostListener\s*\(|@HostBinding\s*\(/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'angular-host-decorator',
            title: 'Host Listener/Binding',
            category: 'async',
            reason: 'Host decorator - verify event cleanup and performance',
            weight: 0.3,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['angular', 'host', 'events'],
            evidence: { kind: 'regex', pattern: '@HostListener|@HostBinding' },
          }),
        );
      }
    }

    // ChangeDetectionStrategy check
    let componentDecoratorInFocus = false;
    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;
      if (/@Component\s*\(/.test(lines[i])) {
        componentDecoratorInFocus = true;
        break;
      }
    }

    if (
      componentDecoratorInFocus &&
      content.includes('@Component') &&
      !content.includes('ChangeDetectionStrategy.OnPush')
    ) {
      const locCount = lines.length;
      if (locCount > 100) {
        signals.push(
          this.createSignal({
            id: 'angular-no-onpush',
            title: 'Missing OnPush Strategy',
            category: 'complexity',
            reason: 'Large component without OnPush change detection - consider adding for performance',
            weight: 0.3,
            signalClass: 'maintainability',
            confidence: 'medium',
            tags: ['angular', 'performance', 'change-detection'],
            evidence: { kind: 'heuristic', details: { loc: locCount } },
          }),
        );
      }
    }

    return signals;
  }

  /**
   * Detect Angular service patterns - ONLY in changed/focus lines
   */
  private detectServicePatterns(): Signal[] {
    const signals: Signal[] = [];
    const { lines, filePath } = this.ctx;

    if (!filePath.includes('.service.')) {
      return signals;
    }

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const line = lines[i];

      // Service with state
      if (/private\s+\w+\s*=\s*(?:new\s+BehaviorSubject|new\s+Subject|\[|\{)/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'angular-service-state',
            title: 'Service State Management',
            category: 'side-effect',
            reason: 'Service managing state - consider NgRx/NGXS for complex state',
            weight: 0.4,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'medium',
            tags: ['angular', 'service', 'state'],
            evidence: { kind: 'regex', pattern: 'BehaviorSubject|Subject' },
          }),
        );
      }

      // HTTP calls
      if (/this\.http\.\w+\s*\(/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'angular-http-call',
            title: 'HTTP Call',
            category: 'side-effect',
            reason: 'HTTP call - verify error handling and loading states',
            weight: 0.3,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['angular', 'http', 'async'],
            evidence: { kind: 'regex', pattern: 'this\\.http\\.' },
          }),
        );
      }
    }

    // HTTP calls without error handling
    let httpCalls = 0;
    let catchErrors = 0;
    const httpLines: number[] = [];

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      if (/this\.http\.\w+\s*\(/.test(lines[i])) {
        httpCalls++;
        httpLines.push(lineNum);
      }
      if (/catchError|\.catch\(/.test(lines[i])) catchErrors++;
    }

    if (httpCalls > 0 && catchErrors === 0) {
      signals.push(
        this.createSignal({
          id: 'angular-http-no-error',
          title: 'HTTP Without Error Handling',
          category: 'async',
          reason: 'HTTP calls without error handling - add catchError operator',
          weight: 0.6,
          lines: httpLines,
          signalClass: 'behavioral',
          confidence: 'high',
          tags: ['angular', 'http', 'error-handling'],
          evidence: { kind: 'heuristic', details: { httpCalls, catchErrors } },
          actions: [
            {
              type: 'mitigation_steps',
              text: 'Add error handling to HTTP calls',
              steps: [
                'Add catchError operator to pipe',
                'Return fallback value or rethrow',
                'Consider global error interceptor',
              ],
            },
          ],
        }),
      );
    }

    return signals;
  }

  /**
   * Detect RxJS patterns - ONLY in changed/focus lines
   */
  private detectRxJSPatterns(): Signal[] {
    const signals: Signal[] = [];
    const { lines } = this.ctx;

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const line = lines[i];

      // Nested subscribes
      if (/\.subscribe\s*\(/.test(line)) {
        const nextLines = lines.slice(i + 1, i + 10).join('\n');
        if (/\.subscribe\s*\(/.test(nextLines)) {
          signals.push(
            this.createSignal({
              id: 'angular-nested-subscribe',
              title: 'Nested Subscribe',
              category: 'async',
              reason: 'Nested subscribe - use switchMap/mergeMap/concatMap instead',
              weight: 0.7,
              lines: [lineNum],
              snippet: this.getSnippet(lineNum, lineNum + 3),
              signalClass: 'behavioral',
              confidence: 'high',
              tags: ['angular', 'rxjs', 'anti-pattern'],
              evidence: { kind: 'regex', pattern: 'nested subscribe' },
              actions: [
                {
                  type: 'mitigation_steps',
                  text: 'Flatten nested subscribes',
                  steps: [
                    'Use switchMap for replacing inner observable',
                    'Use mergeMap for parallel execution',
                    'Use concatMap for sequential execution',
                  ],
                },
              ],
            }),
          );
        }
      }

      // Public Subject
      if (/public\s+\w+\s*=\s*new\s+(?:Subject|BehaviorSubject|ReplaySubject)/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'angular-public-subject',
            title: 'Public Subject',
            category: 'signature',
            reason: 'Public Subject exposes internal state - expose as Observable with asObservable()',
            weight: 0.5,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['angular', 'rxjs', 'encapsulation'],
            evidence: { kind: 'regex', pattern: 'public.*Subject' },
          }),
        );
      }

      // tap with side effects
      if (/\.pipe\s*\([^)]*tap\s*\(/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'angular-tap-side-effect',
            title: 'tap Operator',
            category: 'side-effect',
            reason: 'tap operator for side effects - verify it does not affect stream',
            weight: 0.3,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'medium',
            tags: ['angular', 'rxjs', 'side-effect'],
            evidence: { kind: 'regex', pattern: 'tap\\(' },
          }),
        );
      }

      // shareReplay without refCount
      if (/shareReplay\s*\(\s*\d+\s*\)/.test(line) && !/refCount/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'angular-share-replay',
            title: 'shareReplay Without refCount',
            category: 'async',
            reason: 'shareReplay without refCount can cause memory leaks - add { refCount: true }',
            weight: 0.4,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['angular', 'rxjs', 'memory'],
            evidence: { kind: 'regex', pattern: 'shareReplay' },
          }),
        );
      }
    }

    return signals;
  }
}
