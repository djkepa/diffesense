import chalk from 'chalk';
import * as path from 'path';
import { AnalysisResult } from '../../core/analyze';
import { getRiskSeverity, getSeverityColor, sortFilesBySeverity } from '../../core/severity';
import { VERSION } from '../../version';

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

/**
 * Format analysis result for console output
 */
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
  const parts = [
    `DiffeSense ${VERSION}`,
    `analyzed=${result.summary.analyzedCount}`,
    `ignored=${result.summary.ignoredCount}`,
    `warnings=${result.summary.warningCount}`,
    `highestRisk=${result.summary.highestRisk.toFixed(1)}`,
    `blockers=${result.summary.blockerCount}`,
    `exitCode=${result.exitCode}`,
  ];
  return parts.join('  |  ');
}

function formatDefaultOutput(result: AnalysisResult, config: ConsoleOutputConfig): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(chalk.bold.cyan(`DiffeSense ${VERSION}`) + chalk.gray('  •  risk gate for code changes'));
  
  const repoName = path.basename(result.meta.cwd);
  lines.push(chalk.gray(`Repo: ${repoName}  |  CWD: ${result.meta.cwd}`));
  
  const range = result.meta.isDiffAnalysis 
    ? `${result.meta.base}...HEAD`
    : 'full analysis';
  lines.push(chalk.gray(`Scope: ${result.meta.scope}  |  Base: ${result.meta.base}  |  Range: ${range}`));
  lines.push(chalk.gray(`Profile: ${result.meta.profile}  |  Detector: ${result.meta.detector}`));
  lines.push(chalk.gray(`Config: ${result.meta.configSource}  |  Schema: 1.0.0`));
  lines.push('');

  lines.push(chalk.bold('Summary'));
  lines.push(
    `- Changed: ${result.summary.changedCount} files  |  ` +
    `Analyzed: ${result.summary.analyzedCount}  |  ` +
    `Ignored: ${result.summary.ignoredCount}  |  ` +
    `Warnings: ${result.summary.warningCount}`
  );
  lines.push(
    `- Highest risk: ${chalk.bold(result.summary.highestRisk.toFixed(1))}/10  |  ` +
    `Blockers: ${chalk.bold.red(result.summary.blockerCount)}  |  ` +
    `Exit code: ${result.exitCode === 0 ? chalk.green(result.exitCode) : chalk.red(result.exitCode)}`
  );
  lines.push('');

  if (result.files.length > 0) {
    const topN = config.topN || 3;
    const sorted = sortFilesBySeverity(result.files);
    const topFiles = config.showAll ? sorted : sorted.slice(0, topN);

    lines.push(chalk.bold(`Top ${topFiles.length} risky files`));
    lines.push(formatFileTable(topFiles));
    lines.push('');

    if (!config.showAll && sorted.length > topN) {
      const hiddenCount = sorted.length - topN;
      lines.push(chalk.gray(`... and ${hiddenCount} more (use --show-all to see all)`));
      lines.push('');
    }

    if (result.summary.blockerCount > 0) {
      lines.push(chalk.bold.yellow('What to do next'));
      const firstBlocker = topFiles.find(f => getRiskSeverity(f.riskScore) === 'CRITICAL' || f.riskScore >= 8.0);
      if (firstBlocker) {
        const fileName = path.basename(firstBlocker.path);
        lines.push(`- Review the ${chalk.bold(getRiskSeverity(firstBlocker.riskScore))} file first (${fileName})`);
        lines.push(`- Run tests or add rollback-safe guards`);
      }
      lines.push(chalk.gray('- Use --details for full evidence and policy evaluation'));
      lines.push('');
    }
  }

  if (result.ignoredFiles.length > 0) {
    lines.push(chalk.bold(`Ignored files (${result.ignoredFiles.length})`) + chalk.gray('  [use --explain-ignore for details]'));
    const preview = result.ignoredFiles.slice(0, 4);
    for (const file of preview) {
      lines.push(chalk.gray(`- ${file.path} (${file.reason})`));
    }
    if (result.ignoredFiles.length > 4) {
      lines.push(chalk.gray(`... and ${result.ignoredFiles.length - 4} more`));
    }
    lines.push('');
  }

  if (result.warnings.length > 0) {
    lines.push(chalk.yellow(`⚠ Warnings (${result.warnings.length})`));
    for (const warn of result.warnings) {
      lines.push(chalk.yellow(`  ${warn.message}`));
    }
    lines.push('');
  }

  lines.push(chalk.gray('Tip: use --format markdown for PR comments or --format json for CI parsers.'));
  lines.push('');

  return lines.join('\n');
}

function formatDetailedOutput(result: AnalysisResult, config: ConsoleOutputConfig): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(chalk.bold.cyan(`DiffeSense ${VERSION}`) + chalk.gray(' — DETAILED ANALYSIS'));
  lines.push('');

  const sorted = sortFilesBySeverity(result.files);
  const topN = config.topN || 3;
  const topFiles = config.showAll ? sorted : sorted.slice(0, topN);

  for (const file of topFiles) {
    lines.push(chalk.bold(`Details: ${file.path}`));
    lines.push(`- Risk: ${chalk.bold(file.riskScore.toFixed(1))} (${formatSeverityLabel(file.severity)})  |  Blast radius: ${file.blastRadius}`);
    
    if (file.evidence.length > 0) {
      lines.push('- Signals:');
      for (const ev of file.evidence) {
        const icon = ev.severity === 'error' ? '✗' : ev.severity === 'warning' ? '⚠' : '•';
        const lineInfo = ev.line ? ` (line ${ev.line})` : '';
        lines.push(`  ${icon} ${ev.message}${lineInfo}`);
      }
    }

    if (file.riskReasons.length > 0) {
      lines.push('- Risk reasons:');
      for (const reason of file.riskReasons.slice(0, 3)) {
        lines.push(`  • ${reason}`);
      }
    }

    lines.push('');
  }

  if (result.evaluation) {
    lines.push(chalk.bold('Policy evaluation'));
    lines.push(`- Outcome: ${result.exitCode === 0 ? chalk.green('PASS') : chalk.red('FAIL')}`);
    lines.push(`- Blockers: ${result.evaluation.blockers.length}`);
    lines.push(`- Warnings: ${result.evaluation.warnings.length}`);
    lines.push(`- Exit code: ${result.exitCode}`);
    lines.push('');
  }

  return lines.join('\n');
}

function formatFileTable(files: Array<{ path: string; riskScore: number; severity: string; blastRadius: number; riskReasons: string[] }>): string {
  const lines: string[] = [];

  const header = `${chalk.bold('Risk')}  ${chalk.bold('Sev')}      ${chalk.bold('Blast')}  ${chalk.bold('File')}                                  ${chalk.bold('Why (top reasons)')}`;
  lines.push(header);

  for (const file of files) {
    const risk = file.riskScore.toFixed(1).padEnd(4);
    const sev = formatSeverityLabel(file.severity).padEnd(8);
    const blast = String(file.blastRadius).padEnd(5);
    const fileName = file.path.length > 40 ? '...' + file.path.slice(-37) : file.path.padEnd(40);
    const reasons = file.riskReasons.slice(0, 3).join('; ');
    const reasonsShort = reasons.length > 60 ? reasons.slice(0, 57) + '...' : reasons;

    const color = getSeverityColor(file.severity as any);
    lines.push(chalk[color](`${risk}  ${sev}  ${blast}  `) + fileName + '  ' + chalk.gray(reasonsShort));
  }

  return lines.join('\n');
}

function formatSeverityLabel(severity: string): string {
  switch (severity) {
    case 'CRITICAL':
      return chalk.red.bold('CRITICAL');
    case 'HIGH':
      return chalk.yellow.bold('HIGH');
    case 'MED':
      return chalk.cyan('MED');
    case 'LOW':
      return chalk.gray('LOW');
    default:
      return severity;
  }
}
