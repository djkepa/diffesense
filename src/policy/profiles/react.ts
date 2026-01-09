import { Rule } from '../engine';

export const reactProfile: Rule[] = [
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
    id: 'high-blast-radius',
    description: 'High impact files need attention',
    when: { blastRadiusGte: 15 },
    then: {
      severity: 'warning',
      actions: [{ type: 'review', text: 'Many files depend on this - review impact' }],
    },
  },
  {
    id: 'react-effect-issues',
    description: 'React useEffect issues can cause bugs',
    when: { evidenceTags: ['react-effect'] },
    then: {
      severity: 'blocker',
      actions: [
        { type: 'refactor', text: 'Add dependency array to useEffect' },
        { type: 'test', text: 'Add tests to verify effect behavior' },
      ],
    },
  },
  {
    id: 'side-effects-in-components',
    description: 'Side effects in components should use hooks',
    when: {
      evidenceContains: ['side-effect'],
      pathMatches: ['src/components/**', 'src/pages/**', 'app/**'],
    },
    then: {
      severity: 'warning',
      actions: [
        { type: 'refactor', text: 'Move side-effects to custom hooks' },
        { type: 'review', text: 'Ensure proper cleanup in useEffect' },
      ],
    },
  },
  {
    id: 'react-performance',
    description: 'React performance patterns',
    when: { evidenceContains: ['inline'] },
    then: {
      severity: 'info',
      actions: [
        { type: 'refactor', text: 'Memoize callbacks with useCallback' },
        { type: 'refactor', text: 'Move style objects outside component or use useMemo' },
      ],
    },
  },
];
