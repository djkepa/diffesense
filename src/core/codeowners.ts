import * as fs from 'fs';
import * as path from 'path';
import { minimatch } from 'minimatch';

export interface CodeOwnerRule {
  line: number;
  pattern: string;
  owners: string[];
  negation: boolean;
}

export interface CodeOwnersConfig {
  filePath: string;
  rules: CodeOwnerRule[];
  defaultOwners: string[];
}

export interface OwnerMatch {
  filePath: string;
  owners: string[];
  matchedPattern: string;
  matchedLine: number;
}

export interface EscalationConfig {
  riskThreshold: number;
  escalationOwners: string[];
}

export function findCodeOwnersFile(repoRoot: string = process.cwd()): string | null {
  const possiblePaths = [
    path.join(repoRoot, 'CODEOWNERS'),
    path.join(repoRoot, '.github', 'CODEOWNERS'),
    path.join(repoRoot, '.gitlab', 'CODEOWNERS'),
    path.join(repoRoot, 'docs', 'CODEOWNERS'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  return null;
}

export function parseCodeOwners(
  content: string,
  filePath: string = 'CODEOWNERS',
): CodeOwnersConfig {
  const rules: CodeOwnerRule[] = [];
  const lines = content.split('\n');
  let defaultOwners: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNumber = i + 1;

    if (!line || line.startsWith('#')) {
      continue;
    }

    const parsed = parseCodeOwnerLine(line, lineNumber);
    if (parsed) {
      if (parsed.pattern === '*') {
        defaultOwners = parsed.owners;
      }
      rules.push(parsed);
    }
  }

  return {
    filePath,
    rules,
    defaultOwners,
  };
}

function parseCodeOwnerLine(line: string, lineNumber: number): CodeOwnerRule | null {
  const parts = line.split(/\s+/).filter(Boolean);

  if (parts.length < 2) {
    return null;
  }

  let pattern = parts[0];
  const negation = pattern.startsWith('!');

  if (negation) {
    pattern = pattern.slice(1);
  }

  pattern = normalizePattern(pattern);

  const owners = parts.slice(1).filter((p) => p.startsWith('@') || p.includes('@'));

  if (owners.length === 0) {
    return null;
  }

  return {
    line: lineNumber,
    pattern,
    owners,
    negation,
  };
}

function normalizePattern(pattern: string): string {
  if (pattern.startsWith('/')) {
    pattern = pattern.slice(1);
  }

  if (!pattern.startsWith('*') && !pattern.includes('/')) {
    pattern = '**/' + pattern;
  }

  return pattern;
}

export function loadCodeOwners(repoRoot: string = process.cwd()): CodeOwnersConfig | null {
  const filePath = findCodeOwnersFile(repoRoot);

  if (!filePath) {
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return parseCodeOwners(content, filePath);
  } catch (error) {
    console.warn(`Warning: Could not read CODEOWNERS file: ${error}`);
    return null;
  }
}

export function getOwnersForFile(filePath: string, config: CodeOwnersConfig): OwnerMatch | null {
  filePath = filePath.replace(/^\.\//, '');

  let lastMatch: OwnerMatch | null = null;

  for (const rule of config.rules) {
    if (rule.negation) {
      if (matchPattern(filePath, rule.pattern)) {
        lastMatch = null;
      }
    } else {
      if (matchPattern(filePath, rule.pattern)) {
        lastMatch = {
          filePath,
          owners: rule.owners,
          matchedPattern: rule.pattern,
          matchedLine: rule.line,
        };
      }
    }
  }

  if (!lastMatch && config.defaultOwners.length > 0) {
    return {
      filePath,
      owners: config.defaultOwners,
      matchedPattern: '*',
      matchedLine: 0,
    };
  }

  return lastMatch;
}

export function getOwnersForFiles(
  filePaths: string[],
  config: CodeOwnersConfig,
): Map<string, OwnerMatch | null> {
  const results = new Map<string, OwnerMatch | null>();

  for (const filePath of filePaths) {
    results.set(filePath, getOwnersForFile(filePath, config));
  }

  return results;
}

function matchPattern(filePath: string, pattern: string): boolean {
  if (pattern.endsWith('/')) {
    return filePath.startsWith(pattern.slice(0, -1) + '/') || filePath === pattern.slice(0, -1);
  }

  return minimatch(filePath, pattern, { dot: true, matchBase: true });
}

export interface ReviewerSuggestion {
  filePath: string;
  reviewers: string[];
  reason: string;
  isEscalation: boolean;
}

export function suggestReviewers(
  files: Array<{ path: string; riskScore: number }>,
  config: CodeOwnersConfig,
  escalation?: EscalationConfig,
): ReviewerSuggestion[] {
  const suggestions: ReviewerSuggestion[] = [];
  const allOwners = new Set<string>();

  for (const file of files) {
    const match = getOwnersForFile(file.path, config);

    if (match) {
      const suggestion: ReviewerSuggestion = {
        filePath: file.path,
        reviewers: [...match.owners],
        reason: `Matched pattern: ${match.matchedPattern}`,
        isEscalation: false,
      };

      if (escalation && file.riskScore >= escalation.riskThreshold) {
        suggestion.reviewers = [
          ...new Set([...suggestion.reviewers, ...escalation.escalationOwners]),
        ];
        suggestion.reason += ` (escalated due to risk ${file.riskScore.toFixed(1)})`;
        suggestion.isEscalation = true;
      }

      suggestions.push(suggestion);
      match.owners.forEach((o) => allOwners.add(o));
    }
  }

  return suggestions;
}

export function getUniqueReviewers(suggestions: ReviewerSuggestion[]): string[] {
  const reviewers = new Set<string>();

  for (const s of suggestions) {
    s.reviewers.forEach((r) => reviewers.add(r));
  }

  return Array.from(reviewers);
}

export function formatReviewersForComment(reviewers: string[]): string {
  if (reviewers.length === 0) {
    return 'No specific reviewers found';
  }

  if (reviewers.length <= 3) {
    return reviewers.join(', ');
  }

  return `${reviewers.slice(0, 3).join(', ')} (+${reviewers.length - 3} more)`;
}
