/**
 * DiffeSense - Framework-agnostic JavaScript/TypeScript change-risk engine
 *
 * Public API - these exports are stable and covered by semantic versioning.
 */

export {
  analyze,
  AnalyzeOptions,
  AnalysisResult,
  AnalyzedFileResult,
  IgnoredFile,
  AnalysisWarning,
  AnalysisMeta,
} from './core/analyze';

export {
  RiskSeverity,
  getRiskSeverity,
  getSeverityColor,
  sortFilesBySeverity,
} from './core/severity';

export { formatConsoleOutput, OutputContext } from './output/formatters/dsConsole';
export { formatMarkdownOutput } from './output/formatters/dsMarkdown';
export { formatJsonOutput, JsonOutput, JsonIssue } from './output/formatters/dsJson';

export type { DiffScope } from './git/diff';
export type { DetectorProfile } from './signals';
export type { DiffeSenseConfig } from './config/schema';
export type { EvaluationResult, RuleResult } from './policy/engine';

export {
  AnalysisCache,
  createCache,
  buildCacheKeyComponents,
  CacheConfig,
  CachedResult,
  CacheKeyComponents,
  CacheStats,
  DEFAULT_CACHE_CONFIG,
} from './cache';
