import { AnalysisResult } from '../../core/analyze';
import { sortFilesBySeverity } from '../../core/severity';
import { VERSION } from '../../version';

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
  lines.push(`# 🔍 DiffeSense ${VERSION} — Risk Analysis`);
  lines.push('');

  const exitIcon = result.exitCode === 0 ? '✅' : result.exitCode === 1 ? '❌' : '⛔';
  const exitLabel = result.exitCode === 0 ? 'PASS' : result.exitCode === 1 ? 'FAIL' : 'ERROR';

  lines.push(`**Status:** ${exitIcon} ${exitLabel} (exit code: ${result.exitCode})`);
  lines.push('');

  lines.push('## 📊 Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Changed files | ${result.summary.changedCount} |`);
  lines.push(`| Analyzed files | ${result.summary.analyzedCount} |`);
  lines.push(`| Ignored files | ${result.summary.ignoredCount} |`);
  lines.push(`| Highest risk | **${result.summary.highestRisk.toFixed(1)}/10** |`);
  lines.push(
    `| Blockers | ${
      result.summary.blockerCount > 0 ? `**${result.summary.blockerCount}**` : '0'
    } |`,
  );
  lines.push(`| Warnings | ${result.summary.warningCount} |`);
  lines.push('');

  if (result.files.length > 0) {
    const topN = config.topN || 3;
    const sorted = sortFilesBySeverity(result.files);
    const topFiles = config.showAll ? sorted : sorted.slice(0, topN);

    lines.push(`## 🔥 Top ${topFiles.length} Risky Files`);
    lines.push('');
    lines.push('| Risk | Severity | Blast | File | Why |');
    lines.push('|------|----------|-------|------|-----|');

    for (const file of topFiles) {
      const risk = file.riskScore.toFixed(1);
      const sev = formatSeverityBadge(file.severity);
      const blast = file.blastRadius;
      const fileName = `\`${file.path}\``;
      const reasons = file.riskReasons.slice(0, 2).join('; ');

      lines.push(`| ${risk} | ${sev} | ${blast} | ${fileName} | ${reasons} |`);
    }

    lines.push('');

    if (!config.showAll && sorted.length > topN) {
      const hiddenCount = sorted.length - topN;
      lines.push(`<details>`);
      lines.push(`<summary>... and ${hiddenCount} more files (click to expand)</summary>`);
      lines.push('');
      lines.push('| Risk | Severity | File |');
      lines.push('|------|----------|------|');

      for (const file of sorted.slice(topN)) {
        const risk = file.riskScore.toFixed(1);
        const sev = formatSeverityBadge(file.severity);
        lines.push(`| ${risk} | ${sev} | \`${file.path}\` |`);
      }

      lines.push('');
      lines.push('</details>');
      lines.push('');
    }

    if (result.summary.blockerCount > 0) {
      lines.push('## ⚠️ Action Required');
      lines.push('');
      const criticalFiles = topFiles.filter((f) => f.severity === 'CRITICAL' || f.riskScore >= 8.0);
      if (criticalFiles.length > 0) {
        lines.push(`**${criticalFiles.length} file(s)** require immediate attention:`);
        lines.push('');
        for (const file of criticalFiles) {
          lines.push(`- **\`${file.path}\`** (risk: ${file.riskScore.toFixed(1)})`);
          if (file.riskReasons.length > 0) {
            lines.push(`  - ${file.riskReasons.slice(0, 2).join('\n  - ')}`);
          }
        }
        lines.push('');
        lines.push('**Recommended actions:**');
        lines.push('- Review and test these changes thoroughly');
        lines.push('- Add rollback-safe guards if possible');
        lines.push('- Consider splitting into smaller PRs');
        lines.push('');
      }
    }
  } else {
    lines.push('## ✅ No Risky Changes Detected');
    lines.push('');
    lines.push('All analyzed files passed risk checks.');
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
      return '🔴 **CRITICAL**';
    case 'HIGH':
      return '🟡 **HIGH**';
    case 'MED':
      return '🔵 MED';
    case 'LOW':
      return '⚪ LOW';
    default:
      return severity;
  }
}
