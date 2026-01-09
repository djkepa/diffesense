/**
 * Policy Engin
 */

import { minimatch } from 'minimatch';
import {
  getActionsForFile,
  generateDefaultActions as generateSmartActions,
  ConcreteAction,
  ActionMapping,
} from '../core/actions';
import { getSignalClass } from '../core/signalClasses';
import { Signal } from '../signals/types';
import { RiskScoreBreakdown } from '../core/signalClasses';

export interface Rule {
  id: string;
  description?: string;
  when: RuleCondition;
  then: RuleAction;
}

export interface RuleCondition {
  riskGte?: number;
  riskLte?: number;
  blastRadiusGte?: number;
  evidenceContains?: string[];
  evidenceTags?: string[];
  pathMatches?: string[];
  pathExcludes?: string[];
  signalTypes?: string[];
  signalClasses?: Array<'critical' | 'behavioral' | 'maintainability'>;
}

export interface RuleAction {
  severity: 'blocker' | 'warning' | 'info';
  actions?: ActionItem[];
}

export interface ActionItem {
  type: 'test' | 'review' | 'refactor' | 'split' | 'flag' | 'check' | 'verify' | 'document';
  text: string;
  command?: string;
  reviewers?: string[];
  link?: string;
}

/**
 * Evidence from analysis
 */
export interface Evidence {
  line?: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
  tag?: string;
}

/**
 * Analyzed file interface - extended for full analysis data
 * Compatible with analyzers/index.ts AnalyzedFile
 */
export interface AnalyzedFile {
  path: string;
  riskScore: number;
  blastRadius: number;
  evidence: Evidence[];
  riskReasons: string[];
  signalTypes?: string[];
  signals?: Signal[];
  riskBreakdown?: RiskScoreBreakdown;
  changedLines?: number;
  isDiffAnalysis?: boolean;
  loc?: number;
  imports?: string[];
}

export interface RuleResult {
  ruleId: string;
  severity: 'blocker' | 'warning' | 'info';
  file: AnalyzedFile;
  actions: ActionItem[];
}

/**
 * Evaluation result with exit codes
 */
export interface EvaluationResult {
  blockers: RuleResult[];
  warnings: RuleResult[];
  infos: RuleResult[];
  exitCode: 0 | 1;
}

export interface Exception {
  id: string;
  paths: string[];
  until?: string;
  reason?: string;
}

/**
 * Evaluation options
 */
export interface EvaluationOptions {
  actionMappings?: ActionMapping[];
}

/**
 * Evaluate all rules against all files
 */
export function evaluateRules(
  files: AnalyzedFile[],
  rules: Rule[],
  exceptions: Exception[] = [],
  options: EvaluationOptions = {},
): EvaluationResult {
  const results: RuleResult[] = [];

  for (const file of files) {
    if (isExcepted(file.path, exceptions)) continue;

    for (const rule of rules) {
      if (matchesConditions(file, rule.when)) {
        const actions = rule.then.actions || generateActionsForFile(file, options.actionMappings);

        results.push({
          ruleId: rule.id,
          severity: rule.then.severity,
          file,
          actions,
        });
      }
    }
  }

  const blockers = results.filter((r) => r.severity === 'blocker');
  const warnings = results.filter((r) => r.severity === 'warning');
  const infos = results.filter((r) => r.severity === 'info');

  const deduped = deduplicateByFile(blockers, warnings, infos);

  return {
    blockers: deduped.blockers,
    warnings: deduped.warnings,
    infos: deduped.infos,
    exitCode: deduped.blockers.length > 0 ? 1 : 0,
  };
}

/**
 * Check if file matches rule conditions
 */
function matchesConditions(file: AnalyzedFile, when: RuleCondition): boolean {
  if (when.riskGte !== undefined && file.riskScore < when.riskGte) return false;
  if (when.riskLte !== undefined && file.riskScore > when.riskLte) return false;
  if (when.blastRadiusGte !== undefined && file.blastRadius < when.blastRadiusGte) return false;

  if (when.signalTypes && when.signalTypes.length > 0 && file.signalTypes) {
    const hasMatch = when.signalTypes.some((st) => file.signalTypes?.includes(st));
    if (!hasMatch) return false;
  }

  if (when.signalClasses && when.signalClasses.length > 0 && file.signalTypes) {
    const fileClasses = file.signalTypes.map((st) => getSignalClass(st));
    const hasMatch = when.signalClasses.some((sc) => fileClasses.includes(sc));
    if (!hasMatch) return false;
  }

  if (when.evidenceTags && when.evidenceTags.length > 0) {
    const fileTags = file.evidence.map((e) => e.tag).filter(Boolean);
    const hasTagMatch = when.evidenceTags.some((tag) =>
      fileTags.some((t) => t?.toLowerCase() === tag.toLowerCase()),
    );
    if (!hasTagMatch) return false;
  }

  if (when.evidenceContains && when.evidenceContains.length > 0) {
    const allEvidence = [...file.evidence.map((e) => e.message), ...file.riskReasons].map((s) =>
      s.toLowerCase(),
    );

    const hasMatch = when.evidenceContains.some((pattern) =>
      allEvidence.some((e) => e.includes(pattern.toLowerCase())),
    );
    if (!hasMatch) return false;
  }

  if (when.pathMatches && when.pathMatches.length > 0) {
    const matches = when.pathMatches.some((p) => minimatch(file.path, p));
    if (!matches) return false;
  }

  if (when.pathExcludes && when.pathExcludes.length > 0) {
    const excluded = when.pathExcludes.some((p) => minimatch(file.path, p));
    if (excluded) return false;
  }

  return true;
}

/**
 * Check if file is excepted from rules
 */
function isExcepted(filePath: string, exceptions: Exception[]): boolean {
  const now = new Date();

  for (const exc of exceptions) {
    if (exc.until) {
      const expiry = new Date(exc.until);
      if (now > expiry) continue;
    }

    if (exc.paths.some((p) => minimatch(filePath, p))) {
      return true;
    }
  }

  return false;
}

/**
 * Generate actions for a file using the smart actions system
 */
function generateActionsForFile(
  file: AnalyzedFile,
  customMappings?: ActionMapping[],
): ActionItem[] {
  const signalTypes =
    file.signalTypes ||
    (file.evidence.map((e) => e.tag?.split(':')[1]).filter(Boolean) as string[]);

  const mappedActions = getActionsForFile(file.path, customMappings || []);

  if (mappedActions.length > 0) {
    return mappedActions.map(convertConcreteAction);
  }

  const smartActions = generateSmartActions(
    file.path,
    file.riskScore,
    file.blastRadius,
    signalTypes,
  );

  return smartActions.map(convertConcreteAction);
}

/**
 * Convert ConcreteAction to ActionItem
 */
function convertConcreteAction(action: ConcreteAction): ActionItem {
  return {
    type: action.type as ActionItem['type'],
    text: action.text,
    command: action.command,
    reviewers: action.reviewers,
    link: action.link,
  };
}

/**
 * Deduplicate results - each file appears only once, with highest severity
 */
function deduplicateByFile(
  blockers: RuleResult[],
  warnings: RuleResult[],
  infos: RuleResult[],
): { blockers: RuleResult[]; warnings: RuleResult[]; infos: RuleResult[] } {
  const seenPaths = new Set<string>();

  const dedupedBlockers: RuleResult[] = [];
  const dedupedWarnings: RuleResult[] = [];
  const dedupedInfos: RuleResult[] = [];

  for (const r of blockers) {
    if (!seenPaths.has(r.file.path)) {
      seenPaths.add(r.file.path);
      dedupedBlockers.push(r);
    }
  }

  for (const r of warnings) {
    if (!seenPaths.has(r.file.path)) {
      seenPaths.add(r.file.path);
      dedupedWarnings.push(r);
    }
  }

  for (const r of infos) {
    if (!seenPaths.has(r.file.path)) {
      seenPaths.add(r.file.path);
      dedupedInfos.push(r);
    }
  }

  return { blockers: dedupedBlockers, warnings: dedupedWarnings, infos: dedupedInfos };
}
