export * from './signals';
export {
  getChangedFiles,
  getCurrentBranch,
  isGitRepo,
  DiffScope,
  DiffOptions,
  ChangedFile,
} from './git/diff';

export {
  analyzeProject,
  AnalyzeOptions,
  AnalyzedFile,
  Evidence,
  ProjectAnalysis,
} from './analyzers';
export { calculateBlastRadius, BlastRadiusResult } from './analyzers/blastRadius';

export {
  evaluateRules,
  Rule,
  RuleCondition,
  RuleAction,
  ActionItem,
  RuleResult,
  EvaluationResult,
  Exception,
} from './policy/engine';
export {
  loadConfig,
  getProfileRules,
  validateConfig,
  getBaselineRules,
  DiffeSenseConfig,
} from './policy/loader';
export { getProfile, ProfileName, profiles } from './policy/profiles';

export { formatConsoleOutput, OutputContext } from './output/formatters/dsConsole';
export { formatMarkdownOutput } from './output/formatters/dsMarkdown';
export { formatJsonOutput, JsonOutput, JsonIssue } from './output/formatters/dsJson';
