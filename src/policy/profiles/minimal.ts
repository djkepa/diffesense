import { Rule } from '../engine';

export const minimalProfile: Rule[] = [
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
];
