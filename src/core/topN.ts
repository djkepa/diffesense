import { RuleResult } from '../policy/engine';

export interface TopNConfig {
  limit: number;
  showAll: boolean;
  minRisk: number;
  groupBySeverity: boolean;
  includeRationale?: boolean;
}

export const DEFAULT_TOP_N_CONFIG: TopNConfig = {
  limit: 5, // Noise budget: MAX 5 by default
  showAll: false,
  minRisk: 0,
  groupBySeverity: true,
  includeRationale: true,
};

export interface SelectionReason {
  primary: string;
  factors: string[];
  rank: number;
}

export interface NextCandidate {
  path: string;
  riskScore: number;
  reason: string;
}

export interface TopNResult {
  top: RuleResult[];
  blockers: RuleResult[];
  warnings: RuleResult[];
  infos: RuleResult[];
  totalCount: number;
  shownCount: number;
  hiddenCount: number;
  isLimited: boolean;
  rationale?: string;
  rationaleDetails?: Map<string, SelectionReason>;
  nextCandidates?: NextCandidate[];
}

export function selectTopN(
  blockers: RuleResult[],
  warnings: RuleResult[],
  infos: RuleResult[],
  config: Partial<TopNConfig> = {},
): TopNResult {
  const cfg = { ...DEFAULT_TOP_N_CONFIG, ...config };

  const filteredBlockers = blockers.filter((r) => r.file.riskScore >= cfg.minRisk);
  const filteredWarnings = warnings.filter((r) => r.file.riskScore >= cfg.minRisk);
  const filteredInfos = infos.filter((r) => r.file.riskScore >= cfg.minRisk);

  const sortByRisk = (a: RuleResult, b: RuleResult): number => {
    const riskDiff = b.file.riskScore - a.file.riskScore;
    if (riskDiff !== 0) return riskDiff;

    const radiusDiff = b.file.blastRadius - a.file.blastRadius;
    if (radiusDiff !== 0) return radiusDiff;

    return a.file.path.localeCompare(b.file.path);
  };

  const sortedBlockers = [...filteredBlockers].sort(sortByRisk);
  const sortedWarnings = [...filteredWarnings].sort(sortByRisk);
  const sortedInfos = [...filteredInfos].sort(sortByRisk);

  const allSorted = [...sortedBlockers, ...sortedWarnings, ...sortedInfos];

  if (cfg.showAll) {
    return {
      top: allSorted,
      blockers: sortedBlockers,
      warnings: sortedWarnings,
      infos: sortedInfos,
      totalCount: allSorted.length,
      shownCount: allSorted.length,
      hiddenCount: 0,
      isLimited: false,
    };
  }

  let remaining = cfg.limit;
  const topBlockers: RuleResult[] = [];
  const topWarnings: RuleResult[] = [];
  const topInfos: RuleResult[] = [];
  const rationale = new Map<string, SelectionReason>();
  let rank = 1;

  if (cfg.groupBySeverity) {
    for (const blocker of sortedBlockers) {
      if (remaining <= 0) break;
      topBlockers.push(blocker);
      rationale.set(blocker.file.path, {
        primary: 'blocker severity',
        factors: generateFactors(blocker, rank),
        rank,
      });
      remaining--;
      rank++;
    }

    for (const warning of sortedWarnings) {
      if (remaining <= 0) break;
      topWarnings.push(warning);
      rationale.set(warning.file.path, {
        primary: 'warning severity',
        factors: generateFactors(warning, rank),
        rank,
      });
      remaining--;
      rank++;
    }

    for (const info of sortedInfos) {
      if (remaining <= 0) break;
      topInfos.push(info);
      rationale.set(info.file.path, {
        primary: 'highest remaining risk',
        factors: generateFactors(info, rank),
        rank,
      });
      remaining--;
      rank++;
    }
  } else {
    const top = allSorted.slice(0, cfg.limit);

    for (const result of top) {
      if (sortedBlockers.includes(result)) topBlockers.push(result);
      else if (sortedWarnings.includes(result)) topWarnings.push(result);
      else topInfos.push(result);

      rationale.set(result.file.path, {
        primary: 'highest risk score',
        factors: generateFactors(result, rank),
        rank,
      });
      rank++;
    }
  }

  const totalCount = allSorted.length;
  const shownCount = topBlockers.length + topWarnings.length + topInfos.length;

  const nextCandidates: NextCandidate[] = [];
  if (cfg.includeRationale && shownCount < totalCount) {
    const hidden = allSorted.slice(shownCount, shownCount + 2);
    for (const h of hidden) {
      const lastShown = allSorted[shownCount - 1];
      const scoreDiff = lastShown ? lastShown.file.riskScore - h.file.riskScore : 0;

      nextCandidates.push({
        path: h.file.path,
        riskScore: h.file.riskScore,
        reason:
          scoreDiff < 0.5
            ? 'very close in score'
            : scoreDiff < 1.0
            ? 'close in score'
            : 'lower risk score',
      });
    }
  }

  const rationaleString = generateRationaleString(
    [...topBlockers, ...topWarnings, ...topInfos],
    rationale,
    nextCandidates,
  );

  return {
    top: [...topBlockers, ...topWarnings, ...topInfos],
    blockers: topBlockers,
    warnings: topWarnings,
    infos: topInfos,
    totalCount,
    shownCount,
    hiddenCount: totalCount - shownCount,
    isLimited: shownCount < totalCount,
    rationale: cfg.includeRationale ? rationaleString : undefined,
    rationaleDetails: cfg.includeRationale ? rationale : undefined,
    nextCandidates: cfg.includeRationale && nextCandidates.length > 0 ? nextCandidates : undefined,
  };
}

function generateRationaleString(
  top: RuleResult[],
  rationaleMap: Map<string, SelectionReason>,
  nextCandidates: NextCandidate[],
): string {
  if (top.length === 0) {
    return 'No issues to rank';
  }

  const parts: string[] = [];

  const hasBlockers = top.some(
    (r) => rationaleMap.get(r.file.path)?.primary === 'blocker severity',
  );
  const hasWarnings = top.some(
    (r) => rationaleMap.get(r.file.path)?.primary === 'warning severity',
  );

  if (hasBlockers || hasWarnings) {
    parts.push('sorted by severity (blockers first), then by risk score');
  } else {
    parts.push('sorted by risk score');
  }

  const highestRisk = Math.max(...top.map((r) => r.file.riskScore));
  if (highestRisk > 0) {
    parts.push(`highest risk: ${highestRisk.toFixed(1)}/10`);
  }

  const hasBlockerSignals = top.some(
    (r) => r.file.riskBreakdown?.critical && r.file.riskBreakdown.critical > 0,
  );
  const hasBehavioralSignals = top.some(
    (r) => r.file.riskBreakdown?.behavioral && r.file.riskBreakdown.behavioral > 0,
  );

  if (hasBlockerSignals) {
    parts.push('includes critical boundary signals');
  } else if (hasBehavioralSignals) {
    parts.push('includes behavioral change signals');
  }

  if (nextCandidates.length > 0) {
    const closeOnes = nextCandidates.filter((c) => c.reason.includes('close'));
    if (closeOnes.length > 0) {
      parts.push(`${closeOnes.length} more file(s) with similar risk scores`);
    }
  }

  return parts.join('; ');
}

function generateFactors(result: RuleResult, rank: number): string[] {
  const factors: string[] = [];

  factors.push(`risk ${result.file.riskScore.toFixed(1)}/10`);

  if (result.file.blastRadius > 0) {
    factors.push(`${result.file.blastRadius} dependents`);
  }

  if (result.file.riskBreakdown) {
    if (result.file.riskBreakdown.critical > 0) {
      factors.push('critical signals');
    } else if (result.file.riskBreakdown.behavioral > 0) {
      factors.push('behavioral signals');
    }
  }

  if (result.file.riskBreakdown?.confidence && result.file.riskBreakdown.confidence >= 0.7) {
    factors.push('high confidence');
  }

  return factors;
}

export function formatHiddenMessage(result: TopNResult): string | null {
  if (!result.isLimited || result.hiddenCount === 0) {
    return null;
  }

  let msg = `${result.hiddenCount} more issue(s) hidden.`;

  if (result.nextCandidates && result.nextCandidates.length > 0) {
    const next = result.nextCandidates[0];
    msg += ` Next: \`${next.path}\` (${next.riskScore.toFixed(1)}, ${next.reason})`;
  }

  msg += ' Use --show-all to see all.';

  return msg;
}

export function formatTopNSummary(result: TopNResult): string {
  if (result.totalCount === 0) {
    return 'No issues found';
  }

  if (result.isLimited) {
    return `Showing top ${result.shownCount} of ${result.totalCount} issues`;
  }

  return `${result.totalCount} issue(s) found`;
}

export function formatRationale(result: TopNResult): string | null {
  return result.rationale || null;
}

export function formatDetailedRationale(result: TopNResult): string | null {
  if (!result.rationaleDetails || result.rationaleDetails.size === 0) {
    return null;
  }

  const parts: string[] = [];

  for (const [path, reason] of result.rationaleDetails) {
    const fileName = path.split('/').pop() || path;
    parts.push(
      `${reason.rank}) ${fileName}: ${reason.primary} (${reason.factors.slice(0, 2).join(', ')})`,
    );
  }

  return parts.join('\n');
}
