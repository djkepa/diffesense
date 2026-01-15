/**
 * Risk severity classification
 */
export type RiskSeverity = 'LOW' | 'MED' | 'HIGH' | 'CRITICAL';

/**
 * Map risk score (0-10) to severity level
 */
export function getRiskSeverity(riskScore: number): RiskSeverity {
  if (riskScore >= 8.0) return 'CRITICAL';
  if (riskScore >= 6.0) return 'HIGH';
  if (riskScore >= 3.0) return 'MED';
  return 'LOW';
}

/**
 * Get color for severity (chalk-compatible)
 */
export function getSeverityColor(severity: RiskSeverity): 'red' | 'yellow' | 'cyan' | 'gray' {
  switch (severity) {
    case 'CRITICAL':
      return 'red';
    case 'HIGH':
      return 'yellow';
    case 'MED':
      return 'cyan';
    case 'LOW':
      return 'gray';
  }
}

/**
 * Sort files by severity (CRITICAL > HIGH > MED > LOW), then by risk score desc, then by path asc
 */
export function sortFilesBySeverity<T extends { riskScore: number; path: string }>(
  files: T[],
): T[] {
  const severityOrder: Record<RiskSeverity, number> = {
    CRITICAL: 0,
    HIGH: 1,
    MED: 2,
    LOW: 3,
  };

  return [...files].sort((a, b) => {
    const sevA = getRiskSeverity(a.riskScore);
    const sevB = getRiskSeverity(b.riskScore);

    if (severityOrder[sevA] !== severityOrder[sevB]) {
      return severityOrder[sevA] - severityOrder[sevB];
    }

    if (a.riskScore !== b.riskScore) {
      return b.riskScore - a.riskScore;
    }

    return a.path.localeCompare(b.path);
  });
}
