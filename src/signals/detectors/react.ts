/**
 * React Signal Detector
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

    return [...baseSignals, ...this.detectHooks(), ...this.detectComponentPatterns()];
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
}
