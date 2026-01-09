import { Rule } from '../engine';

export const backendProfile: Rule[] = [
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
    id: 'side-effects-in-core',
    description: 'Side effects in core modules need attention',
    when: {
      evidenceContains: ['side-effect'],
      pathMatches: ['src/core/**', 'src/services/**', 'src/api/**'],
    },
    then: {
      severity: 'warning',
      actions: [
        { type: 'refactor', text: 'Isolate side-effects for testability' },
        { type: 'test', text: 'Add integration tests' },
      ],
    },
  },
  {
    id: 'network-calls',
    description: 'Network calls in modified files',
    when: { evidenceTags: ['side-effect'] },
    then: {
      severity: 'info',
      actions: [
        { type: 'review', text: 'Review error handling and timeouts' },
        { type: 'test', text: 'Add tests with mocked network calls' },
      ],
    },
  },
];
