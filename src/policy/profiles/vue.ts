import { Rule } from '../engine';

export const vueProfile: Rule[] = [
  {
    id: 'critical-risk-blocks',
    description: 'Critical risk files always block',
    when: { riskGte: 8.0 },
    then: {
      severity: 'blocker',
      actions: [
        { type: 'review', text: 'Critical risk level - requires immediate review' },
        { type: 'test', text: 'Add comprehensive tests before merge' },
      ],
    },
  },
  {
    id: 'high-risk-high-radius',
    description: 'High risk + high impact = blocker',
    when: { riskGte: 7.0, blastRadiusGte: 10 },
    then: {
      severity: 'blocker',
      actions: [
        { type: 'test', text: 'Add tests for this high-impact module' },
        { type: 'review', text: 'Request review from area owner' },
      ],
    },
  },
  {
    id: 'high-risk-warning',
    description: 'High risk files need attention',
    when: { riskGte: 6.0 },
    then: {
      severity: 'warning',
      actions: [{ type: 'review', text: 'Review carefully - elevated risk level' }],
    },
  },
  {
    id: 'vue-watch-issues',
    description: 'Vue watch without cleanup',
    when: { evidenceTags: ['vue-watch-no-cleanup'] },
    then: {
      severity: 'warning',
      actions: [
        { type: 'refactor', text: 'Add cleanup function to watch/watchEffect' },
        { type: 'test', text: 'Test component unmount behavior' },
      ],
    },
  },
  {
    id: 'vue-computed-side-effects',
    description: 'Computed with side effects is anti-pattern',
    when: { evidenceTags: ['vue-computed-side-effect'] },
    then: {
      severity: 'blocker',
      actions: [
        { type: 'refactor', text: 'Move side effects out of computed property' },
        { type: 'refactor', text: 'Use watch or method instead' },
      ],
    },
  },
  {
    id: 'vue-props-mutation',
    description: 'Props mutation is forbidden',
    when: { evidenceTags: ['vue-props-mutation'] },
    then: {
      severity: 'blocker',
      actions: [
        { type: 'refactor', text: 'Emit event instead of mutating props' },
        { type: 'refactor', text: 'Use local data copy if mutation needed' },
      ],
    },
  },
  {
    id: 'vue-complexity',
    description: 'Vue component complexity',
    when: { evidenceContains: ['vue-many-refs', 'vue-large-data'] },
    then: {
      severity: 'info',
      actions: [
        { type: 'refactor', text: 'Extract logic into composables' },
        { type: 'split', text: 'Consider splitting into smaller components' },
      ],
    },
  },
];
