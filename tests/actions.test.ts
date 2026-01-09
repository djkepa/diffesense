import { describe, it, expect } from 'vitest';
import {
  getActionsForFile,
  generateDefaultActions,
  formatAction,
  formatActionsMarkdown,
  DEFAULT_ACTION_MAPPINGS,
  ActionMapping,
  ConcreteAction,
} from '../src/core/actions';

describe('actions', () => {
  describe('generateDefaultActions', () => {
    it('should generate test action for high risk files', () => {
      const actions = generateDefaultActions('src/auth/login.ts', 8.0, 5, ['auth-boundary']);

      const testAction = actions.find((a) => a.type === 'test');
      expect(testAction).toBeDefined();
      expect(testAction?.command).toContain('auth');
    });

    it('should generate review action for high blast radius', () => {
      const actions = generateDefaultActions('src/shared/utils.ts', 4.0, 15, []);

      const reviewAction = actions.find((a) => a.type === 'review');
      expect(reviewAction).toBeDefined();
      expect(reviewAction?.text).toContain('15 files');
    });

    it('should suggest effect deps fix for react-effect-no-deps', () => {
      const actions = generateDefaultActions('src/Component.tsx', 5.0, 2, ['react-effect-no-deps']);

      const checkAction = actions.find((a) => a.type === 'check');
      expect(checkAction).toBeDefined();
      expect(checkAction?.text).toContain('dependencies');
    });

    it('should suggest async replacement for node-sync-op', () => {
      const actions = generateDefaultActions('src/server.ts', 5.0, 2, ['node-sync-op']);

      const refactorAction = actions.find((a) => a.type === 'refactor');
      expect(refactorAction).toBeDefined();
      expect(refactorAction?.text).toContain('async');
    });

    it('should provide fallback action when no specific signals', () => {
      const actions = generateDefaultActions('src/unknown.ts', 3.0, 1, []);

      expect(actions.length).toBeGreaterThan(0);
      expect(actions[0].type).toBe('review');
    });
  });

  describe('getActionsForFile', () => {
    it('should use default mappings for auth files', () => {
      const actions = getActionsForFile('src/auth/login.ts', []);

      expect(actions.some((a) => a.reviewers?.includes('@security-team'))).toBe(true);
      expect(actions.some((a) => a.command?.includes('auth'))).toBe(true);
    });

    it('should use default mappings for payment files', () => {
      const actions = getActionsForFile('src/payments/stripe.ts', []);

      expect(actions.some((a) => a.reviewers?.includes('@payments-team'))).toBe(true);
    });

    it('should use custom mapping when pattern matches', () => {
      const customMappings: ActionMapping[] = [
        {
          pattern: '**/custom/**',
          actions: [
            {
              type: 'review',
              text: 'Custom review',
              reviewers: ['@custom-team'],
              automated: false,
              priority: 1,
            },
          ],
        },
      ];

      const actions = getActionsForFile('src/custom/feature.ts', customMappings);

      expect(actions.some((a) => a.reviewers?.includes('@custom-team'))).toBe(true);
    });

    it('should merge custom and default mappings', () => {
      const customMappings: ActionMapping[] = [
        {
          pattern: '**/auth/**',
          actions: [
            {
              type: 'verify',
              text: 'Extra verification',
              automated: false,
              priority: 0,
            },
          ],
        },
      ];

      const actions = getActionsForFile('src/auth/login.ts', customMappings);

      // Should have both custom and default actions
      expect(actions.some((a) => a.text === 'Extra verification')).toBe(true);
      expect(actions.some((a) => a.reviewers?.includes('@security-team'))).toBe(true);
    });

    it('should fall back to defaults when no pattern matches', () => {
      const defaultActions: ConcreteAction[] = [
        {
          type: 'test',
          text: 'Default test',
          command: 'npm test',
          automated: true,
          priority: 1,
        },
      ];

      const actions = getActionsForFile('src/random/file.ts', [], defaultActions);

      expect(actions).toEqual(defaultActions);
    });

    it('should sort actions by priority', () => {
      const actions = getActionsForFile('src/auth/login.ts', []);

      for (let i = 1; i < actions.length; i++) {
        expect(actions[i].priority).toBeGreaterThanOrEqual(actions[i - 1].priority);
      }
    });
  });

  describe('formatAction', () => {
    it('should format action with command', () => {
      const action: ConcreteAction = {
        type: 'test',
        text: 'Run tests',
        command: 'npm test',
        automated: true,
        priority: 1,
      };

      const formatted = formatAction(action);

      expect(formatted).toContain('Run tests');
      expect(formatted).toContain('npm test');
    });

    it('should format action with reviewers', () => {
      const action: ConcreteAction = {
        type: 'review',
        text: 'Request review',
        reviewers: ['@team-a', '@team-b'],
        automated: false,
        priority: 1,
      };

      const formatted = formatAction(action);

      expect(formatted).toContain('@team-a');
      expect(formatted).toContain('@team-b');
    });

    it('should format action with link', () => {
      const action: ConcreteAction = {
        type: 'check',
        text: 'Check docs',
        link: 'https://example.com/docs',
        automated: false,
        priority: 1,
      };

      const formatted = formatAction(action);

      expect(formatted).toContain('https://example.com/docs');
    });
  });

  describe('formatActionsMarkdown', () => {
    it('should format actions as markdown list', () => {
      const actions: ConcreteAction[] = [
        {
          type: 'test',
          text: 'Run tests',
          command: 'npm test',
          automated: true,
          priority: 1,
        },
        {
          type: 'review',
          text: 'Request review',
          reviewers: ['@team'],
          automated: false,
          priority: 2,
        },
      ];

      const markdown = formatActionsMarkdown(actions);

      expect(markdown).toContain('**Do next:**');
      expect(markdown).toContain('- Run: `npm test`');
      expect(markdown).toContain('- Review: @team');
    });

    it('should limit to 3 actions', () => {
      const actions: ConcreteAction[] = [
        { type: 'test', text: 'Test 1', automated: true, priority: 1 },
        { type: 'test', text: 'Test 2', automated: true, priority: 2 },
        { type: 'test', text: 'Test 3', automated: true, priority: 3 },
        { type: 'test', text: 'Test 4', automated: true, priority: 4 },
      ];

      const markdown = formatActionsMarkdown(actions);

      expect(markdown).toContain('Test 1');
      expect(markdown).toContain('Test 2');
      expect(markdown).toContain('Test 3');
      expect(markdown).not.toContain('Test 4');
    });

    it('should return empty string for empty actions', () => {
      const markdown = formatActionsMarkdown([]);
      expect(markdown).toBe('');
    });
  });
});
