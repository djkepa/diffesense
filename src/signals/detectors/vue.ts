/**
 * Vue.js Signal Detector - Enterprise Edition
 *
 * Comprehensive Vue/Nuxt detection covering:
 * - VUE-001 to VUE-008: Vue-specific patterns
 * - Composition API patterns
 * - Options API patterns
 * - Template patterns
 * - Store patterns (Pinia/Vuex)
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
      ...this.detectReactivityPatterns(),
      ...this.detectStorePatterns(),
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

  /**
   * VUE-003, VUE-007: Reactivity patterns
   */
  private detectReactivityPatterns(): Signal[] {
    const signals: Signal[] = [];
    const { lines, content } = this.ctx;

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const line = lines[i];

      if (/Object\.assign\s*\(\s*\w+\.value|Object\.assign\s*\(\s*state/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'vue-reactive-assign',
            title: 'Reactive Object Assignment',
            category: 'side-effect',
            reason:
              'Object.assign on reactive may lose reactivity - use spread or individual property assignment',
            weight: 0.5,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'medium',
            tags: ['vue', 'reactivity', 'mutation'],
            evidence: { kind: 'regex', pattern: 'Object.assign on reactive' },
          }),
        );
      }

      if (/const\s*\{[^}]+\}\s*=\s*(?:props|toRefs\s*\()?/.test(line) && !/toRefs/.test(line)) {
        if (/=\s*props/.test(line)) {
          signals.push(
            this.createSignal({
              id: 'vue-props-destructure',
              title: 'Props Destructure Without toRefs',
              category: 'side-effect',
              reason: 'Destructuring props loses reactivity - use toRefs(props) first',
              weight: 0.6,
              lines: [lineNum],
              snippet: this.getSnippet(lineNum),
              signalClass: 'behavioral',
              confidence: 'high',
              tags: ['vue', 'props', 'reactivity'],
              evidence: { kind: 'regex', pattern: 'destructure props without toRefs' },
              actions: [
                {
                  type: 'mitigation_steps',
                  text: 'Preserve reactivity',
                  steps: [
                    'Use toRefs(props) before destructuring',
                    'Or access props.propertyName directly',
                    'Or use computed() for derived values',
                  ],
                },
              ],
            }),
          );
        }
      }

      if (/defineEmits\s*\(|emit\s*\(\s*['"]/.test(line)) {
        const eventName = line.match(/emit\s*\(\s*['"]([^'"]+)['"]/)?.[1];
        signals.push(
          this.createSignal({
            id: 'vue-emit-change',
            title: eventName ? `Emit: ${eventName}` : 'Emit Definition',
            category: 'signature',
            reason: 'Component event contract - verify parent handlers are updated',
            weight: 0.4,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['vue', 'emit', 'contract'],
            evidence: { kind: 'regex', pattern: 'defineEmits|emit' },
          }),
        );
      }

      if (/immediate\s*:\s*true/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'vue-watch-immediate',
            title: 'Immediate Watch',
            category: 'side-effect',
            reason: 'Watch with immediate runs on mount - verify initial state handling',
            weight: 0.3,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['vue', 'watch', 'immediate'],
            evidence: { kind: 'regex', pattern: 'immediate: true' },
          }),
        );
      }

      if (/shallowRef\s*\(|shallowReactive\s*\(/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'vue-shallow-reactive',
            title: 'Shallow Reactivity',
            category: 'side-effect',
            reason: 'Shallow reactive only tracks top-level - nested changes not reactive',
            weight: 0.4,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['vue', 'reactivity', 'shallow'],
            evidence: { kind: 'regex', pattern: 'shallowRef|shallowReactive' },
          }),
        );
      }

      if (/toRaw\s*\(/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'vue-to-raw',
            title: 'toRaw Usage',
            category: 'side-effect',
            reason: 'toRaw removes reactivity - changes to raw object not tracked',
            weight: 0.4,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['vue', 'reactivity', 'raw'],
            evidence: { kind: 'regex', pattern: 'toRaw' },
          }),
        );
      }

      if (/triggerRef\s*\(/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'vue-trigger-ref',
            title: 'Manual Trigger',
            category: 'side-effect',
            reason: 'triggerRef for manual reactivity - usually indicates design issue',
            weight: 0.5,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['vue', 'reactivity', 'manual'],
            evidence: { kind: 'regex', pattern: 'triggerRef' },
          }),
        );
      }

      if (/effectScope\s*\(/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'vue-effect-scope',
            title: 'Effect Scope',
            category: 'async',
            reason: 'effectScope for grouped cleanup - verify scope.stop() is called',
            weight: 0.3,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['vue', 'effectScope', 'cleanup'],
            evidence: { kind: 'regex', pattern: 'effectScope' },
          }),
        );
      }
    }

    const templateMatch = content.match(/<template>([\s\S]*?)<\/template>/);
    if (templateMatch) {
      const templateContent = templateMatch[1];
      const heavyExpressions = templateContent.match(/\{\{[^}]{50,}\}\}/g) || [];

      if (heavyExpressions.length > 0) {
        signals.push(
          this.createSignal({
            id: 'vue-template-heavy',
            title: 'Heavy Template Expressions',
            category: 'complexity',
            reason: `${heavyExpressions.length} complex expressions in template - extract to computed`,
            weight: 0.4,
            signalClass: 'maintainability',
            confidence: 'medium',
            tags: ['vue', 'template', 'performance'],
            evidence: { kind: 'heuristic', details: { count: heavyExpressions.length } },
          }),
        );
      }
    }

    return signals;
  }

  /**
   * VUE-008: Store patterns (Pinia/Vuex)
   */
  private detectStorePatterns(): Signal[] {
    const signals: Signal[] = [];
    const { lines, content } = this.ctx;

    const isPinia = /from\s+['"]pinia['"]|defineStore/.test(content);
    const isVuex = /from\s+['"]vuex['"]|useStore|mapState|mapGetters|mapActions/.test(content);

    if (!isPinia && !isVuex) {
      return signals;
    }

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!this.shouldAnalyzeLine(lineNum)) continue;

      const line = lines[i];

      if (/defineStore\s*\(/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'vue-pinia-store',
            title: 'Pinia Store Definition',
            category: 'signature',
            reason: 'Store definition changed - verify consumers are updated',
            weight: 0.4,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum, lineNum + 5),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['vue', 'pinia', 'store'],
            evidence: { kind: 'regex', pattern: 'defineStore' },
          }),
        );
      }

      if (/storeToRefs\s*\(/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'vue-store-to-refs',
            title: 'Store to Refs',
            category: 'side-effect',
            reason: 'storeToRefs preserves reactivity from store',
            weight: 0.2,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['vue', 'pinia', 'refs'],
            evidence: { kind: 'regex', pattern: 'storeToRefs' },
          }),
        );
      }

      if (/\$patch\s*\(/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'vue-pinia-patch',
            title: 'Store Patch',
            category: 'side-effect',
            reason: '$patch batches multiple state changes - verify mutations are correct',
            weight: 0.3,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['vue', 'pinia', 'mutation'],
            evidence: { kind: 'regex', pattern: '$patch' },
          }),
        );
      }

      if (/\$reset\s*\(/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'vue-pinia-reset',
            title: 'Store Reset',
            category: 'side-effect',
            reason: '$reset restores initial state - verify this is intended',
            weight: 0.4,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['vue', 'pinia', 'reset'],
            evidence: { kind: 'regex', pattern: '$reset' },
          }),
        );
      }

      if (/mutations\s*:\s*\{/.test(line) || /commit\s*\(\s*['"]/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'vue-vuex-mutation',
            title: 'Vuex Mutation',
            category: 'side-effect',
            reason: 'Vuex mutation changes state - verify state shape is correct',
            weight: 0.4,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['vue', 'vuex', 'mutation'],
            evidence: { kind: 'regex', pattern: 'mutations|commit' },
          }),
        );
      }

      if (/actions\s*:\s*\{/.test(line) || /dispatch\s*\(\s*['"]/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'vue-vuex-action',
            title: 'Vuex Action',
            category: 'async',
            reason: 'Vuex action (async) - verify error handling and loading states',
            weight: 0.3,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['vue', 'vuex', 'action'],
            evidence: { kind: 'regex', pattern: 'actions|dispatch' },
          }),
        );
      }

      if (/store\.state\.\w+\s*=/.test(line)) {
        signals.push(
          this.createSignal({
            id: 'vue-store-direct-mutation',
            title: 'Direct Store Mutation',
            category: 'side-effect',
            reason: 'Direct store state mutation - use actions/mutations instead',
            weight: 0.8,
            lines: [lineNum],
            snippet: this.getSnippet(lineNum),
            signalClass: 'behavioral',
            confidence: 'high',
            tags: ['vue', 'store', 'anti-pattern'],
            evidence: { kind: 'regex', pattern: 'store.state.* =' },
            actions: [
              {
                type: 'mitigation_steps',
                text: 'Use proper mutation',
                steps: [
                  'Use store.commit() for Vuex mutations',
                  'Use store.$patch() for Pinia',
                  'Create action for complex state changes',
                ],
              },
            ],
          }),
        );
      }
    }

    return signals;
  }
}
