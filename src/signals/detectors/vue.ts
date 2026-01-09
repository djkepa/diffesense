/**
 * Vue.js Signal Detector
 */

import { Signal, ChangedRange } from '../types';
import { BaseDetector } from './base';

export class VueDetector extends BaseDetector {
  constructor(content: string, filePath: string, changedRanges?: ChangedRange[], contextLines = 5) {
    super(content, filePath, changedRanges, contextLines);
  }

  detect(): Signal[] {
    const baseSignals = super.detect();

    if (!this.isVueFile()) {
      return baseSignals;
    }

    return [
      ...baseSignals,
      ...this.detectCompositionAPI(),
      ...this.detectOptionsAPI(),
      ...this.detectTemplatePatterns(),
    ];
  }

  private isVueFile(): boolean {
    const { filePath, content } = this.ctx;

    if (filePath.endsWith('.vue')) {
      return true;
    }

    return /import\s+.*\s+from\s+['"]vue['"]/.test(content) || /from\s+['"]@vue\//.test(content);
  }

  private detectCompositionAPI(): Signal[] {
    const signals: Signal[] = [];
    const { lines } = this.ctx;

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const line = lines[i];

      if (/\bwatch\s*\(/.test(line) || /\bwatchEffect\s*\(/.test(line)) {
        const nextLines = lines.slice(i, i + 15).join('\n');
        if (!/onCleanup|stop\s*\(/.test(nextLines)) {
          signals.push(
            this.createSignal({
              id: 'vue-watch-no-cleanup',
              title: 'Watch Without Cleanup',
              category: 'async',
              reason: 'watch/watchEffect without cleanup can cause memory leaks',
              weight: 0.6,
              lines: [lineNum],
              snippet: this.getSnippet(lineNum, lineNum + 2),
              signalClass: 'behavioral',
              confidence: 'medium',
              tags: ['vue', 'reactivity', 'memory'],
              evidence: { kind: 'regex', pattern: 'watch|watchEffect' },
              actions: [
                {
                  type: 'mitigation_steps',
                  text: 'Add cleanup to watcher',
                  steps: [
                    'Use onCleanup callback for side effects',
                    'Store stop handle for manual cleanup',
                    'Consider using watchEffect with automatic cleanup',
                  ],
                },
              ],
            }),
          );
        }
      }

      if (/\bcomputed\s*\(/.test(line)) {
        const computedBlock = lines.slice(i, i + 10).join('\n');
        if (/fetch\(|axios|\.post\(|\.get\(|console\./.test(computedBlock)) {
          signals.push(
            this.createSignal({
              id: 'vue-computed-side-effect',
              title: 'Computed with Side Effects',
              category: 'side-effect',
              reason: 'Computed properties should be pure - move side effects to watch/methods',
              weight: 0.7,
              lines: [lineNum],
              snippet: this.getSnippet(lineNum, lineNum + 3),
              signalClass: 'behavioral',
              confidence: 'high',
              tags: ['vue', 'computed', 'anti-pattern'],
              evidence: { kind: 'regex', pattern: 'computed with fetch/axios/console' },
              actions: [
                {
                  type: 'mitigation_steps',
                  text: 'Remove side effects from computed',
                  steps: [
                    'Move API calls to methods or watch',
                    'Use computed only for derived state',
                    'Consider using watchEffect for side effects',
                  ],
                },
              ],
            }),
          );
        }
      }

      if (/onMounted\s*\(\s*async/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'vue-async-mounted',
            title: 'Async onMounted',
            category: 'async',
            reason: 'Async onMounted - ensure proper cleanup and error handling',
            weight: 0.4,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['vue', 'lifecycle', 'async'],
            evidence: { kind: 'regex', pattern: 'onMounted\\s*\\(\\s*async' },
          }),
        );
      }

      if (/defineProps\s*\(|defineEmits\s*\(/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'vue-define-props',
            title: 'Props/Emits Definition',
            category: 'signature',
            reason: 'Component API change - verify parent components are updated',
            weight: 0.2,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['vue', 'props', 'api'],
            evidence: { kind: 'regex', pattern: 'defineProps|defineEmits' },
          }),
        );
      }

      if (/\bprovide\s*\(|\binject\s*\(/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'vue-provide-inject',
            title: 'Provide/Inject',
            category: 'side-effect',
            reason: 'Dependency injection - verify all consumers handle updates correctly',
            weight: 0.4,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['vue', 'di', 'context'],
            evidence: { kind: 'regex', pattern: 'provide|inject' },
          }),
        );
      }
    }

    let refCount = 0;
    let reactiveCount = 0;
    const refLines: number[] = [];

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      if (/\bref\s*\(/.test(lines[i])) {
        refCount++;
        refLines.push(lineNum);
      }
      if (/\breactive\s*\(/.test(lines[i])) {
        reactiveCount++;
        refLines.push(lineNum);
      }
    }

    if (refCount + reactiveCount > 10) {
      signals.push(
        this.createSignal({
          id: 'vue-many-refs',
          title: 'Many Reactive References',
          category: 'complexity',
          reason: `${
            refCount + reactiveCount
          } reactive references - consider extracting to composable`,
          weight: 0.4,
          lines: refLines.slice(0, 5),
          signalClass: 'maintainability',
          confidence: 'high',
          tags: ['vue', 'reactivity', 'complexity'],
          evidence: { kind: 'heuristic', details: { refCount, reactiveCount } },
        }),
      );
    }

    const composables: Array<{ name: string; line: number }> = [];
    const standardComposables = [
      'useState',
      'useRoute',
      'useRouter',
      'useStore',
      'useHead',
      'useFetch',
    ];

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const matches = lines[i].match(/\buse[A-Z]\w+/g) || [];
      for (const c of matches) {
        if (!standardComposables.includes(c) && !composables.some((comp) => comp.name === c)) {
          composables.push({ name: c, line: lineNum });
        }
      }
    }

    if (composables.length > 0) {
      signals.push(
        this.createSignal({
          id: 'vue-composables',
          title: 'Custom Composables',
          category: 'signature',
          reason: `${composables.length} custom composable(s): ${composables
            .map((c) => c.name)
            .slice(0, 3)
            .join(', ')}`,
          weight: 0.2,
          lines: composables.map((c) => c.line),
          signalClass: 'behavioral',
          confidence: 'high',
          tags: ['vue', 'composables', 'custom'],
          evidence: { kind: 'regex', details: { composables: composables.map((c) => c.name) } },
        }),
      );
    }

    return signals;
  }

  /**
   * Detect Vue Options API patterns - ONLY in changed/focus lines
   */
  private detectOptionsAPI(): Signal[] {
    const signals: Signal[] = [];
    const { lines } = this.ctx;

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const line = lines[i];

      if (/deep:\s*true/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'vue-deep-watch',
            title: 'Deep Watcher',
            category: 'side-effect',
            reason: 'Deep watcher can cause performance issues - consider flattening data',
            weight: 0.5,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['vue', 'watch', 'performance'],
            evidence: { kind: 'regex', pattern: 'deep:\\s*true' },
          }),
        );
      }

      if (/this\.\$props\.\w+\s*=|props\.\w+\s*=/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'vue-props-mutation',
            title: 'Props Mutation',
            category: 'side-effect',
            reason: 'Direct props mutation is an anti-pattern - emit event to parent instead',
            weight: 0.8,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['vue', 'props', 'anti-pattern'],
            evidence: { kind: 'regex', pattern: 'props mutation' },
            actions: [
              {
                type: 'mitigation_steps',
                text: 'Fix props mutation',
                steps: [
                  'Emit event to parent component',
                  'Use local copy of prop with watch',
                  'Consider v-model for two-way binding',
                ],
              },
            ],
          }),
        );
      }

      if (/\$forceUpdate\s*\(/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'vue-force-update',
            title: '$forceUpdate Usage',
            category: 'side-effect',
            reason: '$forceUpdate is an anti-pattern - use reactive data instead',
            weight: 0.7,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['vue', 'reactivity', 'anti-pattern'],
            evidence: { kind: 'regex', pattern: '\\$forceUpdate' },
          }),
        );
      }

      if (/\$nextTick\s*\(|nextTick\s*\(/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'vue-next-tick',
            title: 'nextTick Usage',
            category: 'async',
            reason: 'nextTick defers execution - verify timing is correct',
            weight: 0.3,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['vue', 'async', 'timing'],
            evidence: { kind: 'regex', pattern: 'nextTick' },
          }),
        );
      }
    }

    return signals;
  }

  /**
   * Detect Vue template patterns (in SFC) - ONLY in changed/focus lines
   */
  private detectTemplatePatterns(): Signal[] {
    const signals: Signal[] = [];
    const { content, filePath, lines } = this.ctx;

    if (!filePath.endsWith('.vue')) {
      return signals;
    }

    const templateMatch = content.match(/<template>([\s\S]*?)<\/template>/);
    if (!templateMatch) {
      return signals;
    }

    const template = templateMatch[1];
    const templateLines = template.split('\n');

    const templateStartIndex = content.indexOf('<template>');
    const templateStartLine = content.substring(0, templateStartIndex).split('\n').length;

    for (let i = 0; i < templateLines.length; i++) {
      const lineNum = templateStartLine + i;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const line = templateLines[i];

      if (/v-for.*v-if|v-if.*v-for/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'vue-vfor-vif',
            title: 'v-for with v-if',
            category: 'complexity',
            reason: 'v-for with v-if on same element - use computed property to filter',
            weight: 0.5,
            lines: [lineNum],
            snippet: line.trim(),
            signalClass: 'maintainability',
            confidence: 'high',
            tags: ['vue', 'template', 'performance'],
            evidence: { kind: 'regex', pattern: 'v-for.*v-if' },
          }),
        );
      }

      if (/@\w+="[^"]*\(/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'vue-inline-handler',
            title: 'Inline Event Handler',
            category: 'side-effect',
            reason: 'Inline event handler - consider extracting to method',
            weight: 0.2,
            lines: [lineNum],
            snippet: line.trim(),
            signalClass: 'maintainability',
            confidence: 'medium',
            tags: ['vue', 'template', 'handlers'],
            evidence: { kind: 'regex', pattern: '@\\w+="' },
          }),
        );
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      if (/\$refs\.\w+\./.test(lines[i])) {
        signals.push(
          this.createSignal({
            id: 'vue-refs-access',
            title: 'Direct $refs Access',
            category: 'side-effect',
            reason: 'Direct $refs DOM access - verify ref exists and timing is correct',
            weight: 0.4,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['vue', 'refs', 'dom'],
            evidence: { kind: 'regex', pattern: '\\$refs\\.' },
          }),
        );
      }
    }

    return signals;
  }
}
