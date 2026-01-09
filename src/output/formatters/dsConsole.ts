import chalk from 'chalk';
import { EvaluationResult, RuleResult } from '../../policy/engine';
import { selectTopN, TopNResult, formatHiddenMessage } from '../../core/topN';
import { formatActionsMarkdown, ConcreteAction } from '../../core/actions';

export interface OutputContext {
  scope: string;
  base: string;
  branch: string | null;
  profile: string;
  changedCount: number;
  analyzedCount: number;
}

export interface ConsoleOutputConfig {
  showAll?: boolean;
  topN?: number;
  showConfidence?: boolean;
  colors?: boolean;
  details?: boolean;
}

const SEPARATOR = '-'.repeat(60);
const DOUBLE_SEP = '='.repeat(60);

export function formatConsoleOutput(
  result: EvaluationResult,
  context: OutputContext,
  config: ConsoleOutputConfig = {},
): string {
  const lines: string[] = [];
  const useColors = config.colors !== false;

  const topN = selectTopN(result.blockers, result.warnings, result.infos, {
    showAll: config.showAll || false,
    limit: config.topN || 3,
  });

  const isDetails = config.details || false;

  lines.push('');
  lines.push(
    useColors
      ? chalk.bold(isDetails ? 'DIFFESENSE — DETAILS' : 'DIFFESENSE')
      : isDetails
      ? 'DIFFESENSE — DETAILS'
      : 'DIFFESENSE',
  );
  lines.push(DOUBLE_SEP);

  const scopeDisplay =
    context.scope === 'commit'
      ? 'commit'
      : context.scope === 'range'
      ? 'range'
      : `${context.scope} vs ${context.base}`;
  lines.push(`Scope:     ${scopeDisplay}`);
  lines.push(`Profile:   ${context.profile}`);
  lines.push(`Changed:   ${context.changedCount} files | Analyzed: ${context.analyzedCount}`);
  lines.push('');

  const highestRisk = getHighestRisk(topN);
  const overallSeverity = getOverallSeverity(topN);
  const confidence = calculateOverallConfidence(topN);
  const confidenceLabel = formatConfidenceLabel(confidence);

  const decision =
    result.exitCode === 0
      ? useColors
        ? chalk.green('PASS ✔')
        : 'PASS ✔'
      : result.exitCode === 1
      ? useColors
        ? chalk.red('FAIL ✖')
        : 'FAIL ✖'
      : useColors
      ? chalk.yellow('WARN ✖')
      : 'WARN ✖';

  if (topN.totalCount === 0) {
    lines.push(`Decision:  ${decision}`);
    lines.push(
      `Highest:   0.0/10  LOW   | Confidence: ${confidenceLabel} (${confidence.toFixed(2)})`,
    );
    lines.push('');
    lines.push('All changed files are within acceptable risk levels.');
    lines.push('');
    lines.push(`Summary: blockers=0 | warnings=0 | highest=0.0 | exit=${result.exitCode}`);
  } else {
    const severityText =
      overallSeverity === 'blocker' ? 'HIGH' : overallSeverity === 'warning' ? 'MEDIUM' : 'LOW';

    lines.push(`Decision:  ${decision}`);
    lines.push(
      `Highest:   ${highestRisk.toFixed(1)}/10  ${severityText.padEnd(
        5,
      )} | Confidence: ${confidenceLabel} (${confidence.toFixed(2)})`,
    );
    lines.push('');

    if (!isDetails) {
      const topLabel = topN.isLimited
        ? `Top risk (${topN.shownCount}/${topN.totalCount})`
        : `Top risk (${topN.shownCount}/${topN.totalCount})`;
      lines.push(`${topLabel}   [--details for explanation]`);
    } else {
      lines.push(`Top ${topN.shownCount} risk${topN.shownCount > 1 ? 's' : ''}`);
    }
    lines.push(SEPARATOR);

    let rank = 1;
    for (const issue of topN.top) {
      if (isDetails) {
        lines.push(formatIssueDetailed(issue, rank, useColors));
      } else {
        lines.push(formatIssueCompact(issue, rank, useColors));
      }
      rank++;
    }

    lines.push('');
    lines.push(
      `Summary: blockers=${topN.blockers.length} | warnings=${
        topN.warnings.length
      } | highest=${highestRisk.toFixed(1)} | exit=${result.exitCode}`,
    );
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Format a single issue in compact format (DEFAULT)
 */
function formatIssueCompact(issue: RuleResult, rank: number, useColors: boolean): string {
  const lines: string[] = [];
  const severity = getSeverityFromRule(issue);
  const severityLabel =
    severity === 'blocker' ? 'BLOCKER' : severity === 'warning' ? 'WARNING' : 'INFO';

  const changedLines = (issue.file as any).changedLines || 0;
  const blastRadius = issue.file.blastRadius || 0;

  lines.push(issue.file.path);
  lines.push(
    `Risk: ${issue.file.riskScore.toFixed(
      1,
    )}  ${severityLabel} | Δ lines: ${changedLines} | Blast radius: ${blastRadius}`,
  );

  const whySentence = deriveWhySentence(issue);
  lines.push(`Why: ${whySentence}`);
  lines.push(SEPARATOR);

  return lines.join('\n');
}

/**
 * Format a single issue in detailed format (--details)
 */
function formatIssueDetailed(issue: RuleResult, rank: number, useColors: boolean): string {
  const lines: string[] = [];
  const severity = getSeverityFromRule(issue);
  const severityLabel =
    severity === 'blocker' ? 'BLOCKER' : severity === 'warning' ? 'WARNING' : 'INFO';

  const changedLines = (issue.file as any).changedLines || 0;
  const blastRadius = issue.file.blastRadius || 0;

  lines.push('');
  lines.push(`${rank}) ${issue.file.path}`);
  lines.push(
    `   Risk: ${issue.file.riskScore.toFixed(
      1,
    )}  ${severityLabel}   | Δ lines: ${changedLines} | Blast radius: ${blastRadius}`,
  );
  lines.push('');

  const whySentence = deriveWhySentence(issue);
  lines.push(`   Why this file:`);
  lines.push(`   ${whySentence}`);
  lines.push('');

  const breakdown = (issue.file as any).riskBreakdown;
  if (breakdown) {
    lines.push(`   Risk breakdown:`);
    lines.push(`     Behavioral:      +${breakdown.behavioral?.toFixed(1) || '0.0'}`);
    lines.push(
      `     Maintainability: +${
        breakdown.maintainability?.toFixed(1) || '0.0'
      }   (cannot block alone)`,
    );
    lines.push(`     Critical:        +${breakdown.critical?.toFixed(1) || '0.0'}`);
    lines.push('');
  }

  if (issue.file.evidence && issue.file.evidence.length > 0) {
    lines.push(`   Evidence (top 3):`);
    const topEvidence = issue.file.evidence.slice(0, 3);
    for (const ev of topEvidence) {
      const tag = ev.tag || 'unknown';
      lines.push(`     L${ev.line}  [${tag}]`);
      lines.push(`           ${ev.message}`);
    }
    lines.push('');
  }

  if (issue.actions.length > 0) {
    lines.push('   Do next:');
    for (const action of issue.actions.slice(0, 3)) {
      if ('command' in action && action.command) {
        lines.push(`     Run:    ${action.command}`);
      } else if ('reviewers' in action && action.reviewers) {
        lines.push(`     Review: ${(action.reviewers as string[]).join(', ')}`);
      } else {
        lines.push(`     Check:  ${action.text}`);
      }
    }
  }

  lines.push(SEPARATOR);
  return lines.join('\n');
}

/**
 * Get severity from rule result
 */
function getSeverityFromRule(issue: RuleResult): 'blocker' | 'warning' | 'info' {
  if (issue.file.riskScore >= 8.0) return 'blocker';
  if (issue.file.riskScore >= 6.0) return 'warning';
  return 'info';
}

/**
 * Get highest risk score from results
 */
function getHighestRisk(topN: TopNResult): number {
  const allIssues = [...topN.blockers, ...topN.warnings, ...topN.infos];
  if (allIssues.length === 0) return 0;
  return Math.max(...allIssues.map((i) => i.file.riskScore));
}

/**
 * Get overall severity
 */
function getOverallSeverity(topN: TopNResult): 'blocker' | 'warning' | 'info' {
  if (topN.blockers.length > 0) return 'blocker';
  if (topN.warnings.length > 0) return 'warning';
  return 'info';
}

/**
 * Calculate overall confidence from top N results
 */
function calculateOverallConfidence(topN: TopNResult): number {
  const allIssues = [...topN.blockers, ...topN.warnings, ...topN.infos];
  if (allIssues.length === 0) return 1.0;

  const confidences = allIssues.map((issue) => {
    const breakdown = (issue.file as any).riskBreakdown;
    return breakdown?.confidence || 0.7;
  });

  const avg = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
  return avg;
}

/**
 * Format confidence as label
 */
function formatConfidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return 'HIGH';
  if (confidence >= 0.6) return 'MEDIUM';
  return 'LOW';
}

/**
 * Derive "Why" sentence from issue
 */
function deriveWhySentence(issue: RuleResult): string {
  const breakdown = (issue.file as any).riskBreakdown;
  const blastRadius = issue.file.blastRadius || 0;

  if (breakdown) {
    const { behavioral = 0, critical = 0, maintainability = 0 } = breakdown;

    if (critical > 0) {
      return 'Critical signals present (auth, payments, security)';
    }

    if (blastRadius > 10) {
      return `High blast radius (${blastRadius} dependent files)`;
    }

    if (behavioral > maintainability) {
      return 'Behavioral side-effects detected in changed lines';
    }

    if (maintainability > 0) {
      return 'Maintainability issues detected (complexity, nesting)';
    }
  }

  if (issue.file.riskReasons.length > 0) {
    return issue.file.riskReasons[0];
  }

  return 'Risk signals detected in changed lines';
}

export { formatConsoleOutput as formatOutput };
