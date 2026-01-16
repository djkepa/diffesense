import { AnalysisResult } from '../../core/analyze';
import { sortFilesBySeverity } from '../../core/severity';
import { VERSION } from '../../version';
import { formatReasonDefault, formatReasonDetailed, parseRiskReason } from '../signalDescriptions';

const MARKER = '<!-- diffesense-report -->';

/**
 * Format analysis result as Markdown for PR comments
 */
export function formatMarkdownOutput(
  result: AnalysisResult,
  config: { topN?: number; showAll?: boolean } = {},
): string {
  const lines: string[] = [];

  lines.push(MARKER);
  lines.push('');
  lines.push(`# 🔍 DiffeSense ${VERSION}`);
  lines.push('');

  const exitIcon = result.exitCode === 0 ? '✅' : result.exitCode === 1 ? '❌' : '⛔';
  const exitLabel = result.exitCode === 0 ? 'PASS' : result.exitCode === 1 ? 'FAIL' : 'ERROR';
  const statusStyle = result.exitCode === 0 ? '' : '**';

  lines.push(
    `> ${exitIcon} ${statusStyle}${exitLabel}${statusStyle} — ${getStatusMessage(result)}`,
  );
  lines.push('');

  lines.push('### 📊 Summary');
  lines.push('');
  lines.push(`| 📁 Files | ⚠️ Risk | 🚫 Blockers |`);
  lines.push(`|:--------:|:-------:|:-----------:|`);
  lines.push(
    `| ${result.summary.analyzedCount}/${
      result.summary.changedCount
    } | **${result.summary.highestRisk.toFixed(1)}/10** | ${
      result.summary.blockerCount > 0 ? `**${result.summary.blockerCount}**` : '0'
    } |`,
  );
  lines.push('');

  if (result.files.length > 0) {
    const topN = config.topN || 5;
    const sorted = sortFilesBySeverity(result.files);
    const topFiles = config.showAll ? sorted : sorted.slice(0, topN);

    lines.push(`### 🔥 Risky Files (Top ${topFiles.length})`);
    lines.push('');

    for (const file of topFiles) {
      const sev = formatSeverityBadge(file.severity);
      const risk = file.riskScore.toFixed(1);
      const blast = file.blastRadius > 0 ? ` ⚡${file.blastRadius}` : '';

      lines.push(`${sev} **${risk}/10**${blast}`);
      lines.push(`\`${file.path}\``);

      if (file.riskReasons.length > 0) {
        for (const reason of file.riskReasons) {
          const icon = getReasonIcon(reason);
          const humanReadable = formatReasonDefault(reason);
          lines.push(`> ${icon} ${humanReadable}`);
        }
      }
      lines.push('');
    }

    if (!config.showAll && sorted.length > topN) {
      const hiddenCount = sorted.length - topN;
      lines.push(`<details>`);
      lines.push(`<summary>📁 ${hiddenCount} more file(s) — click to expand</summary>`);
      lines.push('');

      for (const file of sorted.slice(topN)) {
        const sev = formatSeverityBadge(file.severity);
        const risk = file.riskScore.toFixed(1);
        lines.push(`- ${sev} **${risk}/10** — \`${file.path}\``);
      }

      lines.push('');
      lines.push('</details>');
      lines.push('');
    }

    const criticalFiles = sorted.filter((f) => f.severity === 'CRITICAL');
    const highFiles = sorted.filter((f) => f.severity === 'HIGH');

    if (criticalFiles.length > 0 || highFiles.length > 0) {
      lines.push('---');
      lines.push('');
      lines.push('### 🚨 Action Required');
      lines.push('');

      if (criticalFiles.length > 0) {
        lines.push(`#### 🔴 CRITICAL (${criticalFiles.length})`);
        lines.push('');
        lines.push('> ⛔ **Must fix before merge**');
        lines.push('');
        for (const file of criticalFiles) {
          lines.push(`**\`${file.path}\`**`);

          for (const reason of file.riskReasons) {
            const detailed = formatReasonDetailed(reason);
            for (const line of detailed) {
              lines.push(`- ${line}`);
            }
          }
          lines.push('');
        }
      }

      if (highFiles.length > 0) {
        lines.push(`#### 🟡 HIGH (${highFiles.length})`);
        lines.push('');
        lines.push('> ⚠️ **Needs careful review**');
        lines.push('');
        for (const file of highFiles.slice(0, 5)) {
          lines.push(`**\`${file.path}\`**`);

          for (const reason of file.riskReasons) {
            const detailed = formatReasonDetailed(reason);
            for (const line of detailed) {
              lines.push(`- ${line}`);
            }
          }
          lines.push('');
        }
        if (highFiles.length > 5) {
          lines.push(`_... and ${highFiles.length - 5} more high-risk files_`);
          lines.push('');
        }
      }

      lines.push('#### ✅ Next Steps');
      lines.push('');
      lines.push('1. Review files marked CRITICAL and HIGH');
      lines.push('2. Run `npm test` locally');
      lines.push('3. Add tests for critical paths');
      lines.push('4. Consider splitting large PRs');
      lines.push('');
    }
  } else {
    lines.push('### ✅ No Risky Changes');
    lines.push('');
    lines.push('All analyzed files passed risk checks. Good to go!');
    lines.push('');
  }

  if (result.ignoredFiles.length > 0) {
    lines.push('<details>');
    lines.push(`<summary>📁 Ignored Files (${result.ignoredFiles.length})</summary>`);
    lines.push('');
    const preview = result.ignoredFiles.slice(0, 10);
    for (const file of preview) {
      lines.push(`- \`${file.path}\` — ${file.reason}`);
    }
    if (result.ignoredFiles.length > 10) {
      lines.push(`- ... and ${result.ignoredFiles.length - 10} more`);
    }
    lines.push('');
    lines.push('</details>');
    lines.push('');
  }

  if (result.warnings.length > 0) {
    lines.push('<details>');
    lines.push(`<summary>⚠️ Warnings (${result.warnings.length})</summary>`);
    lines.push('');
    for (const warn of result.warnings) {
      lines.push(`- **${warn.code}:** ${warn.message}`);
    }
    lines.push('');
    lines.push('</details>');
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push(
    `<sub>Profile: ${result.meta.profile} | Detector: ${result.meta.detector} | Scope: ${result.meta.scope} (${result.meta.base}...HEAD)</sub>`,
  );
  lines.push('');

  return lines.join('\n');
}

function formatSeverityBadge(severity: string): string {
  switch (severity) {
    case 'CRITICAL':
      return '🔴 CRITICAL';
    case 'HIGH':
      return '🟡 HIGH';
    case 'MED':
      return '🔵 MED';
    case 'LOW':
      return '⚪ LOW';
    default:
      return severity;
  }
}

function getReasonIcon(reason: string): string {
  const lower = reason.toLowerCase();
  if (
    lower.includes('critical') ||
    lower.includes('security') ||
    lower.includes('auth') ||
    lower.includes('process')
  ) {
    return '🔴';
  }
  if (
    lower.includes('behavioral') ||
    lower.includes('async') ||
    lower.includes('network') ||
    lower.includes('fs-')
  ) {
    return '🟡';
  }
  if (lower.includes('style') || lower.includes('maint')) {
    return '🔵';
  }
  return '•';
}

function getStatusMessage(result: AnalysisResult): string {
  if (result.exitCode === 0) {
    return 'No blocking issues found';
  } else if (result.exitCode === 1) {
    return `${result.summary.blockerCount} blocking issue(s) require attention`;
  }
  return 'Analysis encountered errors';
}
