import { describe, it, expect } from 'vitest';
import {
  parseCodeOwners,
  getOwnersForFile,
  suggestReviewers,
  getUniqueReviewers,
  formatReviewersForComment,
  CodeOwnersConfig,
} from '../src/core/codeowners';

describe('CODEOWNERS Parser', () => {
  describe('parseCodeOwners', () => {
    it('should parse simple CODEOWNERS file', () => {
      const content = `
# This is a comment
* @default-team

src/auth/* @security-team
src/payments/* @payments-team @finance-team
*.ts @typescript-team
`;

      const config = parseCodeOwners(content);

      expect(config.rules).toHaveLength(4);
      expect(config.defaultOwners).toEqual(['@default-team']);
    });

    it('should handle patterns with leading slash', () => {
      const content = `/src/auth/* @security-team`;

      const config = parseCodeOwners(content);

      expect(config.rules[0].pattern).toBe('src/auth/*');
    });

    it('should handle multiple owners per pattern', () => {
      const content = `src/critical/* @team-a @team-b user@example.com`;

      const config = parseCodeOwners(content);

      expect(config.rules[0].owners).toHaveLength(3);
      expect(config.rules[0].owners).toContain('@team-a');
      expect(config.rules[0].owners).toContain('@team-b');
    });

    it('should skip empty lines and comments', () => {
      const content = `
# Comment 1
* @default

# Comment 2

src/* @team
`;

      const config = parseCodeOwners(content);

      expect(config.rules).toHaveLength(2);
    });

    it('should handle negation patterns', () => {
      const content = `
* @default-team
!docs/* @docs-team
`;

      const config = parseCodeOwners(content);

      expect(config.rules[1].negation).toBe(true);
    });
  });

  describe('getOwnersForFile', () => {
    const config: CodeOwnersConfig = {
      filePath: 'CODEOWNERS',
      rules: [
        { line: 1, pattern: '*', owners: ['@default'], negation: false },
        { line: 2, pattern: 'src/auth/**', owners: ['@security'], negation: false },
        { line: 3, pattern: 'src/payments/**', owners: ['@payments'], negation: false },
        { line: 4, pattern: '**/*.test.ts', owners: ['@testing'], negation: false },
      ],
      defaultOwners: ['@default'],
    };

    it('should match auth files to security team', () => {
      const match = getOwnersForFile('src/auth/login.ts', config);

      expect(match).not.toBeNull();
      expect(match?.owners).toContain('@security');
    });

    it('should match payments files to payments team', () => {
      const match = getOwnersForFile('src/payments/stripe.ts', config);

      expect(match).not.toBeNull();
      expect(match?.owners).toContain('@payments');
    });

    it('should match test files to testing team', () => {
      const match = getOwnersForFile('src/utils/helper.test.ts', config);

      expect(match).not.toBeNull();
      expect(match?.owners).toContain('@testing');
    });

    it('should fall back to default owners', () => {
      const match = getOwnersForFile('README.md', config);

      expect(match).not.toBeNull();
      expect(match?.owners).toContain('@default');
    });

    it('should use last matching pattern (CODEOWNERS rule)', () => {
      // Create config where multiple patterns could match
      const multiConfig: CodeOwnersConfig = {
        filePath: 'CODEOWNERS',
        rules: [
          { line: 1, pattern: '**/*.ts', owners: ['@ts-team'], negation: false },
          { line: 2, pattern: 'src/auth/**', owners: ['@security'], negation: false },
        ],
        defaultOwners: [],
      };

      // Auth file should match security (last matching pattern)
      const match = getOwnersForFile('src/auth/login.ts', multiConfig);

      expect(match?.owners).toContain('@security');
    });
  });

  describe('suggestReviewers', () => {
    const config: CodeOwnersConfig = {
      filePath: 'CODEOWNERS',
      rules: [
        { line: 1, pattern: '*', owners: ['@default'], negation: false },
        { line: 2, pattern: 'src/auth/**', owners: ['@security'], negation: false },
      ],
      defaultOwners: ['@default'],
    };

    it('should suggest reviewers based on file paths', () => {
      const files = [
        { path: 'src/auth/login.ts', riskScore: 5.0 },
        { path: 'src/utils/helper.ts', riskScore: 2.0 },
      ];

      const suggestions = suggestReviewers(files, config);

      expect(suggestions).toHaveLength(2);
      expect(suggestions[0].reviewers).toContain('@security');
      expect(suggestions[1].reviewers).toContain('@default');
    });

    it('should add escalation owners when risk is high', () => {
      const files = [{ path: 'src/auth/login.ts', riskScore: 8.0 }];

      const escalation = {
        riskThreshold: 7.0,
        escalationOwners: ['@team-lead', '@cto'],
      };

      const suggestions = suggestReviewers(files, config, escalation);

      expect(suggestions[0].isEscalation).toBe(true);
      expect(suggestions[0].reviewers).toContain('@team-lead');
      expect(suggestions[0].reviewers).toContain('@cto');
    });

    it('should not escalate when risk is below threshold', () => {
      const files = [{ path: 'src/auth/login.ts', riskScore: 5.0 }];

      const escalation = {
        riskThreshold: 7.0,
        escalationOwners: ['@team-lead'],
      };

      const suggestions = suggestReviewers(files, config, escalation);

      expect(suggestions[0].isEscalation).toBe(false);
      expect(suggestions[0].reviewers).not.toContain('@team-lead');
    });
  });

  describe('getUniqueReviewers', () => {
    it('should return unique reviewers across all suggestions', () => {
      const suggestions = [
        { filePath: 'a.ts', reviewers: ['@team-a', '@team-b'], reason: '', isEscalation: false },
        { filePath: 'b.ts', reviewers: ['@team-b', '@team-c'], reason: '', isEscalation: false },
      ];

      const unique = getUniqueReviewers(suggestions);

      expect(unique).toHaveLength(3);
      expect(unique).toContain('@team-a');
      expect(unique).toContain('@team-b');
      expect(unique).toContain('@team-c');
    });
  });

  describe('formatReviewersForComment', () => {
    it('should format few reviewers inline', () => {
      const formatted = formatReviewersForComment(['@alice', '@bob']);

      expect(formatted).toBe('@alice, @bob');
    });

    it('should truncate many reviewers', () => {
      const formatted = formatReviewersForComment(['@a', '@b', '@c', '@d', '@e']);

      expect(formatted).toContain('+2 more');
    });

    it('should handle empty list', () => {
      const formatted = formatReviewersForComment([]);

      expect(formatted).toContain('No specific reviewers');
    });
  });
});

