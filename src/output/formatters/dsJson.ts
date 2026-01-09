import { EvaluationResult, RuleResult } from '../../policy/engine';
import { OutputContext } from './dsConsole';
import { selectTopN, TopNResult } from '../../core/topN';

export interface JsonOutputConfig {
  showAll?: boolean;
  topN?: number;
  pretty?: boolean;
}

export interface JsonOutput {
  tool: string;
  version: string;
  timestamp: string;
  context: {
    scope: string;
    base: string;
    branch: string | null;
    profile: string;
  };
  summary: {
    status: 'PASS' | 'WARN' | 'FAIL';
    changedFiles: number;
    analyzedFiles: number;
    blockers: number;
    warnings: number;
    infos: number;
    highestRisk: number;
    confidence: number;
    exitCode: number;
    isLimited: boolean;
    totalIssues: number;
    shownIssues: number;
  };
  issues: JsonIssue[];
}

export interface JsonIssue {
  rank: number;
  severity: 'blocker' | 'warning' | 'info';
  ruleId: string;
  file: {
    path: string;
    riskScore: number;
    blastRadius: number;
  };
  reasons: string[];
  evidence: Array<{
    line?: number;
    message: string;
    severity: string;
    tag?: string;
  }>;
  actions: Array<{
    type: string;
    text: string;
    command?: string;
    reviewers?: string[];
  }>;
}

export function formatJsonOutput(
  result: EvaluationResult,
  context: OutputContext,
  config: JsonOutputConfig = {},
): string {
  const topN = selectTopN(result.blockers, result.warnings, result.infos, {
    showAll: config.showAll || false,
    limit: config.topN || 3,
  });

  const highestRisk = getHighestRisk(topN);
  const confidence = calculateConfidence(topN);

  const issues: JsonIssue[] = [];
  let rank = 1;

  for (const issue of topN.top) {
    issues.push(formatJsonIssue(issue, rank, getSeverity(issue, topN)));
    rank++;
  }

  const status = result.exitCode === 1 ? 'FAIL' : topN.warnings.length > 0 ? 'WARN' : 'PASS';

  const output: JsonOutput = {
    tool: 'diffesense',
    version: '1.0.0',

    timestamp: process.env.DIFFESENSE_DETERMINISTIC
      ? '2026-01-01T00:00:00.000Z'
      : new Date().toISOString(),
    context: {
      scope: context.scope,
      base: context.base,
      branch: context.branch,
      profile: context.profile,
    },
    summary: {
      status,
      changedFiles: context.changedCount,
      analyzedFiles: context.analyzedCount,
      blockers: topN.blockers.length,
      warnings: topN.warnings.length,
      infos: topN.infos.length,
      highestRisk: roundToOneDecimal(highestRisk),
      confidence: roundToTwoDecimals(confidence),
      exitCode: result.exitCode,
      isLimited: topN.isLimited,
      totalIssues: topN.totalCount,
      shownIssues: topN.shownCount,
    },
    issues,
  };

  return config.pretty !== false ? JSON.stringify(output, null, 2) : JSON.stringify(output);
}

function formatJsonIssue(
  issue: RuleResult,
  rank: number,
  severity: 'blocker' | 'warning' | 'info',
): JsonIssue {
  return {
    rank,
    severity,
    ruleId: issue.ruleId,
    file: {
      path: issue.file.path,
      riskScore: roundToOneDecimal(issue.file.riskScore),
      blastRadius: issue.file.blastRadius,
    },
    reasons: issue.file.riskReasons.slice(0, 5),
    evidence: issue.file.evidence.slice(0, 5).map((e) => ({
      line: e.line,
      message: e.message,
      severity: e.severity,
      tag: e.tag,
    })),
    actions: issue.actions.slice(0, 3).map((a) => ({
      type: a.type,
      text: a.text,
      command: 'command' in a ? (a as any).command : undefined,
      reviewers: 'reviewers' in a ? (a as any).reviewers : undefined,
    })),
  };
}

function getSeverity(issue: RuleResult, topN: TopNResult): 'blocker' | 'warning' | 'info' {
  if (topN.blockers.includes(issue)) return 'blocker';
  if (topN.warnings.includes(issue)) return 'warning';
  return 'info';
}

function getHighestRisk(topN: TopNResult): number {
  const allIssues = [...topN.blockers, ...topN.warnings, ...topN.infos];
  if (allIssues.length === 0) return 0;
  return Math.max(...allIssues.map((i) => i.file.riskScore));
}

function calculateConfidence(topN: TopNResult): number {
  const allIssues = [...topN.blockers, ...topN.warnings, ...topN.infos];
  if (allIssues.length === 0) return 0;

  const totalReasons = allIssues.reduce((sum, i) => sum + i.file.riskReasons.length, 0);
  const avgReasons = totalReasons / allIssues.length;

  return Math.min(0.3 + allIssues.length * 0.1 + avgReasons * 0.1, 1.0);
}

function roundToOneDecimal(n: number): number {
  return Math.round(n * 10) / 10;
}

function roundToTwoDecimals(n: number): number {
  return Math.round(n * 100) / 100;
}
