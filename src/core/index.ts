export {
  analyze,
  AnalyzeOptions,
  AnalysisResult,
  AnalyzedFileResult,
  IgnoredFile,
  AnalysisWarning,
  AnalysisMeta,
} from './analyze';

export { RiskSeverity, getRiskSeverity, getSeverityColor, sortFilesBySeverity } from './severity';

export {
  ALWAYS_IGNORE,
  DEFAULT_IGNORE,
  TEST_PATTERNS,
  CONFIG_PATTERNS,
  buildIgnoreList,
  shouldIgnore,
  filterIgnored,
  getIgnoreReason,
  explainIgnore,
  explainIgnoreMultiple,
  formatIgnoreExplanation,
  formatIgnoreExplanations,
  IgnoreConfig,
  IgnoreSource,
  IgnoreExplanation,
} from './ignore';

export {
  DeterminismResult,
  DeterminismInput,
  DeterminismOutput,
  computeHash,
  computeInputHash,
  computeOutputHash,
  checkDeterminism,
  compareDeterminismResults,
  formatDeterminismResult,
  formatDeterminismJson,
} from './determinism';

export {
  SignalClass,
  SignalClassConfig,
  SIGNAL_CLASS_CONFIG,
  SIGNAL_ID_CLASS,
  getSignalClass,
  getSignalClassConfig,
  classifySignals,
  calculateClassBasedRiskScore,
  canBeBlocker,
  getReasonChain,
  ClassifiedSignals,
  RiskScoreBreakdown,
} from './signalClasses';

export {
  TopNConfig,
  DEFAULT_TOP_N_CONFIG,
  selectTopN,
  formatHiddenMessage,
  formatTopNSummary,
  TopNResult,
} from './topN';

export {
  ActionType,
  ConcreteAction,
  ActionMapping,
  DEFAULT_ACTION_MAPPINGS,
  getActionsForFile,
  generateDefaultActions,
  formatAction,
  formatActionsMarkdown,
} from './actions';

export {
  CodeOwnerRule,
  CodeOwnersConfig,
  OwnerMatch,
  EscalationConfig,
  ReviewerSuggestion,
  findCodeOwnersFile,
  parseCodeOwners,
  loadCodeOwners,
  getOwnersForFile,
  getOwnersForFiles,
  suggestReviewers,
  getUniqueReviewers,
  formatReviewersForComment,
} from './codeowners';

export {
  PackageManager,
  TestFramework,
  TestRunnerConfig,
  TestCommand,
  TestMapping,
  detectPackageManager,
  detectTestFramework,
  detectMonorepo,
  detectTestRunner,
  generateTestCommand,
  generateModuleTestCommand,
  isTestFile,
  getFallbackTestCommand,
  getTestCommandForFile,
  DEFAULT_TEST_MAPPINGS,
} from './testRunner';

export {
  GatedSignals,
  GateStats,
  ConfidenceGateConfig,
  ImpactLevel,
  DEFAULT_GATE_CONFIG,
  applyConfidenceGate,
  getDisplaySignals,
  getDetailedSignals,
  hasBlockingSignals,
  formatGateStats,
  assignDefaultConfidence,
  assignDefaultConfidenceAll,
  meetsThreshold,
  meetsImpactThreshold,
} from './confidenceGate';

export {
  SUPPRESSIONS_SCHEMA_VERSION,
  SuppressionEntry,
  SuppressionsFile,
  SuppressionScope,
  AddSuppressionOptions,
  RemoveSuppressionOptions,
  SuppressionMatch,
  getLocalSuppressionsPath,
  getGlobalSuppressionsPath,
  normalizePath,
  parseDuration,
  loadSuppressionsFile,
  saveSuppressionsFile,
  createEmptySuppressionsFile,
  isExpired,
  matchesSuppression,
  loadAllSuppressions,
  getActiveSuppressions,
  isSuppressed,
  isSecuritySignal,
  addSuppression,
  removeSuppression,
  listSuppressions,
  cleanExpiredSuppressions,
  getSuppressionsHash,
  applySuppressions,
  getSuppressionKey,
  calculateSpecificity,
} from './suppressions';
