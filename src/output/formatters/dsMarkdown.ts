import { EvaluationResult, RuleResult } from '../../policy/engine';
import { OutputContext } from './dsConsole';
import { selectTopN, TopNResult } from '../../core/topN';
import { Signal } from '../../signals/types';

export interface MarkdownOutputConfig {
  showAll?: boolean;
  topN?: number;
  includeDetails?: boolean;
  showRationale?: boolean;
}

const COMMENT_MARKER = '<!-- diffesense-comment -->';

export function formatMarkdownOutput(
  result: EvaluationResult,
  context: OutputContext,
  config: MarkdownOutputConfig = {},
): string {
  const lines: string[] = [];
  const includeDetails = config.includeDetails !== false;
  const showRationale = config.showRationale !== false;

  // Apply Top N selection
  const topN = selectTopN(result.blockers, result.warnings, result.infos, {
    showAll: config.showAll || false,
    limit: config.topN || 3,
  });

  const highestRisk = getHighestRisk(topN);
  const confidence = calculateConfidence(topN);
  const confidenceLabel = confidence >= 0.7 ? 'High' : confidence >= 0.4 ? 'Medium' : 'Low';

  // Hidden marker for idempotent comment updates
  lines.push(COMMENT_MARKER);

  // Header
  lines.push('## DiffeSense Risk Report');
  lines.push('');

  // Status line with icon
  const statusIcon = result.exitCode === 1 ? '✖' : topN.warnings.length > 0 ? '!' : '✔';
  const statusText = result.exitCode === 1 ? 'FAIL' : topN.warnings.length > 0 ? 'WARN' : 'PASS';
  lines.push(`**Status:** ${statusIcon} ${statusText}`);

  // PR Risk with confidence
  if (topN.totalCount > 0) {
    lines.push(`**PR Risk:** ${highestRisk.toFixed(1)}/10 (${confidenceLabel} Confidence)`);
    lines.push(`**Top risks:** ${topN.shownCount} file${topN.shownCount !== 1 ? 's' : ''}`);
  } else {
    lines.push('**PR Risk:** 0/10');
    lines.push('**Top risks:** None');
  }
  lines.push('');

  // If no issues, show clean message
  if (topN.totalCount === 0) {
    lines.push('All changed files are within acceptable risk levels. ✨');
    lines.push('');
    lines.push('---');
    lines.push(`*${context.changedCount} files analyzed • Profile: ${context.profile}*`);
    return lines.join('\n');
  }

  // Main table (File | Risk | Why | Next action)
  lines.push('| File | Risk | Why | Next action |');
  lines.push('|------|------|-----|-------------|');

  for (const issue of topN.top) {
    const filePath = truncatePath(issue.file.path, 35);
    const risk = issue.file.riskScore.toFixed(1);
    const why = getWhyShort(issue);
    const action = getNextAction(issue);

    lines.push(`| \`${filePath}\` | ${risk} | ${why} | ${action} |`);
  }
  lines.push('');

  // Hidden issues note
  if (topN.isLimited && topN.hiddenCount > 0) {
    lines.push(
      `*+${topN.hiddenCount} more issue(s) not shown. Run \`dsense --show-all\` to see all.*`,
    );
    lines.push('');
  }

  // Top N rationale (why these files were selected)
  if (showRationale && topN.shownCount > 0) {
    const rationale = generateTopNRationale(topN);
    if (rationale) {
      lines.push(`> **Selection criteria:** ${rationale}`);
      lines.push('');
    }
  }

  // Collapsible details section
  if (includeDetails && topN.top.length > 0) {
    lines.push('<details>');
    lines.push('<summary>📋 Details</summary>');
    lines.push('');

    for (const issue of topN.top) {
      lines.push(formatIssueDetails(issue));
      lines.push('');
    }

    lines.push('</details>');
    lines.push('');
  }

  // Footer
  lines.push('---');
  lines.push(
    `*${context.changedCount} files analyzed • Profile: ${context.profile} • Exit: ${result.exitCode}*`,
  );

  return lines.join('\n');
}

/**
 * Generate Top N rationale - explains why these files were selected
 * Per Operating Document Section 6 (P0 - Top N rationale)
 */
function generateTopNRationale(topN: TopNResult): string {
  // Use pre-computed rationale if available
  if (topN.rationale) {
    return topN.rationale;
  }

  // Fallback: generate rationale from data
  const reasons: string[] = [];

  // Check if we have blockers
  if (topN.blockers.length > 0) {
    reasons.push(`${topN.blockers.length} blocker(s)`);
  }

  // Check for critical signals
  const hasCritical = topN.top.some((issue) =>
    issue.file.signals?.some((s: Signal) => s.class === 'critical'),
  );
  if (hasCritical) {
    reasons.push('critical signals detected');
  }

  // Check for high confidence
  const avgConfidence =
    topN.top.reduce((sum, issue) => {
      const breakdown = issue.file.riskBreakdown;
      return sum + (breakdown?.confidence || 0.5);
    }, 0) / (topN.top.length || 1);

  if (avgConfidence >= 0.7) {
    reasons.push('high confidence');
  }

  // Check for blast radius
  const hasHighBlast = topN.top.some((issue) => issue.file.blastRadius >= 5);
  if (hasHighBlast) {
    reasons.push('high blast radius');
  }

  // Sorted by risk
  reasons.push('sorted by risk score');

  return reasons.join(' + ');
}

function getWhyShort(issue: RuleResult): string {
  // Use risk breakdown to determine primary class
  const breakdown = issue.file.riskBreakdown;
  if (breakdown) {
    if (breakdown.critical > 0) {
      return 'Critical';
    } else if (breakdown.behavioral > 0) {
      return 'Behavioral';
    } else if (breakdown.maintainability > 0) {
      return 'Style';
    }
  }

  // Fallback: check signals directly
  if (issue.file.signals && issue.file.signals.length > 0) {
    const topSignal = issue.file.signals.sort((a: Signal, b: Signal) => b.weight - a.weight)[0];
    if (topSignal) {
      const signalClass = topSignal.class;
      if (signalClass === 'critical') return 'Critical';
      if (signalClass === 'behavioral') return 'Behavioral';
      if (signalClass === 'maintainability') return 'Style';

      // Extract key term from signal ID
      const id = topSignal.id;
      if (id.includes('auth')) return 'Auth';
      if (id.includes('payment')) return 'Payment';
      if (id.includes('security')) return 'Security';
      if (id.includes('effect')) return 'Effect';
      if (id.includes('async')) return 'Async';
      if (id.includes('database')) return 'Database';
      if (id.includes('network')) return 'Network';
      if (id.includes('error')) return 'Error';

      return topSignal.title || id;
    }
  }

  // Fallback to risk reasons
  if (issue.file.riskReasons.length > 0) {
    const firstReason = issue.file.riskReasons[0];
    if (firstReason.includes('Critical')) return 'Critical';
    if (firstReason.includes('Behavioral')) return 'Behavioral';
    if (firstReason.includes('Style')) return 'Style';
    return firstReason.split(':')[0];
  }

  return 'Multiple signals';
}

function getNextAction(issue: RuleResult): string {
  if (issue.actions.length === 0) {
    return 'Review changes';
  }

  const action = issue.actions[0];

  if ('command' in action && action.command) {
    return `Run: \`${truncateCommand(action.command, 30)}\``;
  }

  if ('reviewers' in action && action.reviewers && Array.isArray(action.reviewers)) {
    return `Review: ${action.reviewers.slice(0, 2).join(', ')}`;
  }

  if ('url' in action && action.url) {
    return `[Docs](${action.url})`;
  }

  return action.text || 'Review changes';
}

function formatIssueDetails(issue: RuleResult): string {
  const lines: string[] = [];

  lines.push(`### \`${issue.file.path}\``);

  // Top signal
  if (issue.file.signals && issue.file.signals.length > 0) {
    const topSignal = issue.file.signals.sort((a: Signal, b: Signal) => b.weight - a.weight)[0];
    const severityLabel =
      topSignal.severity === 'blocker' ? 'High' : topSignal.severity === 'warn' ? 'Medium' : 'Low';
    lines.push(`- **Signal:** ${topSignal.id} (${severityLabel})`);
  }

  // Evidence (changed lines)
  if (issue.file.changedLines && issue.file.changedLines > 0) {
    lines.push(`- **Evidence:** ${issue.file.changedLines} lines changed`);
  }

  // Reason chain
  if (issue.file.riskReasons.length > 0) {
    lines.push(`- **Reason:** ${issue.file.riskReasons.slice(0, 2).join('; ')}`);
  }

  // Blast radius
  if (issue.file.blastRadius > 0) {
    lines.push(`- **Blast radius:** ${issue.file.blastRadius} dependent files`);
  }

  // Action
  if (issue.actions.length > 0) {
    const action = issue.actions[0];
    if ('command' in action && action.command) {
      lines.push(`- **Action:** \`${action.command}\``);
    } else if ('reviewers' in action && action.reviewers) {
      lines.push(`- **Action:** Request review from ${(action.reviewers as string[]).join(', ')}`);
    } else {
      lines.push(`- **Action:** ${action.text}`);
    }
  }

  return lines.join('\n');
}

function truncatePath(path: string, maxLen: number): string {
  if (path.length <= maxLen) return path;

  // Keep filename, truncate directory
  const parts = path.split('/');
  const filename = parts.pop() || '';

  if (filename.length >= maxLen - 3) {
    return '...' + filename.slice(-(maxLen - 3));
  }

  let result = filename;
  for (let i = parts.length - 1; i >= 0; i--) {
    const candidate = parts[i] + '/' + result;
    if (candidate.length + 3 > maxLen) {
      return '.../' + result;
    }
    result = candidate;
  }

  return result;
}

function truncateCommand(cmd: string, maxLen: number): string {
  if (cmd.length <= maxLen) return cmd;
  return cmd.slice(0, maxLen - 3) + '...';
}

function getHighestRisk(topN: TopNResult): number {
  const allIssues = [...topN.blockers, ...topN.warnings, ...topN.infos];
  if (allIssues.length === 0) return 0;
  return Math.max(...allIssues.map((i) => i.file.riskScore));
}

function calculateConfidence(topN: TopNResult): number {
  const allIssues = [...topN.blockers, ...topN.warnings, ...topN.infos];
  if (allIssues.length === 0) return 0;

  // Use breakdown confidence if available, otherwise calculate
  let totalConfidence = 0;
  let hasBreakdown = false;

  for (const issue of allIssues) {
    if (issue.file.riskBreakdown?.confidence) {
      totalConfidence += issue.file.riskBreakdown.confidence;
      hasBreakdown = true;
    }
  }

  if (hasBreakdown) {
    return totalConfidence / allIssues.length;
  }

  // Fallback: more reasons = higher confidence
  const totalReasons = allIssues.reduce((sum, i) => sum + i.file.riskReasons.length, 0);
  const avgReasons = totalReasons / allIssues.length;

  return Math.min(0.3 + allIssues.length * 0.1 + avgReasons * 0.1, 1.0);
}

/**
 * Format compact PR comment (for GitHub Actions summary)
 */
export function formatCompactMarkdown(result: EvaluationResult, context: OutputContext): string {
  const topN = selectTopN(result.blockers, result.warnings, result.infos, {
    showAll: false,
    limit: 3,
  });

  const statusEmoji = result.exitCode === 1 ? '❌' : topN.warnings.length > 0 ? '⚠️' : '✅';
  const highestRisk = getHighestRisk(topN);

  if (topN.totalCount === 0) {
    return `${statusEmoji} DiffeSense: All clear (${context.changedCount} files)`;
  }

  const topFiles = topN.top
    .slice(0, 3)
    .map((i) => `\`${i.file.path.split('/').pop()}\``)
    .join(', ');

  return `${statusEmoji} DiffeSense: Risk ${highestRisk.toFixed(1)}/10 — ${topFiles}`;
}
