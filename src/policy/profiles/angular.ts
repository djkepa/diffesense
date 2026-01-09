import { Rule } from '../engine';

export const angularProfile: Rule[] = [
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
    id: 'angular-subscription-leaks',
    description: 'Observable subscriptions must be cleaned up',
    when: { evidenceTags: ['angular-subscription-leak'] },
    then: {
      severity: 'blocker',
      actions: [
        { type: 'refactor', text: 'Use takeUntilDestroyed or async pipe' },
        { type: 'refactor', text: 'Unsubscribe in ngOnDestroy' },
      ],
    },
  },
  {
    id: 'angular-nested-subscribes',
    description: 'Nested subscribes are anti-pattern',
    when: { evidenceTags: ['angular-nested-subscribe'] },
    then: {
      severity: 'blocker',
      actions: [
        { type: 'refactor', text: 'Use switchMap, mergeMap, or concatMap' },
        { type: 'review', text: 'Review RxJS operator usage' },
      ],
    },
  },
  {
    id: 'angular-http-errors',
    description: 'HTTP calls need error handling',
    when: { evidenceTags: ['angular-http-no-error'] },
    then: {
      severity: 'warning',
      actions: [
        { type: 'refactor', text: 'Add catchError operator to HTTP calls' },
        { type: 'test', text: 'Test error scenarios' },
      ],
    },
  },
  {
    id: 'angular-dom-access',
    description: 'Direct DOM access is discouraged',
    when: { evidenceTags: ['angular-dom-access'] },
    then: {
      severity: 'warning',
      actions: [
        { type: 'refactor', text: 'Use Renderer2 for DOM manipulation' },
        { type: 'review', text: 'Ensure SSR compatibility' },
      ],
    },
  },
  {
    id: 'angular-performance',
    description: 'Angular performance patterns',
    when: { evidenceContains: ['angular-no-onpush', 'angular-many-viewchild'] },
    then: {
      severity: 'info',
      actions: [
        { type: 'refactor', text: 'Consider ChangeDetectionStrategy.OnPush' },
        { type: 'refactor', text: 'Reduce ViewChild queries' },
      ],
    },
  },
];
