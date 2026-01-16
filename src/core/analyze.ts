/**
 * Core Analysis API
 *
 * Pure analysis function with structured result.
 * No IO (console.log/warn), no process.exit.
 * This is the stable programmatic API for library usage.
 */

import * as path from 'path';
import { getChangedFiles, getCurrentBranch, isGitRepo, DiffScope, parseGitDiff } from '../git/diff';
import { analyzeProject, ChangedFileDetail } from '../analyzers';
import { buildDependencyGraph, calculateBlastRadiusFromGraph } from '../analyzers/blastRadius';
import { evaluateRules, EvaluationResult } from '../policy/engine';
import { getProfileRules } from '../policy/loader';
import { resolveConfig, DiffeSenseConfig } from '../config';
import { DetectorProfile } from '../signals';
import { buildIgnoreList, shouldIgnore, explainIgnore } from './ignore';
import { getRiskSeverity, RiskSeverity } from './severity';

export interface AnalyzeOptions {
  /** Working directory (defaults to process.cwd()) */
  cwd?: string;
  /** Analysis scope */
  scope?: DiffScope;
  /** Base branch for comparison */
  base?: string;
  /** Specific commit to analyze */
  commit?: string;
  /** Git commit range */
  range?: string;
  /** Profile name */
  profile?: string;
  /** Detector type */
  detector?: DetectorProfile;
  /** Path to config file */
  configPath?: string;
  /** Override fail threshold */
  threshold?: number;
  /** Include test files */
  includeTests?: boolean;
  /** Include config files */
  includeConfig?: boolean;
  /** Context lines around changes */
  contextLines?: number;
  /** Skip blast radius calculation */
  skipBlastRadius?: boolean;
  /** Analyze entire files, not just changed lines */
  fullFileAnalysis?: boolean;
  /** Use class-based scoring */
  classBasedScoring?: boolean;
  /** Analyze all files (not just changed) */
  analyzeAll?: boolean;
}

export interface AnalyzedFileResult {
  path: string;
  riskScore: number;
  gatedRiskScore: number;
  severity: RiskSeverity;
  blastRadius: number;
  evidence: Array<{
    line?: number;
    message: string;
    severity: 'error' | 'warning' | 'info';
    tag?: string;
  }>;
  riskReasons: string[];
  signalTypes: string[];
  gateStats?: {
    blocking: number;
    advisory: number;
    filtered: number;
    total: number;
  };
}

export interface IgnoredFile {
  path: string;
  reason: string;
}

export interface AnalysisWarning {
  code: string;
  message: string;
  path?: string;
}

export interface AnalysisMeta {
  cwd: string;
  scope: DiffScope;
  base: string;
  branch: string | null;
  profile: string;
  detector: DetectorProfile;
  configSource: string;
  isDiffAnalysis: boolean;
  timestamp: string;
}

export interface AnalysisResult {
  /** Whether analysis succeeded */
  success: boolean;
  /** Error message if success is false */
  error?: string;
  /** Exit code (0 = pass, 1 = fail/blockers, 2 = error) */
  exitCode: 0 | 1 | 2;
  /** Analysis metadata */
  meta: AnalysisMeta;
  /** Summary statistics */
  summary: {
    changedCount: number;
    analyzedCount: number;
    ignoredCount: number;
    highestRisk: number;
    blockerCount: number;
    warningCount: number;
    infoCount: number;
  };
  /** Analyzed files with risk scores */
  files: AnalyzedFileResult[];
  /** Files that were ignored with reasons */
  ignoredFiles: IgnoredFile[];
  /** Evaluation result from policy engine */
  evaluation: EvaluationResult | null;
  /** Config and analysis warnings (not errors) */
  warnings: AnalysisWarning[];
  /** Resolved config used for analysis */
  config: DiffeSenseConfig;
}

/**
 * Run analysis and return structured result.
 * This is the primary programmatic API.
 *
 * @example
 * ```typescript
 * import { analyze } from 'diffesense';
 *
 * const result = await analyze({
 *   cwd: '/path/to/repo',
 *   scope: 'branch',
 *   base: 'main',
 * });
 *
 * if (result.exitCode === 1) {
 *   console.log('Blockers found:', result.summary.blockerCount);
 * }
 * ```
 */
export async function analyze(options: AnalyzeOptions = {}): Promise<AnalysisResult> {
  const cwd = options.cwd || process.cwd();
  const warnings: AnalysisWarning[] = [];
  const ignoredFiles: IgnoredFile[] = [];

  const meta: AnalysisMeta = {
    cwd,
    scope: 'branch',
    base: 'main',
    branch: null,
    profile: 'minimal',
    detector: 'auto',
    configSource: 'defaults',
    isDiffAnalysis: true,
    timestamp: new Date().toISOString(),
  };

  if (!isGitRepo(cwd)) {
    return createErrorResult('Not a git repository', meta, warnings);
  }

  const {
    config,
    source: configSource,
    warnings: configWarnings,
  } = resolveConfig({
    configPath: options.configPath,
    cwd,
  });

  meta.configSource = configSource;

  for (const warn of configWarnings) {
    warnings.push({ code: 'CONFIG_WARNING', message: warn });
  }

  let scope: DiffScope = (options.scope || config.scope?.default || 'branch') as DiffScope;
  if (options.commit) {
    scope = 'commit';
  } else if (options.range) {
    scope = 'range';
  }
  meta.scope = scope;

  const base = options.base || config.scope?.base || 'main';
  const profile = options.profile || config.profile || 'minimal';
  const detector = (options.detector || 'auto') as DetectorProfile;

  meta.base = base;
  meta.profile = profile;
  meta.detector = detector;
  meta.branch = getCurrentBranch(cwd);

  const configIgnore = config.ignore;
  const ignorePatterns_config = Array.isArray(configIgnore)
    ? configIgnore
    : (configIgnore as { patterns?: string[] })?.patterns;

  const ignoreConfig = {
    includeTests: options.includeTests || false,
    includeConfig: options.includeConfig || false,
    patterns: ignorePatterns_config,
  };

  const ignorePatterns = buildIgnoreList(ignoreConfig);
  const contextLines = options.contextLines ?? config.contextLines ?? 5;
  const useDiffFocus = options.fullFileAnalysis !== true;
  const useClassBasedScoring = options.classBasedScoring !== false;
  const skipBlastRadius = options.skipBlastRadius || false;
  const analyzeAll = options.analyzeAll || false;

  let filesToAnalyze: string[] = [];
  let changedFileDetails: ChangedFileDetail[] = [];
  let allChangedPaths: string[] = [];

  if (analyzeAll) {
    meta.isDiffAnalysis = false;
  } else {
    const rawChangedFiles = getChangedFiles({
      scope,
      base,
      commit: options.commit,
      range: options.range,
      cwd,
      ignoreConfig: { includeTests: true, includeConfig: true },
    });

    allChangedPaths = rawChangedFiles.map((f) => f.path);

    const changedFiles = getChangedFiles({
      scope,
      base,
      commit: options.commit,
      range: options.range,
      cwd,
      ignoreConfig,
    });

    for (const rawFile of rawChangedFiles) {
      const isIncluded = changedFiles.some((f) => f.path === rawFile.path);
      if (!isIncluded) {
        const explanation = explainIgnore(rawFile.path, ignoreConfig);
        ignoredFiles.push({
          path: rawFile.path,
          reason: explanation.reason || 'Filtered by ignore rules',
        });
      }
    }

    if (changedFiles.length === 0) {
      return createEmptyResult(meta, warnings, ignoredFiles, config, allChangedPaths.length);
    }

    filesToAnalyze = changedFiles.map((f) => f.path);

    if (useDiffFocus) {
      const diffDetails = parseGitDiff({
        scope,
        base,
        commit: options.commit,
        range: options.range,
        cwd,
        contextLines: 0,
      });

      changedFileDetails = diffDetails
        .filter((d) => !shouldIgnore(d.path, ignorePatterns))
        .map((d) => ({
          path: d.path,
          status: d.status,
          ranges: d.ranges,
          totalLinesChanged: d.totalLinesChanged,
          oldPath: d.oldPath,
        }));
    }
  }

  const analysis = await analyzeProject({
    rootPath: cwd,
    includePatterns: config.patterns?.include,
    excludePatterns: config.patterns?.exclude,
    files: analyzeAll ? undefined : filesToAnalyze,
    detectorProfile: detector,
    changedFileDetails: useDiffFocus ? changedFileDetails : undefined,
    contextLines,
    useClassBasedScoring,
    includeTests: options.includeTests || false,
    includeConfig: options.includeConfig || false,
  });

  meta.isDiffAnalysis = analysis.isDiffAnalysis;

  if (analysis.analyzedFiles.length === 0) {
    return createEmptyResult(meta, warnings, ignoredFiles, config, allChangedPaths.length);
  }

  let dependencyGraph = null;
  if (!skipBlastRadius) {
    const allFilePaths = analysis.analyzedFiles.map((f) => f.path);
    dependencyGraph = buildDependencyGraph(cwd, allFilePaths);
  }

  const files: AnalyzedFileResult[] = [];

  for (const file of analysis.analyzedFiles) {
    let blastRadius = 0;

    if (!skipBlastRadius && dependencyGraph) {
      const radius = calculateBlastRadiusFromGraph(file.path, dependencyGraph);
      blastRadius = radius.totalDependents;
    }

    files.push({
      path: file.path,
      riskScore: file.riskScore,
      gatedRiskScore: file.gatedRiskScore,
      severity: getRiskSeverity(file.riskScore),
      blastRadius,
      evidence: file.evidence.map((e) => ({
        line: e.line,
        message: e.message,
        severity: e.severity,
        tag: e.tag,
      })),
      riskReasons: file.riskReasons,
      signalTypes: file.signalTypes,
      gateStats: file.gateStats,
    });
  }

  const rules = getProfileRules(profile, config.rules);

  if (options.threshold !== undefined) {
    rules.unshift({
      id: 'api-threshold-override',
      description: 'API threshold override',
      when: { riskGte: options.threshold },
      then: { severity: 'blocker' },
    });
  }

  if (config.thresholds?.failAboveRisk !== undefined) {
    rules.unshift({
      id: 'config-fail-threshold',
      description: 'Config fail threshold',
      when: { riskGte: config.thresholds.failAboveRisk },
      then: { severity: 'blocker' },
    });
  }

  const evaluation = evaluateRules(files, rules, config.exceptions, {
    useGatedScoring: true,
  });

  const highestRisk = files.reduce((max, f) => Math.max(max, f.riskScore), 0);

  return {
    success: true,
    exitCode: evaluation.exitCode,
    meta,
    summary: {
      changedCount: analyzeAll ? analysis.analyzedFiles.length : allChangedPaths.length,
      analyzedCount: files.length,
      ignoredCount: ignoredFiles.length,
      highestRisk,
      blockerCount: evaluation.blockers.length,
      warningCount: evaluation.warnings.length,
      infoCount: evaluation.infos.length,
    },
    files,
    ignoredFiles,
    evaluation,
    warnings,
    config,
  };
}

function createErrorResult(
  error: string,
  meta: AnalysisMeta,
  warnings: AnalysisWarning[],
): AnalysisResult {
  return {
    success: false,
    error,
    exitCode: 2,
    meta,
    summary: {
      changedCount: 0,
      analyzedCount: 0,
      ignoredCount: 0,
      highestRisk: 0,
      blockerCount: 0,
      warningCount: 0,
      infoCount: 0,
    },
    files: [],
    ignoredFiles: [],
    evaluation: null,
    warnings,
    config: {} as DiffeSenseConfig,
  };
}

function createEmptyResult(
  meta: AnalysisMeta,
  warnings: AnalysisWarning[],
  ignoredFiles: IgnoredFile[],
  config: DiffeSenseConfig,
  changedCount: number,
): AnalysisResult {
  return {
    success: true,
    exitCode: 0,
    meta,
    summary: {
      changedCount,
      analyzedCount: 0,
      ignoredCount: ignoredFiles.length,
      highestRisk: 0,
      blockerCount: 0,
      warningCount: 0,
      infoCount: 0,
    },
    files: [],
    ignoredFiles,
    evaluation: null,
    warnings,
    config,
  };
}
