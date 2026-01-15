import { AnalysisResult } from '../../core/analyze';
import { sortFilesBySeverity } from '../../core/severity';
import { VERSION, SCHEMA_VERSION } from '../../version';
import { getSignalDescription, parseRiskReason } from '../signalDescriptions';

export interface JsonOutput {
  schemaVersion: string;
  toolVersion: string;
  success: boolean;
  exitCode: 0 | 1 | 2;
  status: 'PASS' | 'FAIL' | 'ERROR';
  meta: {
    cwd: string;
    repo: string;
    scope: string;
    base: string;
    range: string;
    profile: string;
    detector: string;
    config: {
      source: string;
      path?: string;
    };
    branch: string | null;
    timestamp: string;
  };
  summary: {
    changedCount: number;
    analyzedCount: number;
    ignoredCount: number;
    warningCount: number;
    highestRisk: number;
    blockerCount: number;
    topN: number;
  };
  files: JsonIssue[];
  ignoredFiles: Array<{ path: string; reason: string }>;
  warnings: Array<{ code: string; message: string; path?: string }>;
  evaluation: {
    outcome: 'PASS' | 'FAIL';
    blockers: Array<{ ruleId: string; message: string; file: string }>;
    warnings: Array<{ ruleId: string; message: string; file: string }>;
  } | null;
}

export interface JsonSignal {
  id: string;
  category: 'security' | 'behavioral' | 'style';
  title: string;
  summary: string;
  impact: string;
  recommendation: string;
}

export interface JsonIssue {
  path: string;
  riskScore: number;
  severity: 'LOW' | 'MED' | 'HIGH' | 'CRITICAL';
  blastRadius: number;
  signalTypes: string[];
  reasons: string[];
  /** Enriched signal descriptions for enterprise integrations */
  signals: JsonSignal[];
  evidence: Array<{
    signal?: string;
    line?: number;
    message: string;
    severity: 'error' | 'warning' | 'info';
  }>;
}

/**
 * Format analysis result as JSON for CI/CD parsers
 */
export function formatJsonOutput(
  result: AnalysisResult,
  config: { topN?: number; showAll?: boolean } = {},
): string {
  const topN = config.topN || 3;
  const sorted = sortFilesBySeverity(result.files);
  const topFiles = config.showAll ? sorted : sorted.slice(0, topN);

  const repoName = result.meta.cwd.split(/[/\\]/).pop() || 'unknown';
  const range = result.meta.isDiffAnalysis ? `${result.meta.base}...HEAD` : 'full';

  const status: 'PASS' | 'FAIL' | 'ERROR' =
    result.exitCode === 0 ? 'PASS' : result.exitCode === 1 ? 'FAIL' : 'ERROR';

  const output: JsonOutput = {
    schemaVersion: SCHEMA_VERSION,
    toolVersion: VERSION,
    success: result.success,
    exitCode: result.exitCode,
    status,
    meta: {
      cwd: result.meta.cwd,
      repo: repoName,
      scope: result.meta.scope,
      base: result.meta.base,
      range,
      profile: result.meta.profile,
      detector: result.meta.detector,
      config: {
        source: result.meta.configSource,
      },
      branch: result.meta.branch,
      timestamp: result.meta.timestamp,
    },
    summary: {
      changedCount: result.summary.changedCount,
      analyzedCount: result.summary.analyzedCount,
      ignoredCount: result.summary.ignoredCount,
      warningCount: result.summary.warningCount,
      highestRisk: parseFloat(result.summary.highestRisk.toFixed(1)),
      blockerCount: result.summary.blockerCount,
      topN: topFiles.length,
    },
    files: topFiles.map((file) => {
      // Extract signal IDs from reasons and enrich with descriptions
      const signalIds = extractSignalIds(file.riskReasons);
      const enrichedSignals: JsonSignal[] = signalIds.map((id) => {
        const desc = getSignalDescription(id);
        return {
          id,
          category: desc.category,
          title: desc.title,
          summary: desc.summary,
          impact: desc.impact,
          recommendation: desc.recommendation,
        };
      });

      return {
        path: file.path,
        riskScore: parseFloat(file.riskScore.toFixed(1)),
        severity: file.severity as any,
        blastRadius: file.blastRadius,
        signalTypes: file.signalTypes,
        reasons: file.riskReasons,
        signals: enrichedSignals,
        evidence: file.evidence.map((ev) => ({
          signal: ev.tag,
          line: ev.line,
          message: ev.message,
          severity: ev.severity,
        })),
      };
    }),
    ignoredFiles: result.ignoredFiles,
    warnings: result.warnings,
    evaluation: result.evaluation
      ? {
          outcome: result.exitCode === 0 ? 'PASS' : 'FAIL',
          blockers: result.evaluation.blockers.map((b) => ({
            ruleId: b.ruleId,
            message: `File riskScore >= threshold`,
            file: b.file.path,
          })),
          warnings: result.evaluation.warnings.map((w) => ({
            ruleId: w.ruleId,
            message: `File riskScore in warning range`,
            file: w.file.path,
          })),
        }
      : null,
  };

  return JSON.stringify(output, null, 2);
}

/**
 * Extract signal IDs from risk reasons
 * Input format: "Category: signal1, signal2 (+score)"
 */
function extractSignalIds(reasons: string[]): string[] {
  const ids: string[] = [];

  for (const reason of reasons) {
    const parsed = parseRiskReason(reason);
    if (parsed) {
      for (const signal of parsed.signals) {
        if (!ids.includes(signal.id)) {
          ids.push(signal.id);
        }
      }
    }
  }

  return ids;
}
