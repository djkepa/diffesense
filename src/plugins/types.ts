import { Signal, SignalClass, SignalCategory } from '../signals/types';

export type SignalSeverity = 'blocker' | 'warn' | 'info';
export type SignalConfidence = 'high' | 'medium' | 'low';

export const API_VERSION = 1;

export interface DetectorPackManifest {
  apiVersion?: number;
  name: string;
  version: string;
  description: string;
  diffesenseVersion: string;
  author?: string;
  license?: string;
  keywords?: string[];
  diffesense: {
    type: 'detector-pack';
    frameworks?: string[];
    detectors: DetectorDefinition[];
    patterns?: PatternDefinition[];
    rules?: RulePreset[];
  };
}

export interface DetectorDefinition {
  id: string;
  name: string;
  description: string;
  frameworks?: string[];
  filePatterns?: string[];
  enabled?: boolean;
  detect: DetectionMethod;
}

export type DetectionMethod =
  | RegexDetectionMethod
  | ASTDetectionMethod
  | CompositeDetectionMethod
  | CustomDetectionMethod;

export interface RegexDetectionMethod {
  type: 'regex';

  patterns: RegexPattern[];
}

export interface RegexPattern {
  id: string;
  pattern: string;
  flags?: string;
  signal: SignalTemplate;
  context?: PatternContext;
}

export interface ASTDetectionMethod {
  type: 'ast';
  queryLanguage: string;
  queries: ASTQuery[];
}

export interface ASTQuery {
  id: string;
  query: string;
  signal: SignalTemplate;
}

export interface CompositeDetectionMethod {
  type: 'composite';
  methods: DetectionMethod[];
  combine: 'all' | 'any';
}

export interface CustomDetectionMethod {
  type: 'custom';
  handler: string;
}

export interface PatternDefinition {
  id: string;
  name: string;
  description: string;
  matchType: 'regex' | 'function' | 'import' | 'path';
  match: string | string[];
  category: SignalCategory;
  signalClass: SignalClass;
  weight: number;
  tags?: string[];
  enabled?: boolean;
}

export interface SignalTemplate {
  id: string;
  title: string;
  reason: string;
  class: SignalClass;
  category: SignalCategory;
  severity: SignalSeverity;
  confidence: SignalConfidence;
  weight: number;
  tags?: string[];
  actions?: ActionTemplate[];
}

export interface ActionTemplate {
  type: 'test' | 'review' | 'refactor' | 'document' | 'check';
  text: string;
  command?: string;
}

export interface PatternContext {
  inChangedLines?: boolean;
  fileExtensions?: string[];
  excludePaths?: string[];
  includePaths?: string[];
  surroundingContext?: {
    before?: string;
    after?: string;
  };
}

export interface RulePreset {
  id: string;
  description?: string;
  when: {
    riskGte?: number;
    signalTypes?: string[];
    signalClasses?: SignalClass[];
    pathMatches?: string[];
  };
  then: {
    severity: 'blocker' | 'warning' | 'info';
    actions?: ActionTemplate[];
  };
}

/**
 * Detection context passed to custom detectors
 */
export interface DetectionContext {
  filePath: string;
  content: string;
  changedRanges: Array<{ start: number; end: number }>;
  extension: string;
  framework?: string;
}

export type CustomDetector = (context: DetectionContext) => Signal[];

export interface PluginLoader {
  loadFromPackage(packageName: string): Promise<DetectorPackManifest>;
  loadFromPath(path: string): Promise<DetectorPackManifest>;
  validateManifest(manifest: unknown): DetectorPackManifest;
}

/**
 * Loaded pack info
 */
export interface LoadedPack {
  manifest: DetectorPackManifest;
  source: 'npm' | 'local' | 'builtin';
  sourcePath: string;
  enabled: boolean;
}

export interface PackRegistry {
  packs: Map<string, LoadedPack>;
  getAllDetectors(): DetectorDefinition[];
  getAllPatterns(): PatternDefinition[];
  getAllRules(): RulePreset[];
}
