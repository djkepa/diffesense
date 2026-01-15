/**
 * Angular Signal Detector - Enterprise Edition
 *
 * Comprehensive Angular detection covering:
 * - NG-001 to NG-008: Angular-specific patterns
 * - Component patterns
 * - Service patterns
 * - RxJS patterns
 * - Module and routing patterns
 * - Template patterns
 */

import { Signal, ChangedRange } from '../types';
import { BaseDetector } from './base';

export class AngularDetector extends BaseDetector {
  constructor(content: string, filePath: string, changedRanges?: ChangedRange[], contextLines = 5) {
    super(content, filePath, changedRanges, contextLines);
  }

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
      ...this.detectModulePatterns(),
      ...this.detectRoutePatterns(),
    ];
  }

  /**
   * Check if this is an Angular file
   */
  private isAngularFile(): boolean {
    const { filePath, content } = this.ctx;

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
          reason:
            'Subscription without unsubscribe - use takeUntil, async pipe, or manual unsubscribe',
          weight: 0.8,
          lines: subscribeLines,
          signalClass: 'behavioral',
          confidence: 'high',
          tags: ['angular', 'rxjs', 'memory'],
          evidence: {
            kind: 'heuristic',
            details: { hasSubscribe, hasUnsubscribe, hasAsyncPipe, hasTakeUntil },
          },
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
            reason:
              'Large component without OnPush change detection - consider adding for performance',
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

      if (/public\s+\w+\s*=\s*new\s+(?:Subject|BehaviorSubject|ReplaySubject)/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'angular-public-subject',
            title: 'Public Subject',
            category: 'signature',
            reason:
              'Public Subject exposes internal state - expose as Observable with asObservable()',
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

      const behaviorOperators = [
        'switchMap',
        'mergeMap',
        'concatMap',
        'exhaustMap',
        'debounceTime',
        'throttleTime',
        'distinctUntilChanged',
        'filter',
        'take',
        'skip',
        'retry',
        'retryWhen',
      ];

      for (const op of behaviorOperators) {
        const regex = new RegExp(`\\.${op}\\s*\\(`);
        if (regex.test(line)) {
          signals.push(
            this.createSignal({
              id: `angular-rxjs-${op.toLowerCase()}`,
              title: `RxJS ${op}`,
              category: 'async',
              reason: `${op} operator affects observable behavior - verify logic is correct`,
              weight: 0.3,
              lines: [lineNum],
              snippet: this.getSnippet(lineNum),
              signalClass: 'behavioral',
              confidence: 'high',
              tags: ['angular', 'rxjs', 'operator', op.toLowerCase()],
              evidence: { kind: 'regex', pattern: op },
            }),
          );
          break;
        }
      }

      if (/combineLatest\s*\(|forkJoin\s*\(|zip\s*\(/.test(line)) {
        const operator = line.match(/(combineLatest|forkJoin|zip)/)?.[1];
        signals.push(
          this.createSignal({
            id: `angular-rxjs-${operator?.toLowerCase()}`,
            title: `RxJS ${operator}`,
            category: 'async',
            reason: `${operator} combines multiple observables - verify all complete/emit as expected`,
            weight: 0.4,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['angular', 'rxjs', 'combination'],
            evidence: { kind: 'regex', pattern: operator || 'combination' },
          }),
        );
      }
    }

    return signals;
  }

  /**
   * NG-008: Module wiring patterns
   */
  private detectModulePatterns(): Signal[] {
    const signals: Signal[] = [];
    const { lines, filePath, content } = this.ctx;

    if (!filePath.includes('.module.')) {
      return signals;
    }

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const line = lines[i];

      if (/providedIn\s*:\s*['"]/.test(line)) {
        const scope = line.match(/providedIn\s*:\s*['"]([^'"]+)['"]/)?.[1];
        signals.push(
          this.createSignal({
            id: 'angular-provided-in',
            title: `Service Scope: ${scope || 'custom'}`,
            category: 'signature',
            reason: 'Service scope change affects where service is available',
            weight: 0.5,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['angular', 'di', 'scope'],
            evidence: { kind: 'regex', pattern: 'providedIn', details: { scope } },
          }),
        );
      }

      if (/imports\s*:\s*\[/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'angular-module-imports',
            title: 'Module Imports',
            category: 'signature',
            reason: 'Module imports changed - verify dependencies are correct',
            weight: 0.4,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum, lineNum + 5),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['angular', 'module', 'imports'],
            evidence: { kind: 'regex', pattern: 'imports:' },
          }),
        );
      }

      if (/exports\s*:\s*\[/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'angular-module-exports',
            title: 'Module Exports',
            category: 'signature',
            reason: 'Module exports changed - affects what is available to importing modules',
            weight: 0.4,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum, lineNum + 5),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['angular', 'module', 'exports'],
            evidence: { kind: 'regex', pattern: 'exports:' },
          }),
        );
      }

      if (/providers\s*:\s*\[/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'angular-module-providers',
            title: 'Module Providers',
            category: 'signature',
            reason: 'Providers changed - affects dependency injection',
            weight: 0.5,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum, lineNum + 5),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['angular', 'module', 'providers', 'di'],
            evidence: { kind: 'regex', pattern: 'providers:' },
          }),
        );
      }

      if (/\.forRoot\s*\(|\.forChild\s*\(/.test(line)) {
        const method = line.includes('forRoot') ? 'forRoot' : 'forChild';
        signals.push(
          this.createSignal({
            id: `angular-module-${method.toLowerCase()}`,
            title: `Module ${method}`,
            category: 'signature',
            reason: `${method} configuration changed - affects module initialization`,
            weight: 0.5,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['angular', 'module', method.toLowerCase()],
            evidence: { kind: 'regex', pattern: method },
          }),
        );
      }
    }

    return signals;
  }

  /**
   * NG-006: Route guard and routing patterns
   */
  private detectRoutePatterns(): Signal[] {
    const signals: Signal[] = [];
    const { lines, filePath, content } = this.ctx;

    const isRoutingFile =
      filePath.includes('-routing.module') ||
      filePath.includes('.routes.') ||
      filePath.includes('.guard.');

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const line = lines[i];

      if (/canActivate|canDeactivate|canLoad|canMatch|canActivateChild|resolve/.test(line)) {
        const guardType = line.match(
          /(canActivate|canDeactivate|canLoad|canMatch|canActivateChild|resolve)/,
        )?.[1];
        signals.push(
          this.createSignal({
            id: 'angular-route-guard',
            title: `Route Guard: ${guardType}`,
            category: 'side-effect',
            reason: 'Route guard changed - verify auth/permission logic is correct',
            weight: 0.7,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'critical',
            confidence: 'high',
            tags: ['angular', 'routing', 'guard', 'auth'],
            evidence: { kind: 'regex', pattern: guardType || 'guard' },
            actions: [
              {
                type: 'review_request',
                text: 'Security review for route guard change',
                reviewers: ['@security-team'],
              },
            ],
          }),
        );
      }

      if (/path\s*:\s*['"]/.test(line) && isRoutingFile) {
        const path = line.match(/path\s*:\s*['"]([^'"]*)['"]/)?.[1];
        signals.push(
          this.createSignal({
            id: 'angular-route-path',
            title: `Route: ${path || 'path'}`,
            category: 'signature',
            reason: 'Route path changed - may break deep links/bookmarks',
            weight: 0.5,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['angular', 'routing', 'path'],
            evidence: { kind: 'regex', pattern: 'path:', details: { path } },
          }),
        );
      }

      if (/loadChildren|loadComponent/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'angular-lazy-load',
            title: 'Lazy Loading',
            category: 'signature',
            reason: 'Lazy loading configuration changed - affects bundle splitting',
            weight: 0.4,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['angular', 'routing', 'lazy', 'bundle'],
            evidence: { kind: 'regex', pattern: 'loadChildren|loadComponent' },
          }),
        );
      }

      if (/redirectTo\s*:\s*['"]/.test(line)) {
        const target = line.match(/redirectTo\s*:\s*['"]([^'"]*)['"]/)?.[1];
        signals.push(
          this.createSignal({
            id: 'angular-route-redirect',
            title: `Redirect to: ${target || 'path'}`,
            category: 'side-effect',
            reason: 'Route redirect changed - verify navigation flow',
            weight: 0.4,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['angular', 'routing', 'redirect'],
            evidence: { kind: 'regex', pattern: 'redirectTo', details: { target } },
          }),
        );
      }

      if (/router\.navigate|router\.navigateByUrl/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'angular-router-navigate',
            title: 'Programmatic Navigation',
            category: 'side-effect',
            reason: 'Programmatic navigation - verify route exists and params are correct',
            weight: 0.3,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['angular', 'router', 'navigation'],
            evidence: { kind: 'regex', pattern: 'router.navigate' },
          }),
        );
      }

      if (/activatedRoute\.params|activatedRoute\.queryParams|activatedRoute\.data/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'angular-route-params',
            title: 'Route Parameters',
            category: 'async',
            reason: 'Route parameters accessed - ensure subscription cleanup',
            weight: 0.3,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['angular', 'routing', 'params'],
            evidence: { kind: 'regex', pattern: 'activatedRoute' },
          }),
        );
      }

      if (/@Injectable\s*\(/.test(line) && /implements\s+Resolve/.test(content)) {
        signals.push(
          this.createSignal({
            id: 'angular-resolver',
            title: 'Route Resolver',
            category: 'async',
            reason: 'Route resolver - data fetched before route activation',
            weight: 0.4,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['angular', 'routing', 'resolver'],
            evidence: { kind: 'regex', pattern: 'Resolve' },
          }),
        );
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const line = lines[i];

      if (/NgZone|zone\.run|runOutsideAngular/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'angular-zone',
            title: 'Zone Manipulation',
            category: 'async',
            reason: 'NgZone manipulation - affects change detection',
            weight: 0.5,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['angular', 'zone', 'change-detection'],
            evidence: { kind: 'regex', pattern: 'NgZone|zone.run' },
          }),
        );
      }

      if (/changeDetection\s*:\s*ChangeDetectionStrategy\./.test(line)) {
        const strategy = line.match(/ChangeDetectionStrategy\.(\w+)/)?.[1];
        signals.push(
          this.createSignal({
            id: 'angular-change-detection',
            title: `Change Detection: ${strategy}`,
            category: 'side-effect',
            reason: 'Change detection strategy changed - affects component update behavior',
            weight: 0.5,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['angular', 'change-detection', strategy?.toLowerCase() || 'strategy'],
            evidence: { kind: 'regex', pattern: 'ChangeDetectionStrategy', details: { strategy } },
          }),
        );
      }

      if (/changeDetectorRef\.detectChanges|changeDetectorRef\.markForCheck/.test(line)) {
        const method = line.includes('detectChanges') ? 'detectChanges' : 'markForCheck';
        signals.push(
          this.createSignal({
            id: `angular-cdr-${method.toLowerCase()}`,
            title: `Manual CD: ${method}`,
            category: 'side-effect',
            reason: 'Manual change detection trigger - may indicate OnPush issues',
            weight: 0.4,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['angular', 'change-detection', 'manual'],
            evidence: { kind: 'regex', pattern: method },
          }),
        );
      }
    }

    return signals;
  }
}
