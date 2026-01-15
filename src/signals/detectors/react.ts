/**
 * React Signal Detector - Enterprise Edition
 *
 * Comprehensive React/Next.js/React Native detection covering:
 * - REACT-001 to REACT-012: Hook and component patterns
 * - PERF signals: Performance anti-patterns
 * - Security: XSS, injection risks
 * - State management patterns
 */

import { Signal, ChangedRange } from '../types';
import { BaseDetector } from './base';

export class ReactDetector extends BaseDetector {
  constructor(content: string, filePath: string, changedRanges?: ChangedRange[], contextLines = 5) {
    super(content, filePath, changedRanges, contextLines);
  }

  detect(): Signal[] {
    const baseSignals = super.detect();

    if (!this.isReactFile()) {
      return baseSignals;
    }

    return [
      ...baseSignals,
      ...this.detectHooks(),
      ...this.detectComponentPatterns(),
      ...this.detectStatePatterns(),
      ...this.detectPerformanceIssues(),
      ...this.detectNextPatterns(),
    ];
  }

  private isReactFile(): boolean {
    const { filePath, content } = this.ctx;

    if (filePath.endsWith('.jsx') || filePath.endsWith('.tsx')) {
      return true;
    }

    return /import\s+.*\s+from\s+['"]react['"]/.test(content);
  }

  private detectHooks(): Signal[] {
    const signals: Signal[] = [];
    const { lines } = this.ctx;

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const line = lines[i];

      if (/useEffect\s*\(/.test(line)) {
        const nextLines = lines.slice(i, i + 10).join('\n');
        const hasDepArray = /\[\s*\]|\[\s*\w+/.test(nextLines);

        if (!hasDepArray) {
          signals.push(
            this.createSignal({
              id: 'react-effect-no-deps',
              title: 'useEffect Without Dependencies',
              category: 'async',
              reason:
                'useEffect without dependency array runs on every render - add dependencies or empty array',
              weight: 0.8,
              lines: [lineNum],
              snippet: this.getSnippet(lineNum, lineNum + 2),
              signalClass: 'behavioral',
              confidence: 'high',
              tags: ['react', 'hooks', 'performance'],
              evidence: { kind: 'regex', pattern: 'useEffect\\(' },
              actions: [
                {
                  type: 'mitigation_steps',
                  text: 'Add dependency array to useEffect',
                  steps: [
                    'Add [] if effect should only run once',
                    'Add [dep1, dep2] if effect depends on specific values',
                    'Use eslint-plugin-react-hooks for automatic detection',
                  ],
                },
              ],
            }),
          );
        }
      }

      if (/useEffect\s*\([^)]*,\s*\[[^\]]{50,}\]/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'react-complex-deps',
            title: 'Complex Effect Dependencies',
            category: 'complexity',
            reason: 'useEffect has many dependencies - consider splitting into smaller effects',
            weight: 0.4,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'maintainability',
            confidence: 'medium',
            tags: ['react', 'hooks', 'complexity'],
            evidence: { kind: 'regex', pattern: 'useEffect with many deps' },
          }),
        );
      }

      if (/useCallback\s*\([^,]+\)/.test(line) && !/useCallback\s*\([^,]+,\s*\[/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'react-callback-no-deps',
            title: 'useCallback Without Dependencies',
            category: 'async',
            reason: 'useCallback without dependency array defeats memoization purpose',
            weight: 0.5,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'medium',
            tags: ['react', 'hooks', 'memoization'],
            evidence: { kind: 'regex', pattern: 'useCallback\\(' },
          }),
        );
      }

      if (/useMemo\s*\([^,]+\)/.test(line) && !/useMemo\s*\([^,]+,\s*\[/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'react-memo-no-deps',
            title: 'useMemo Without Dependencies',
            category: 'async',
            reason: 'useMemo without dependency array defeats memoization purpose',
            weight: 0.5,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'medium',
            tags: ['react', 'hooks', 'memoization'],
            evidence: { kind: 'regex', pattern: 'useMemo\\(' },
          }),
        );
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      if (/useState\s*\(\s*\{[^}]{100,}\}/.test(lines[i])) {
        signals.push(
          this.createSignal({
            id: 'react-complex-state',
            title: 'Complex State Shape',
            category: 'complexity',
            reason: 'useState with complex initial value - consider useReducer or splitting state',
            weight: 0.3,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'maintainability',
            confidence: 'medium',
            tags: ['react', 'state', 'complexity'],
            evidence: { kind: 'regex', pattern: 'useState with complex object' },
          }),
        );
      }
    }

    const standardHooks = [
      'useState',
      'useEffect',
      'useCallback',
      'useMemo',
      'useRef',
      'useContext',
      'useReducer',
      'useLayoutEffect',
      'useImperativeHandle',
      'useDebugValue',
      'useDeferredValue',
      'useTransition',
      'useId',
      'useSyncExternalStore',
      'useInsertionEffect',
    ];

    const customHooksInChanges: Array<{ name: string; line: number }> = [];
    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const matches = lines[i].match(/\buse[A-Z]\w+/g) || [];
      for (const hook of matches) {
        if (!standardHooks.includes(hook) && !customHooksInChanges.some((h) => h.name === hook)) {
          customHooksInChanges.push({ name: hook, line: lineNum });
        }
      }
    }

    if (customHooksInChanges.length > 0) {
      signals.push(
        this.createSignal({
          id: 'react-custom-hooks',
          title: 'Custom Hooks Used',
          category: 'signature',
          reason: `${customHooksInChanges.length} custom hook(s) used: ${customHooksInChanges
            .map((h) => h.name)
            .slice(0, 3)
            .join(', ')}`,
          weight: 0.2,
          lines: customHooksInChanges.map((h) => h.line),
          signalClass: 'behavioral',
          confidence: 'high',
          tags: ['react', 'hooks', 'custom'],
          evidence: { kind: 'regex', details: { hooks: customHooksInChanges.map((h) => h.name) } },
        }),
      );
    }

    return signals;
  }

  private detectComponentPatterns(): Signal[] {
    const signals: Signal[] = [];
    const { lines } = this.ctx;

    let inlineStyles = 0;
    let inlineHandlers = 0;
    const inlineStyleLines: number[] = [];
    const inlineHandlerLines: number[] = [];

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const line = lines[i];

      if (/style=\{\{/.test(line)) {
        inlineStyles++;
        inlineStyleLines.push(lineNum);
      }

      if (/on\w+=\{\s*\(\)\s*=>/.test(line) || /on\w+=\{\s*\([^)]*\)\s*=>/.test(line)) {
        inlineHandlers++;
        inlineHandlerLines.push(lineNum);
      }

      if (/document\.(getElementById|querySelector|createElement)/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'react-direct-dom',
            title: 'Direct DOM Manipulation',
            category: 'side-effect',
            reason: 'Direct DOM manipulation in React - use refs or state instead',
            weight: 0.6,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['react', 'dom', 'anti-pattern'],
            evidence: { kind: 'regex', pattern: 'document\\.' },
            actions: [
              {
                type: 'mitigation_steps',
                text: 'Replace direct DOM access',
                steps: [
                  'Use useRef for DOM element references',
                  'Use state for dynamic content',
                  'Consider if DOM manipulation is necessary',
                ],
              },
            ],
          }),
        );
      }

      if (/dangerouslySetInnerHTML/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'react-dangerous-html',
            title: 'Dangerous HTML Injection',
            category: 'side-effect',
            reason: 'dangerouslySetInnerHTML can lead to XSS vulnerabilities - sanitize input',
            weight: 0.7,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'critical',
            confidence: 'high',
            tags: ['react', 'security', 'xss'],
            evidence: { kind: 'regex', pattern: 'dangerouslySetInnerHTML' },
            actions: [
              {
                type: 'review_request',
                text: 'Security review required for HTML injection',
                reviewers: ['@security-team'],
              },
              {
                type: 'mitigation_steps',
                text: 'Verify HTML sanitization',
                steps: [
                  'Ensure input is sanitized with DOMPurify or similar',
                  'Verify source of HTML content is trusted',
                  'Consider alternatives to raw HTML injection',
                ],
              },
            ],
          }),
        );
      }

      if (/Suspense|lazy\(/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'react-suspense',
            title: 'Suspense/Lazy Loading',
            category: 'async',
            reason: 'Suspense/lazy loading - verify fallback UI and error boundaries',
            weight: 0.3,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['react', 'suspense', 'lazy'],
            evidence: { kind: 'regex', pattern: 'Suspense|lazy' },
          }),
        );
      }

      if (/useContext\s*\(|createContext\s*\(/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'react-context',
            title: 'Context Usage',
            category: 'side-effect',
            reason: 'Context change can trigger re-renders in all consumers - verify performance',
            weight: 0.4,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'medium',
            tags: ['react', 'context', 'performance'],
            evidence: { kind: 'regex', pattern: 'useContext|createContext' },
          }),
        );
      }

      if (/forwardRef\s*\(/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'react-forward-ref',
            title: 'Forward Ref',
            category: 'signature',
            reason: 'forwardRef exposes ref to parent - verify ref usage is correct',
            weight: 0.2,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['react', 'refs', 'api'],
            evidence: { kind: 'regex', pattern: 'forwardRef' },
          }),
        );
      }

      if (/createPortal\s*\(/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'react-portal',
            title: 'Portal Usage',
            category: 'side-effect',
            reason: 'Portal renders outside DOM hierarchy - verify event bubbling and styling',
            weight: 0.4,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['react', 'portal', 'dom'],
            evidence: { kind: 'regex', pattern: 'createPortal' },
          }),
        );
      }
    }

    if (inlineStyles > 3) {
      signals.push(
        this.createSignal({
          id: 'react-inline-styles',
          title: 'Many Inline Styles',
          category: 'side-effect',
          reason: `${inlineStyles} inline style objects create new objects on every render`,
          weight: 0.3,
          lines: inlineStyleLines.slice(0, 5),
          signalClass: 'maintainability',
          confidence: 'high',
          tags: ['react', 'styles', 'performance'],
          evidence: { kind: 'regex', details: { count: inlineStyles } },
        }),
      );
    }

    if (inlineHandlers > 3) {
      signals.push(
        this.createSignal({
          id: 'react-inline-handlers',
          title: 'Many Inline Handlers',
          category: 'side-effect',
          reason: `${inlineHandlers} inline handlers create new functions on every render`,
          weight: 0.3,
          lines: inlineHandlerLines.slice(0, 5),
          signalClass: 'maintainability',
          confidence: 'high',
          tags: ['react', 'handlers', 'performance'],
          evidence: { kind: 'regex', details: { count: inlineHandlers } },
        }),
      );
    }

    return signals;
  }

  /**
   * REACT-003 to REACT-008: State management patterns
   */
  private detectStatePatterns(): Signal[] {
    const signals: Signal[] = [];
    const { lines, content } = this.ctx;

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const line = lines[i];

      if (/setTimeout|setInterval/.test(line)) {
        const nearbyLines = lines.slice(Math.max(0, i - 5), i + 10).join('\n');
        if (/useState|useRef/.test(nearbyLines) && !/useRef|\.current/.test(line)) {
          signals.push(
            this.createSignal({
              id: 'react-stale-closure',
              title: 'Stale Closure Risk',
              category: 'async',
              reason: 'Timer using state without ref - may capture stale values',
              weight: 0.6,
              lines: [lineNum],
              snippet: this.getSnippet(lineNum),
              signalClass: 'behavioral',
              confidence: 'medium',
              tags: ['react', 'closure', 'timer', 'state'],
              evidence: { kind: 'regex', pattern: 'setTimeout|setInterval with state' },
            }),
          );
        }
      }

      if (/\.then\s*\(/.test(line) || /await\s+/.test(line)) {
        const nextLines = lines.slice(i, i + 5).join('\n');
        if (/set[A-Z]\w*\s*\(/.test(nextLines)) {
          const hasCleanup = /isMounted|abortController|controller\.abort|cancelled/.test(content);
          if (!hasCleanup) {
            signals.push(
              this.createSignal({
                id: 'react-set-state-unmounted',
                title: 'setState After Unmount Risk',
                category: 'async',
                reason: 'Async setState without unmount check - may cause memory leak warning',
                weight: 0.5,
                lines: [lineNum],
                snippet: this.getSnippet(lineNum, lineNum + 2),
                signalClass: 'behavioral',
                confidence: 'medium',
                tags: ['react', 'async', 'unmount', 'memory'],
                evidence: { kind: 'heuristic', pattern: 'async setState without cleanup' },
              }),
            );
          }
        }
      }

      if (/key=\{.*index.*\}|key=\{i\}|key=\{idx\}/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'react-index-key',
            title: 'Index as Key',
            category: 'side-effect',
            reason: 'Using array index as key - causes issues with reordering/deletion',
            weight: 0.5,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['react', 'key', 'list', 'reconciliation'],
            evidence: { kind: 'regex', pattern: 'key={index}' },
            actions: [
              {
                type: 'mitigation_steps',
                text: 'Use stable unique IDs as keys',
                steps: [
                  'Use unique ID from data (id, uuid, etc.)',
                  'If no ID, consider nanoid or crypto.randomUUID',
                  'Index key is only OK for static lists that never reorder',
                ],
              },
            ],
          }),
        );
      }

      if (/useState\s*\(\s*props\./.test(line)) {
        signals.push(
          this.createSignal({
            id: 'react-derived-state',
            title: 'Derived State from Props',
            category: 'side-effect',
            reason: 'State initialized from props - will not update when props change',
            weight: 0.6,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['react', 'state', 'props', 'anti-pattern'],
            evidence: { kind: 'regex', pattern: 'useState(props.)' },
            actions: [
              {
                type: 'mitigation_steps',
                text: 'Fix derived state',
                steps: [
                  'Compute value directly from props (no state needed)',
                  'Use useMemo for expensive computations',
                  'If state needed, sync with useEffect + key prop',
                ],
              },
            ],
          }),
        );
      }

      if (
        /set\w+\s*\(\s*\w+\.push\s*\(|set\w+\s*\(\s*\w+\.splice\s*\(|set\w+\s*\(\s*\w+\[\w+\]\s*=/.test(
          line,
        )
      ) {
        signals.push(
          this.createSignal({
            id: 'react-state-mutation',
            title: 'Direct State Mutation',
            category: 'side-effect',
            reason: 'Mutating state directly - use spread or immer for immutable updates',
            weight: 0.8,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['react', 'state', 'mutation', 'immutability'],
            evidence: { kind: 'regex', pattern: 'state.push/splice/[]=mutation' },
          }),
        );
      }

      if (/set[A-Z]\w*\s*\(/.test(line)) {
        const inEffect = this.isInsideEffect(i);
        const inHandler = this.isInsideHandler(i);
        if (!inEffect && !inHandler) {
          const inConditional = /if\s*\(|&&|[?:]/.test(lines.slice(Math.max(0, i - 3), i).join(''));
          if (!inConditional) {
            signals.push(
              this.createSignal({
                id: 'react-set-state-render',
                title: 'setState in Render',
                category: 'side-effect',
                reason: 'setState called during render - causes infinite loop',
                weight: 0.9,
                lines: [lineNum],
                snippet: this.getSnippet(lineNum),
                signalClass: 'critical',
                confidence: 'medium',
                tags: ['react', 'state', 'render', 'infinite-loop'],
                evidence: { kind: 'heuristic', pattern: 'setState outside effect/handler' },
              }),
            );
          }
        }
      }

      if (/value=\{\{/.test(line) && /Provider/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'react-context-value-inline',
            title: 'Inline Context Value',
            category: 'side-effect',
            reason: 'Context value object created inline - causes all consumers to re-render',
            weight: 0.6,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['react', 'context', 'performance', 'rerender'],
            evidence: { kind: 'regex', pattern: 'value={{' },
            actions: [
              {
                type: 'mitigation_steps',
                text: 'Memoize context value',
                steps: [
                  'Use useMemo to create stable value object',
                  'Split context into separate state and dispatch contexts',
                  'Consider using useReducer for complex state',
                ],
              },
            ],
          }),
        );
      }

      if (/ErrorBoundary|Suspense/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'react-boundary',
            title: 'Error/Suspense Boundary',
            category: 'side-effect',
            reason: 'Error or Suspense boundary changed - verify error handling is intact',
            weight: 0.4,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['react', 'error-boundary', 'suspense'],
            evidence: { kind: 'regex', pattern: 'ErrorBoundary|Suspense' },
          }),
        );
      }
    }

    return signals;
  }

  /**
   * PERF signals: Performance anti-patterns
   */
  private detectPerformanceIssues(): Signal[] {
    const signals: Signal[] = [];
    const { lines, content } = this.ctx;

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const line = lines[i];

      if (/addEventListener\s*\(/.test(line)) {
        const effectBlock = this.getEffectBlock(i);
        if (effectBlock && !/removeEventListener/.test(effectBlock)) {
          signals.push(
            this.createSignal({
              id: 'react-listener-no-cleanup',
              title: 'Event Listener Without Cleanup',
              category: 'async',
              reason: 'addEventListener without removeEventListener in cleanup',
              weight: 0.7,
              lines: [lineNum],
              snippet: this.getSnippet(lineNum),
              signalClass: 'behavioral',
              confidence: 'high',
              tags: ['react', 'events', 'memory-leak', 'cleanup'],
              evidence: { kind: 'regex', pattern: 'addEventListener without remove' },
              actions: [
                {
                  type: 'mitigation_steps',
                  text: 'Add cleanup function',
                  steps: [
                    'Return cleanup function from useEffect',
                    'Call removeEventListener with same handler reference',
                    'Consider using useCallback for stable handler',
                  ],
                },
              ],
            }),
          );
        }
      }

      if (/setInterval\s*\(|setTimeout\s*\(/.test(line)) {
        const effectBlock = this.getEffectBlock(i);
        if (effectBlock && !/clearInterval|clearTimeout/.test(effectBlock)) {
          signals.push(
            this.createSignal({
              id: 'react-timer-no-cleanup',
              title: 'Timer Without Cleanup',
              category: 'async',
              reason: 'setInterval/setTimeout without clear in cleanup',
              weight: 0.6,
              lines: [lineNum],
              snippet: this.getSnippet(lineNum),
              signalClass: 'behavioral',
              confidence: 'high',
              tags: ['react', 'timer', 'memory-leak', 'cleanup'],
              evidence: { kind: 'regex', pattern: 'setInterval|setTimeout without clear' },
            }),
          );
        }
      }

      if (/<\w+[^>]*=\{\[/.test(line) || /<\w+[^>]*=\{\{[^}]*\}\}/.test(line)) {
        if (!/style=/.test(line)) {
          signals.push(
            this.createSignal({
              id: 'react-unstable-prop',
              title: 'Unstable Prop Reference',
              category: 'side-effect',
              reason: 'New object/array created inline as prop - causes child re-render',
              weight: 0.4,
              lines: [lineNum],
              snippet: this.getSnippet(lineNum),
              signalClass: 'maintainability',
              confidence: 'medium',
              tags: ['react', 'props', 'performance', 'memoization'],
              evidence: { kind: 'regex', pattern: 'prop={[...]}' },
            }),
          );
        }
      }

      if (/\.map\s*\(|\.filter\s*\(|\.reduce\s*\(/.test(line)) {
        const isInRender = !this.isInsideEffect(i) && !this.isInsideHandler(i);
        const hasMemo = /useMemo|useCallback/.test(lines.slice(Math.max(0, i - 10), i).join('\n'));
        if (isInRender && !hasMemo) {
          signals.push(
            this.createSignal({
              id: 'react-unmemoized-computation',
              title: 'Unmemoized Computation in Render',
              category: 'complexity',
              reason: 'Array operation in render without useMemo - recalculates every render',
              weight: 0.3,
              lines: [lineNum],
              snippet: this.getSnippet(lineNum),
              signalClass: 'maintainability',
              confidence: 'low',
              tags: ['react', 'performance', 'memoization'],
              evidence: { kind: 'heuristic', pattern: 'map/filter/reduce in render' },
            }),
          );
        }
      }
    }

    return signals;
  }

  /**
   * Next.js specific patterns (when in React file context)
   */
  private detectNextPatterns(): Signal[] {
    const signals: Signal[] = [];
    const { lines, content, filePath } = this.ctx;

    if (!/from\s+['"]next/.test(content) && !/getServerSideProps|getStaticProps/.test(content)) {
      return signals;
    }

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const line = lines[i];

      if (/"use client"/.test(line) && lineNum > 1) {
        signals.push(
          this.createSignal({
            id: 'next-use-client-not-first',
            title: '"use client" Not at Top',
            category: 'side-effect',
            reason: '"use client" directive must be at top of file',
            weight: 0.7,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['next', 'client', 'server-components'],
            evidence: { kind: 'regex', pattern: '"use client" not at line 1' },
          }),
        );
      }

      if (/useRouter\s*\(\)|router\.push|router\.replace|router\.back/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'next-router-change',
            title: 'Router Navigation',
            category: 'side-effect',
            reason: 'Router navigation - verify caching and loading states',
            weight: 0.3,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['next', 'router', 'navigation'],
            evidence: { kind: 'regex', pattern: 'useRouter|router.push' },
          }),
        );
      }

      if (/export\s+(?:async\s+)?function\s+getServerSideProps/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'next-gss-props',
            title: 'getServerSideProps',
            category: 'side-effect',
            reason: 'Server-side data fetching - runs on every request',
            weight: 0.5,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['next', 'ssr', 'data-fetching'],
            evidence: { kind: 'regex', pattern: 'getServerSideProps' },
          }),
        );
      }

      if (/export\s+(?:async\s+)?function\s+getStaticProps/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'next-static-props',
            title: 'getStaticProps',
            category: 'side-effect',
            reason: 'Static data fetching - runs at build time',
            weight: 0.4,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['next', 'ssg', 'data-fetching'],
            evidence: { kind: 'regex', pattern: 'getStaticProps' },
          }),
        );
      }
    }

    return signals;
  }

  private isInsideEffect(lineIndex: number): boolean {
    const lines = this.ctx.lines;
    for (let i = lineIndex; i >= Math.max(0, lineIndex - 20); i--) {
      if (/useEffect\s*\(/.test(lines[i])) return true;
      if (/^[\s]*\}\s*\)/.test(lines[i])) return false;
    }
    return false;
  }

  private isInsideHandler(lineIndex: number): boolean {
    const lines = this.ctx.lines;
    for (let i = lineIndex; i >= Math.max(0, lineIndex - 10); i--) {
      if (/on\w+\s*=|handle\w+\s*=|const\s+handle\w+/.test(lines[i])) return true;
      if (/^[\s]*\}\s*[;,]?$/.test(lines[i])) return false;
    }
    return false;
  }

  private getEffectBlock(startIndex: number): string | null {
    const lines = this.ctx.lines;
    let depth = 0;
    let inEffect = false;
    const block: string[] = [];

    for (let i = Math.max(0, startIndex - 10); i < Math.min(lines.length, startIndex + 20); i++) {
      const line = lines[i];
      if (/useEffect\s*\(/.test(line)) {
        inEffect = true;
      }
      if (inEffect) {
        block.push(line);
        depth += (line.match(/\{/g) || []).length;
        depth -= (line.match(/\}/g) || []).length;
        if (depth <= 0 && block.length > 1) break;
      }
    }

    return inEffect ? block.join('\n') : null;
  }
}
