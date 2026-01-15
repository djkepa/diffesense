import chalk from 'chalk';
import * as path from 'path';
import { AnalysisResult } from '../../core/analyze';
import { getRiskSeverity, getSeverityColor, sortFilesBySeverity } from '../../core/severity';
import { VERSION } from '../../version';
import {
  parseRiskReason,
  formatReasonDefault,
  formatReasonDetailed,
  getSignalDescription,
} from '../signalDescriptions';

export interface OutputContext {
  scope: string;
  base: string;
  branch: string | null;
  profile: string;
  changedCount: number;
  analyzedCount: number;
  isDiffAnalysis?: boolean;
}

export interface ConsoleOutputConfig {
  showAll?: boolean;
  topN?: number;
  details?: boolean;
  quiet?: boolean;
}

export function formatConsoleOutput(
  result: AnalysisResult,
  config: ConsoleOutputConfig = {},
): string {
  if (config.quiet) {
    return formatQuietOutput(result);
  }

  if (config.details) {
    return formatDetailedOutput(result, config);
  }

  return formatDefaultOutput(result, config);
}

function formatQuietOutput(result: AnalysisResult): string {
  const status = result.exitCode === 0 ? 'PASS' : result.exitCode === 1 ? 'FAIL' : 'ERROR';
  return `DiffeSense ${VERSION} | ${status} | risk=${result.summary.highestRisk.toFixed(
    1,
  )} | files=${result.summary.analyzedCount} | blockers=${result.summary.blockerCount}`;
}

function formatDefaultOutput(result: AnalysisResult, config: ConsoleOutputConfig): string {
  const lines: string[] = [];
  const cwd = result.meta.cwd;

  lines.push('');
  lines.push(chalk.bold.cyan(`DiffeSense ${VERSION}`));
  lines.push('');

  if (result.exitCode === 0) {
    lines.push(chalk.bgGreen.black.bold(' PASS ') + chalk.green(' No blocking issues found'));
  } else if (result.exitCode === 1) {
    lines.push(
      chalk.bgRed.white.bold(' FAIL ') +
        chalk.red(` ${result.summary.blockerCount} blocking issue(s) detected`),
    );
  } else {
    lines.push(chalk.bgYellow.black.bold(' ERROR ') + chalk.yellow(' Analysis encountered errors'));
  }
  lines.push('');

  if (result.files.length > 0) {
    const topN = config.topN || 3;
    const sorted = sortFilesBySeverity(result.files);
    const topFiles = config.showAll ? sorted : sorted.slice(0, topN);

    for (const file of topFiles) {
      const absolutePath = path.isAbsolute(file.path) ? file.path : path.join(cwd, file.path);
      const clickablePath = absolutePath.replace(/\\/g, '/');

      const sevBadge = formatSeverityBadge(file.severity);
      const riskScore = formatRiskScore(file.riskScore);

      lines.push(`${sevBadge} ${riskScore}`);

      lines.push(chalk.cyan.underline(clickablePath));

      if (file.riskReasons.length > 0) {
        for (const reason of file.riskReasons) {
          const { icon, color } = getReasonStyle(reason);
          const humanReadable = formatReasonDefault(reason);
          lines.push(color(`  ${icon} ${humanReadable}`));
        }
      }

      if (file.blastRadius > 0) {
        lines.push(chalk.yellow(`  ⚡ Blast radius: ${file.blastRadius} dependent(s)`));
      }

      lines.push('');
    }

    if (!config.showAll && sorted.length > topN) {
      const hiddenCount = sorted.length - topN;
      lines.push(chalk.dim(`  ... ${hiddenCount} more file(s) not shown`));
      lines.push(chalk.dim(`  Run with ${chalk.cyan('--show-all')} to see all files`));
      lines.push('');
    }
  }

  lines.push(formatSummaryBox(result));
  lines.push('');

  if (result.summary.blockerCount > 0 || result.summary.highestRisk >= 7.0) {
    lines.push(chalk.yellow.bold('→ What to do:'));
    lines.push(chalk.white('  1. Review the high-risk files listed above'));
    lines.push(
      chalk.white('  2. Run ') +
        chalk.cyan('dsense --details') +
        chalk.white(' for full breakdown'),
    );
    lines.push(
      chalk.white('  3. Run ') + chalk.cyan('npm test') + chalk.white(' before committing'),
    );
    lines.push('');
  }

  if (result.ignoredFiles.length > 0) {
    lines.push(
      chalk.dim(
        `${result.ignoredFiles.length} file(s) ignored — run with ${chalk.cyan(
          '--explain-ignore',
        )} to see why`,
      ),
    );
    lines.push('');
  }

  return lines.join('\n');
}

function formatDetailedOutput(result: AnalysisResult, config: ConsoleOutputConfig): string {
  const lines: string[] = [];
  const cwd = result.meta.cwd;

  lines.push('');
  lines.push(chalk.bold.cyan(`DiffeSense ${VERSION}`) + chalk.gray(' — Detailed Analysis'));
  lines.push(chalk.gray('═'.repeat(60)));
  lines.push('');

  const sorted = sortFilesBySeverity(result.files);
  const topN = config.topN || 3;
  const topFiles = config.showAll ? sorted : sorted.slice(0, topN);

  for (const file of topFiles) {
    const absolutePath = path.isAbsolute(file.path) ? file.path : path.join(cwd, file.path);
    const clickablePath = absolutePath.replace(/\\/g, '/');

    const sevBadge = formatSeverityBadge(file.severity);
    lines.push(`${sevBadge} ${chalk.bold.white(file.path)}`);
    lines.push(chalk.cyan.underline(clickablePath));
    lines.push('');

    lines.push(chalk.gray('  ┌─ Risk Score:    ') + formatRiskScore(file.riskScore));
    lines.push(
      chalk.gray('  └─ Blast Radius:  ') +
        (file.blastRadius > 0
          ? chalk.yellow(`${file.blastRadius} dependents`)
          : chalk.dim('isolated')),
    );
    lines.push('');

    if (file.evidence.length > 0) {
      lines.push(chalk.bold.white('  Signals Detected:'));
      for (const ev of file.evidence) {
        const sevIcon =
          ev.severity === 'error'
            ? chalk.red('✖')
            : ev.severity === 'warning'
            ? chalk.yellow('⚠')
            : chalk.blue('ℹ');
        const lineNum = ev.line ? chalk.gray(` :${ev.line}`) : '';
        lines.push(`    ${sevIcon} ${ev.message}${lineNum}`);
      }
      lines.push('');
    }

    if (file.riskReasons.length > 0) {
      lines.push(chalk.bold.white('  Risk Breakdown:'));
      for (const reason of file.riskReasons) {
        const { color } = getReasonStyle(reason);

        const detailed = formatReasonDetailed(reason);
        for (const line of detailed) {
          lines.push(color(`    → ${line}`));
        }
      }
      lines.push('');
    }

    lines.push(chalk.gray('─'.repeat(60)));
    lines.push('');
  }

  if (result.evaluation) {
    lines.push(chalk.bold.white('Policy Evaluation'));
    lines.push(chalk.gray('─'.repeat(30)));
    const outcomeColor = result.exitCode === 0 ? chalk.green : chalk.red;
    lines.push(`  Outcome:   ${outcomeColor.bold(result.exitCode === 0 ? 'PASS' : 'FAIL')}`);
    lines.push(
      `  Blockers:  ${
        result.evaluation.blockers.length > 0
          ? chalk.red.bold(result.evaluation.blockers.length)
          : chalk.green('0')
      }`,
    );
    lines.push(`  Warnings:  ${chalk.yellow(result.evaluation.warnings.length)}`);
    lines.push('');
  }

  return lines.join('\n');
}

function formatSeverityBadge(severity: string): string {
  switch (severity) {
    case 'CRITICAL':
      return chalk.bgRed.white.bold(' CRITICAL ');
    case 'HIGH':
      return chalk.bgYellow.black.bold(' HIGH ');
    case 'MED':
      return chalk.bgCyan.black.bold(' MED ');
    case 'LOW':
      return chalk.bgGray.white(' LOW ');
    default:
      return chalk.bgGray.white(` ${severity} `);
  }
}

function formatRiskScore(score: number): string {
  const scoreStr = score.toFixed(1);
  if (score >= 8.0) return chalk.red.bold(`${scoreStr}/10`);
  if (score >= 6.0) return chalk.yellow.bold(`${scoreStr}/10`);
  if (score >= 4.0) return chalk.cyan(`${scoreStr}/10`);
  return chalk.green(`${scoreStr}/10`);
}

function formatSummaryBox(result: AnalysisResult): string {
  const lines: string[] = [];
  const sep = chalk.gray('  •  ');

  const filesStr =
    chalk.white('Files: ') +
    chalk.bold(`${result.summary.analyzedCount}/${result.summary.changedCount}`);
  const riskStr = chalk.white('Risk: ') + formatRiskScore(result.summary.highestRisk);
  const blockersStr =
    chalk.white('Blockers: ') +
    (result.summary.blockerCount > 0
      ? chalk.red.bold(result.summary.blockerCount)
      : chalk.green('0'));

  lines.push(chalk.gray('─'.repeat(60)));
  lines.push(`${filesStr}${sep}${riskStr}${sep}${blockersStr}`);
  lines.push(chalk.gray('─'.repeat(60)));

  return lines.join('\n');
}

function getReasonStyle(reason: string): { icon: string; color: (s: string) => string } {
  const lower = reason.toLowerCase();

  if (
    lower.includes('critical') ||
    lower.includes('security') ||
    lower.includes('auth') ||
    lower.includes('process-child') ||
    lower.includes('process-env')
  ) {
    return { icon: '→', color: chalk.red };
  }

  if (
    lower.includes('behavioral') ||
    lower.includes('async') ||
    lower.includes('network') ||
    lower.includes('fs-') ||
    lower.includes('node-sync') ||
    lower.includes('event-handler')
  ) {
    return { icon: '→', color: chalk.yellow };
  }

  if (
    lower.includes('style') ||
    lower.includes('maint') ||
    lower.includes('logging') ||
    lower.includes('long-') ||
    lower.includes('deep-')
  ) {
    return { icon: '→', color: chalk.cyan };
  }

  return { icon: '→', color: chalk.gray };
}
