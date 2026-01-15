/**
 * Svelte/SvelteKit Signal Detector
 *
 * Detects Svelte-specific patterns including:
 * - Reactive statements ($:)
 * - Store subscriptions
 * - Lifecycle hooks
 * - SvelteKit specific (load functions, actions, etc.)
 */

import { Signal, ChangedRange } from '../types';
import { BaseDetector } from './base';

export class SvelteDetector extends BaseDetector {
  constructor(content: string, filePath: string, changedRanges?: ChangedRange[], contextLines = 5) {
    super(content, filePath, changedRanges, contextLines);
  }

  detect(): Signal[] {
    const baseSignals = super.detect();

    if (!this.isSvelteFile()) {
      return baseSignals;
    }

    return [
      ...baseSignals,
      ...this.detectReactivity(),
      ...this.detectStores(),
      ...this.detectLifecycle(),
      ...this.detectSvelteKitPatterns(),
    ];
  }

  private isSvelteFile(): boolean {
    const { filePath, content } = this.ctx;

    if (filePath.endsWith('.svelte')) {
      return true;
    }

    if (
      filePath.includes('+page') ||
      filePath.includes('+layout') ||
      filePath.includes('+server') ||
      filePath.includes('+error')
    ) {
      return true;
    }

    return /from\s+['"]svelte['"]|from\s+['"]\$app\//.test(content);
  }

  /**
   * Detect Svelte reactivity patterns
   */
  private detectReactivity(): Signal[] {
    const signals: Signal[] = [];
    const { lines } = this.ctx;

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const line = lines[i];

      if (/^\s*\$:/.test(line)) {
        const hasSideEffect = /\$:\s*(?:console\.|fetch\(|await|\.set\(|=(?!=))/.test(line);

        signals.push(
          this.createSignal({
            id: hasSideEffect ? 'svelte-reactive-side-effect' : 'svelte-reactive-statement',
            title: hasSideEffect ? 'Reactive Side Effect' : 'Reactive Statement',
            category: 'side-effect',
            reason: hasSideEffect
              ? 'Reactive block with side effect - may cause infinite loops or race conditions'
              : 'Reactive statement - verify dependency tracking',
            weight: hasSideEffect ? 0.6 : 0.2,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: hasSideEffect ? 'behavioral' : 'maintainability',
            confidence: 'high',
            tags: ['svelte', 'reactivity', ...(hasSideEffect ? ['side-effect'] : [])],
            evidence: { kind: 'regex', pattern: '\\$:', details: { hasSideEffect } },
            actions: hasSideEffect
              ? [
                  {
                    type: 'mitigation_steps',
                    text: 'Review reactive side effect',
                    steps: [
                      'Consider moving side effects to onMount or event handlers',
                      'Ensure no circular dependencies that could cause infinite loops',
                      'Use debounce for expensive operations',
                    ],
                  },
                ]
              : undefined,
          }),
        );
      }

      if (/^\s*\$:\s*\w+\s*=/.test(line)) {
        const expression = line.split('=')[1] || '';
        if (expression.length > 100 || (expression.match(/&&|\|\||\?/g) || []).length > 3) {
          signals.push(
            this.createSignal({
              id: 'svelte-complex-reactive',
              title: 'Complex Reactive Declaration',
              category: 'complexity',
              reason: 'Complex reactive expression - consider extracting to a function',
              weight: 0.3,
              lines: [lineNum],
              snippet: this.getSnippet(lineNum),
              signalClass: 'maintainability',
              confidence: 'medium',
              tags: ['svelte', 'reactivity', 'complexity'],
              evidence: { kind: 'regex', pattern: 'complex expression' },
            }),
          );
        }
      }

      if (/bind:\w+/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'svelte-bind',
            title: 'Two-way Binding',
            category: 'side-effect',
            reason: 'Two-way binding - verify data flow and potential circular updates',
            weight: 0.2,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['svelte', 'binding'],
            evidence: { kind: 'regex', pattern: 'bind:' },
          }),
        );
      }

      if (/bind:this|bind:group|bind:files/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'svelte-component-binding',
            title: 'Component/Special Binding',
            category: 'side-effect',
            reason: 'Special binding may have lifecycle implications',
            weight: 0.3,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['svelte', 'binding', 'component'],
            evidence: { kind: 'regex', pattern: 'bind:this|bind:group|bind:files' },
          }),
        );
      }
    }

    return signals;
  }

  /**
   * Detect Svelte store patterns
   */
  private detectStores(): Signal[] {
    const signals: Signal[] = [];
    const { lines } = this.ctx;

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const line = lines[i];

      if (/\b(writable|readable|derived)\s*\(/.test(line)) {
        const storeType = line.match(/\b(writable|readable|derived)/)?.[1];
        signals.push(
          this.createSignal({
            id: `svelte-store-${storeType}`,
            title: `${storeType?.charAt(0).toUpperCase()}${storeType?.slice(1)} Store`,
            category: 'side-effect',
            reason: `${storeType} store creation - verify subscription cleanup`,
            weight: 0.3,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['svelte', 'stores', storeType || 'store'],
            evidence: { kind: 'regex', pattern: `${storeType}\\(` },
          }),
        );
      }

      if (/\$\w+/.test(line) && !/\$:|\$\{/.test(line)) {
        if (this.isChangedLine(lineNum)) {
          signals.push(
            this.createSignal({
              id: 'svelte-store-auto-subscription',
              title: 'Store Auto-subscription',
              category: 'async',
              reason: 'Store value accessed with $ - auto-subscribed and cleaned up',
              weight: 0.1,
              lines: [lineNum],
              snippet: this.getSnippet(lineNum),
              signalClass: 'behavioral',
              confidence: 'high',
              tags: ['svelte', 'stores', 'subscription'],
              evidence: { kind: 'regex', pattern: '\\$\\w+' },
            }),
          );
        }
      }

      if (/\.subscribe\s*\(/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'svelte-store-manual-subscription',
            title: 'Manual Store Subscription',
            category: 'async',
            reason: 'Manual store subscription - must be unsubscribed to prevent memory leaks',
            weight: 0.5,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['svelte', 'stores', 'subscription', 'memory'],
            evidence: { kind: 'regex', pattern: '\\.subscribe\\(' },
            actions: [
              {
                type: 'mitigation_steps',
                text: 'Ensure subscription cleanup',
                steps: [
                  'Store the unsubscribe function returned by .subscribe()',
                  'Call unsubscribe in onDestroy lifecycle hook',
                  'Consider using $ auto-subscription syntax instead',
                ],
              },
            ],
          }),
        );
      }

      if (/\.update\s*\(|\.set\s*\(/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'svelte-store-update',
            title: 'Store Update',
            category: 'side-effect',
            reason: 'Store mutation - triggers all subscribers',
            weight: 0.2,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['svelte', 'stores', 'mutation'],
            evidence: { kind: 'regex', pattern: '\\.update\\(|\\.set\\(' },
          }),
        );
      }
    }

    return signals;
  }

  /**
   * Detect Svelte lifecycle patterns
   */
  private detectLifecycle(): Signal[] {
    const signals: Signal[] = [];
    const { lines } = this.ctx;

    const lifecycleHooks = [
      { pattern: /\bonMount\s*\(/, name: 'onMount', critical: false },
      { pattern: /\bbeforeUpdate\s*\(/, name: 'beforeUpdate', critical: true },
      { pattern: /\bafterUpdate\s*\(/, name: 'afterUpdate', critical: true },
      { pattern: /\bonDestroy\s*\(/, name: 'onDestroy', critical: false },
      { pattern: /\btick\s*\(/, name: 'tick', critical: false },
    ];

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const line = lines[i];

      for (const { pattern, name, critical } of lifecycleHooks) {
        if (pattern.test(line)) {
          signals.push(
            this.createSignal({
              id: `svelte-lifecycle-${name.toLowerCase()}`,
              title: `${name} Lifecycle Hook`,
              category: 'async',
              reason: critical
                ? `${name} runs synchronously during update - avoid heavy operations`
                : `${name} lifecycle hook - verify timing and cleanup`,
              weight: critical ? 0.5 : 0.3,
              lines: [lineNum],
              snippet: this.getSnippet(lineNum),
              signalClass: 'behavioral',
              confidence: 'high',
              tags: ['svelte', 'lifecycle', name.toLowerCase()],
              evidence: { kind: 'regex', pattern: pattern.source },
              actions:
                name === 'onMount'
                  ? [
                      {
                        type: 'mitigation_steps',
                        text: 'Handle async operations properly',
                        steps: [
                          'Return a cleanup function for subscriptions/intervals',
                          'Handle async errors with try/catch',
                          'Use {#await} blocks for async data',
                        ],
                      },
                    ]
                  : undefined,
            }),
          );
        }
      }
    }

    return signals;
  }

  /**
   * Detect SvelteKit-specific patterns
   */
  private detectSvelteKitPatterns(): Signal[] {
    const signals: Signal[] = [];
    const { lines, filePath } = this.ctx;

    const isSvelteKitFile =
      filePath.includes('+page') ||
      filePath.includes('+layout') ||
      filePath.includes('+server') ||
      filePath.includes('+error') ||
      filePath.includes('hooks');

    if (!isSvelteKitFile) {
      return signals;
    }

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const line = lines[i];

      if (/export\s+(?:const|async\s+function|function)\s+load/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'sveltekit-load',
            title: 'Load Function',
            category: 'async',
            reason: 'SvelteKit load function - verify error handling and data dependencies',
            weight: 0.4,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['sveltekit', 'load', 'data-fetching'],
            evidence: { kind: 'regex', pattern: 'export.*load' },
            actions: [
              {
                type: 'mitigation_steps',
                text: 'Best practices for load functions',
                steps: [
                  'Use error() for expected errors, throw for unexpected',
                  'Implement proper caching strategy',
                  'Consider parallel data fetching with Promise.all',
                  'Use depends() for invalidation',
                ],
              },
            ],
          }),
        );
      }

      if (/export\s+const\s+actions/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'sveltekit-actions',
            title: 'Form Actions',
            category: 'async',
            reason: 'SvelteKit form actions - verify validation and error handling',
            weight: 0.5,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['sveltekit', 'actions', 'forms'],
            evidence: { kind: 'regex', pattern: 'export const actions' },
            actions: [
              {
                type: 'mitigation_steps',
                text: 'Best practices for form actions',
                steps: [
                  'Validate all form data server-side',
                  'Use fail() for validation errors',
                  'Implement CSRF protection',
                  'Handle file uploads securely',
                ],
              },
            ],
          }),
        );
      }

      if (/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)/.test(line)) {
        const method = line.match(/(GET|POST|PUT|PATCH|DELETE)/)?.[1];
        signals.push(
          this.createSignal({
            id: 'sveltekit-api-endpoint',
            title: `API Endpoint (${method})`,
            category: 'signature',
            reason: 'SvelteKit API endpoint - verify authentication and validation',
            weight: 0.4,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['sveltekit', 'api', method?.toLowerCase() || 'endpoint'],
            evidence: { kind: 'regex', pattern: `export.*${method}` },
          }),
        );
      }

      if (/export\s+(?:async\s+)?function\s+handle/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'sveltekit-hook',
            title: 'Server Hook',
            category: 'side-effect',
            reason: 'SvelteKit hook - runs on every request, verify performance',
            weight: 0.6,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['sveltekit', 'hooks', 'middleware'],
            evidence: { kind: 'regex', pattern: 'export.*handle' },
            actions: [
              {
                type: 'review_request',
                text: 'Review hook performance impact',
                reviewers: ['@backend-team'],
              },
            ],
          }),
        );
      }

      if (/\bredirect\s*\(|\berror\s*\(/.test(line)) {
        const isRedirect = /\bredirect\s*\(/.test(line);
        signals.push(
          this.createSignal({
            id: isRedirect ? 'sveltekit-redirect' : 'sveltekit-error',
            title: isRedirect ? 'Redirect' : 'Error Response',
            category: 'side-effect',
            reason: isRedirect
              ? 'SvelteKit redirect - verify status code and destination'
              : 'SvelteKit error - verify error handling',
            weight: 0.2,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['sveltekit', isRedirect ? 'redirect' : 'error'],
            evidence: { kind: 'regex', pattern: isRedirect ? 'redirect\\(' : 'error\\(' },
          }),
        );
      }

      if (/\$page\.|from\s+['"]\$app\/stores['"]/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'sveltekit-page-store',
            title: 'Page Store Access',
            category: 'side-effect',
            reason: 'Accessing page store - verify SSR compatibility',
            weight: 0.2,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['sveltekit', 'stores', 'page'],
            evidence: { kind: 'regex', pattern: '\\$page|\\$app/stores' },
          }),
        );
      }

      if (/\bgoto\s*\(|\binvalidate\s*\(|\binvalidateAll\s*\(/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'sveltekit-navigation',
            title: 'Programmatic Navigation',
            category: 'side-effect',
            reason: 'Navigation or invalidation - verify user experience and data consistency',
            weight: 0.3,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['sveltekit', 'navigation'],
            evidence: { kind: 'regex', pattern: 'goto|invalidate' },
          }),
        );
      }
    }

    return signals;
  }
}
