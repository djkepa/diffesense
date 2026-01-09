import { minimatch } from 'minimatch';

export type ActionType = 'test' | 'review' | 'check' | 'document' | 'refactor' | 'verify';

export interface ConcreteAction {
  type: ActionType;
  text: string;
  command?: string;
  reviewers?: string[];
  link?: string;
  automated: boolean;
  priority: number;
}

export interface ActionMapping {
  pattern: string;
  actions: ConcreteAction[];
}

export const DEFAULT_ACTION_MAPPINGS: ActionMapping[] = [
  {
    pattern: '**/auth/**',
    actions: [
      {
        type: 'test',
        text: 'Run auth tests',
        command: 'npm test -- --grep "auth"',
        automated: true,
        priority: 1,
      },
      {
        type: 'review',
        text: 'Request security review',
        reviewers: ['@security-team'],
        automated: false,
        priority: 2,
      },
    ],
  },
  {
    pattern: '**/security/**',
    actions: [
      {
        type: 'test',
        text: 'Run security tests',
        command: 'npm test -- --grep "security"',
        automated: true,
        priority: 1,
      },
      {
        type: 'review',
        text: 'Request security review',
        reviewers: ['@security-team'],
        automated: false,
        priority: 2,
      },
    ],
  },

  {
    pattern: '**/payment*/**',
    actions: [
      {
        type: 'test',
        text: 'Run payment tests',
        command: 'npm test -- --grep "payment"',
        automated: true,
        priority: 1,
      },
      {
        type: 'verify',
        text: 'Verify idempotency and retry logic',
        automated: false,
        priority: 2,
      },
      {
        type: 'review',
        text: 'Request payment team review',
        reviewers: ['@payments-team'],
        automated: false,
        priority: 3,
      },
    ],
  },

  {
    pattern: '**/api/**',
    actions: [
      {
        type: 'test',
        text: 'Run API tests',
        command: 'npm test -- --grep "api"',
        automated: true,
        priority: 1,
      },
      {
        type: 'verify',
        text: 'Check API contract compatibility',
        automated: false,
        priority: 2,
      },
    ],
  },
  {
    pattern: '**/routes/**',
    actions: [
      {
        type: 'test',
        text: 'Run route tests',
        command: 'npm test -- --grep "route"',
        automated: true,
        priority: 1,
      },
    ],
  },

  {
    pattern: '**/components/**',
    actions: [
      {
        type: 'test',
        text: 'Run component tests',
        command: 'npm test -- --testPathPattern="components"',
        automated: true,
        priority: 1,
      },
      {
        type: 'check',
        text: 'Check for effect dependency issues',
        automated: false,
        priority: 2,
      },
    ],
  },

  {
    pattern: '**/store/**',
    actions: [
      {
        type: 'test',
        text: 'Run store tests',
        command: 'npm test -- --grep "store"',
        automated: true,
        priority: 1,
      },
      {
        type: 'verify',
        text: 'Verify state mutation patterns',
        automated: false,
        priority: 2,
      },
    ],
  },
  {
    pattern: '**/redux/**',
    actions: [
      {
        type: 'test',
        text: 'Run Redux tests',
        command: 'npm test -- --grep "redux"',
        automated: true,
        priority: 1,
      },
    ],
  },

  {
    pattern: '**/models/**',
    actions: [
      {
        type: 'test',
        text: 'Run model tests',
        command: 'npm test -- --grep "model"',
        automated: true,
        priority: 1,
      },
      {
        type: 'verify',
        text: 'Check migration compatibility',
        automated: false,
        priority: 2,
      },
    ],
  },
  {
    pattern: '**/migrations/**',
    actions: [
      {
        type: 'review',
        text: 'Request DBA review for migrations',
        reviewers: ['@database-team'],
        automated: false,
        priority: 1,
      },
      {
        type: 'verify',
        text: 'Test migration rollback',
        automated: false,
        priority: 2,
      },
    ],
  },

  {
    pattern: '**/middleware/**',
    actions: [
      {
        type: 'test',
        text: 'Run middleware tests',
        command: 'npm test -- --grep "middleware"',
        automated: true,
        priority: 1,
      },
      {
        type: 'verify',
        text: 'Check middleware order and side effects',
        automated: false,
        priority: 2,
      },
    ],
  },

  {
    pattern: '**/utils/**',
    actions: [
      {
        type: 'test',
        text: 'Run utility tests',
        command: 'npm test -- --testPathPattern="utils"',
        automated: true,
        priority: 1,
      },
    ],
  },
  {
    pattern: '**/helpers/**',
    actions: [
      {
        type: 'test',
        text: 'Run helper tests',
        command: 'npm test -- --testPathPattern="helpers"',
        automated: true,
        priority: 1,
      },
    ],
  },
];

export function getActionsForFile(
  filePath: string,
  customMappings: ActionMapping[] = [],
  defaultActions: ConcreteAction[] = [],
): ConcreteAction[] {
  const normalizedPath = filePath.replace(/\\/g, '/');
  const matchedActions: ConcreteAction[] = [];

  for (const mapping of customMappings) {
    if (minimatch(normalizedPath, mapping.pattern, { dot: true })) {
      matchedActions.push(...mapping.actions);
    }
  }

  for (const mapping of DEFAULT_ACTION_MAPPINGS) {
    if (minimatch(normalizedPath, mapping.pattern, { dot: true })) {
      for (const action of mapping.actions) {
        const isDuplicate = matchedActions.some(
          (a) => a.type === action.type && a.text === action.text,
        );
        if (!isDuplicate) {
          matchedActions.push(action);
        }
      }
    }
  }

  if (matchedActions.length === 0 && defaultActions.length > 0) {
    matchedActions.push(...defaultActions);
  }

  return matchedActions.sort((a, b) => a.priority - b.priority);
}

export function generateDefaultActions(
  filePath: string,
  riskScore: number,
  blastRadius: number,
  signalTypes: string[],
): ConcreteAction[] {
  const actions: ConcreteAction[] = [];

  const folderMatch = filePath.match(/\/([^/]+)\//);
  const folder = folderMatch ? folderMatch[1] : null;

  if (riskScore >= 7.0) {
    actions.push({
      type: 'test',
      text: folder ? `Run tests: npm test -- --grep "${folder}"` : 'Run related tests',
      command: folder ? `npm test -- --grep "${folder}"` : undefined,
      automated: !!folder,
      priority: 1,
    });
  }

  if (blastRadius >= 10) {
    actions.push({
      type: 'review',
      text: `Request review (${blastRadius} files depend on this)`,
      automated: false,
      priority: 2,
    });
  }

  if (signalTypes.includes('react-effect-no-deps')) {
    actions.push({
      type: 'check',
      text: 'Add missing useEffect dependencies',
      link: 'https://react.dev/reference/react/useEffect#specifying-reactive-dependencies',
      automated: false,
      priority: 3,
    });
  }

  if (signalTypes.includes('angular-subscription-leak')) {
    actions.push({
      type: 'check',
      text: 'Add takeUntil or async pipe to prevent memory leaks',
      automated: false,
      priority: 3,
    });
  }

  if (signalTypes.includes('node-sync-op')) {
    actions.push({
      type: 'refactor',
      text: 'Replace sync operations with async versions',
      automated: false,
      priority: 3,
    });
  }

  if (actions.length === 0) {
    actions.push({
      type: 'review',
      text: 'Review changes carefully before merge',
      automated: false,
      priority: 10,
    });
  }

  return actions;
}

export function formatAction(action: ConcreteAction): string {
  let result = action.text;

  if (action.command) {
    result += `\n  Command: \`${action.command}\``;
  }

  if (action.reviewers && action.reviewers.length > 0) {
    result += `\n  Reviewers: ${action.reviewers.join(', ')}`;
  }

  if (action.link) {
    result += `\n  Docs: ${action.link}`;
  }

  return result;
}

export function formatActionsMarkdown(actions: ConcreteAction[]): string {
  if (actions.length === 0) return '';

  const lines: string[] = ['**Do next:**'];

  for (const action of actions.slice(0, 3)) {
    if (action.command) {
      lines.push(`- Run: \`${action.command}\``);
    } else if (action.reviewers && action.reviewers.length > 0) {
      lines.push(`- Review: ${action.reviewers.join(', ')}`);
    } else {
      lines.push(`- ${action.text}`);
    }
  }

  return lines.join('\n');
}
