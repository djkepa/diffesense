import { z } from 'zod';

export const SignalClassSchema = z.enum(['critical', 'behavioral', 'maintainability']);
export const SeveritySchema = z.enum(['blocker', 'warning', 'info']);
export const CategorySchema = z.enum([
  'complexity',
  'side-effect',
  'async',
  'signature',
  'core-impact',
]);
export const ProfileNameSchema = z.enum([
  'minimal',
  'strict',
  'react',
  'vue',
  'angular',
  'backend',
]);
export const PolicyPackSchema = z.enum(['enterprise', 'startup', 'oss']);
export const ScopeSchema = z.enum(['branch', 'staged', 'worktree', 'auto']);
export const FormatSchema = z.enum(['console', 'markdown', 'json']);
export const DetectorSchema = z.enum([
  'auto',
  'generic',
  'react',
  'vue',
  'angular',
  'node',
  'svelte',
  'ssr',
  'react-native',
  'electron',
]);

export const ActionItemSchema = z.object({
  type: z.enum(['test', 'review', 'refactor', 'split', 'flag', 'check', 'verify', 'document']),
  text: z.string(),
  command: z.string().optional(),
  reviewers: z.array(z.string()).optional(),
  link: z.string().url().optional(),
});

export const ActionMappingSchema = z.object({
  pattern: z.string().describe('Glob pattern to match files'),
  commands: z.array(z.string()).optional().describe('Test commands to run'),
  reviewers: z.array(z.string()).optional().describe('Reviewers to request'),
  notes: z.string().optional().describe('Additional notes'),
});

export const RuleConditionSchema = z.object({
  riskGte: z.number().min(0).max(10).optional().describe('Risk score >= threshold'),
  riskLte: z.number().min(0).max(10).optional().describe('Risk score <= threshold'),
  blastRadiusGte: z.number().min(0).optional().describe('Blast radius >= threshold'),
  evidenceContains: z.array(z.string()).optional().describe('Evidence must contain these strings'),
  evidenceTags: z.array(z.string()).optional().describe('Evidence must have these tags'),
  pathMatches: z.array(z.string()).optional().describe('File path must match these globs'),
  pathExcludes: z.array(z.string()).optional().describe('File path must NOT match these globs'),
  signalTypes: z.array(z.string()).optional().describe('Signal types/IDs to match'),
  signalClasses: z.array(SignalClassSchema).optional().describe('Signal classes to match'),
});

export const RuleActionSchema = z.object({
  severity: SeveritySchema.describe('Severity to assign when rule matches'),
  actions: z.array(ActionItemSchema).optional().describe('Actions to recommend'),
});

export const RuleSchema = z.object({
  id: z.string().describe('Unique rule identifier'),
  description: z.string().optional().describe('Human-readable description'),
  when: RuleConditionSchema.describe('Conditions that trigger this rule'),
  then: RuleActionSchema.describe('Actions to take when rule matches'),
});

export const ExceptionSchema = z.object({
  id: z.string().describe('Unique exception identifier'),
  paths: z.array(z.string()).describe('Glob patterns for excepted paths'),
  until: z.string().optional().describe('Expiry date (ISO format)'),
  reason: z.string().optional().describe('Reason for exception'),
});

export const CustomPatternSchema = z.object({
  id: z.string().describe('Unique pattern identifier'),
  name: z.string().describe('Human-readable name'),
  description: z.string().describe('What this pattern detects'),
  match: z.string().describe('Regex pattern to match'),
  category: CategorySchema.describe('Signal category'),
  signalType: z.string().describe('Signal type/ID'),
  weight: z.number().min(0).max(1).describe('Weight (0-1)'),
  signalClass: SignalClassSchema.describe('Signal class'),
  framework: z
    .enum(['react', 'vue', 'angular', 'node', 'generic'])
    .optional()
    .describe('Framework scope'),
  tags: z.array(z.string()).optional().describe('Additional tags'),
  enabled: z.boolean().optional().default(true).describe('Whether pattern is enabled'),
});

export const OwnershipSchema = z.object({
  useCodeowners: z.boolean().optional().default(false).describe('Parse CODEOWNERS file'),
  escalateIfRiskAbove: z
    .number()
    .min(0)
    .max(10)
    .optional()
    .describe('Risk threshold for escalation'),
  defaultReviewers: z.array(z.string()).optional().describe('Default reviewers when no match'),
});

/**
 * Severity counts for policy pack failOn configuration
 */
export const SeverityCountsSchema = z
  .object({
    CRITICAL: z.number().int().min(0).optional().describe('Max CRITICAL before fail'),
    HIGH: z.number().int().min(0).optional().describe('Max HIGH before fail'),
    MED: z.number().int().min(0).optional().describe('Max MED before fail'),
    LOW: z.number().int().min(0).optional().describe('Max LOW before fail'),
  })
  .optional();

/**
 * FailOn configuration for when to fail the analysis
 */
export const FailOnSchema = z
  .object({
    minHighestRisk: z.number().min(0).max(10).optional().describe('Fail if highest risk >= this'),
    minBlockers: z.number().int().min(0).optional().describe('Fail if blockers >= this'),
    severityCounts: SeverityCountsSchema.describe('Fail based on severity counts'),
  })
  .optional();

export const DiffeSenseConfigSchema = z.object({
  $schema: z.string().optional().describe('JSON Schema URL'),

  version: z.number().int().min(1).max(1).optional().default(1).describe('Config version'),

  policyPack: PolicyPackSchema.optional().describe('Policy pack: enterprise, startup, or oss'),

  profile: ProfileNameSchema.optional().default('minimal').describe('Base profile'),

  detector: DetectorSchema.optional().default('auto').describe('Detector profile'),

  scope: z
    .object({
      default: ScopeSchema.optional().describe('Default analysis scope'),
      mode: ScopeSchema.optional().describe('Scope mode (alias for default)'),
      base: z.string().optional().describe('Base branch for comparison'),
    })
    .optional(),

  failOn: FailOnSchema.describe('Conditions for failing the analysis'),

  thresholds: z
    .object({
      fail: z.number().min(0).max(10).optional().describe('Risk threshold for FAIL status'),
      warn: z.number().min(0).max(10).optional().describe('Risk threshold for WARN status'),
      failAboveRisk: z.number().min(0).max(10).optional().describe('Alias for fail threshold'),
      warnAboveRisk: z.number().min(0).max(10).optional().describe('Alias for warn threshold'),
      maxFilesToShow: z.number().int().min(1).optional().describe('Max files in output'),
    })
    .optional()
    .default({}),

  output: z
    .object({
      format: FormatSchema.optional().describe('Default output format'),
      showEvidence: z.boolean().optional().describe('Show evidence in output'),
      showBlastRadius: z.boolean().optional().describe('Show blast radius'),
      topN: z.number().int().min(1).optional().describe('Number of top issues'),
      details: z.boolean().optional().describe('Show detailed output'),
    })
    .optional(),

  topN: z.number().int().min(1).optional().describe('Number of top issues (shorthand)'),

  contextLines: z.number().int().min(0).max(50).optional().default(5).describe('Context lines'),

  ignore: z
    .union([
      z.array(z.string()),

      z.object({
        patterns: z.array(z.string()).optional().describe('Glob patterns to ignore'),
        includeTests: z.boolean().optional().default(false).describe('Include test files'),
        includeConfig: z.boolean().optional().default(false).describe('Include config files'),
      }),
    ])
    .optional()
    .describe('Ignore configuration'),

  patterns: z
    .object({
      include: z.array(z.string()).optional().describe('Only analyze matching files'),
      exclude: z.array(z.string()).optional().describe('Exclude matching files'),
    })
    .optional(),

  actions: z
    .object({
      mapping: z.array(ActionMappingSchema).optional().describe('File-to-action mappings'),
      testMap: z
        .array(
          z.object({
            match: z.string(),
            cmd: z.string(),
          }),
        )
        .optional()
        .describe('Test command mappings (shorthand)'),
    })
    .optional(),

  ownership: OwnershipSchema.optional().describe('CODEOWNERS integration'),

  customPatterns: z.array(CustomPatternSchema).optional().describe('Custom detection patterns'),

  rules: z.array(RuleSchema).optional().describe('Custom rules'),

  exceptions: z.array(ExceptionSchema).optional().describe('Temporary exceptions'),
});

export type DiffeSenseConfig = z.infer<typeof DiffeSenseConfigSchema>;
export type Rule = z.infer<typeof RuleSchema>;
export type Exception = z.infer<typeof ExceptionSchema>;
export type CustomPattern = z.infer<typeof CustomPatternSchema>;
export type ActionMapping = z.infer<typeof ActionMappingSchema>;
export type Ownership = z.infer<typeof OwnershipSchema>;

export interface ValidationResult {
  valid: boolean;
  config?: DiffeSenseConfig;
  errors: ValidationError[];
  warnings: string[];
}

export interface ValidationError {
  path: string;
  message: string;
  code: string;
}

/**
 * Parse and validate config object
 */
export function parseConfig(data: unknown): ValidationResult {
  const warnings: string[] = [];

  try {
    const result = DiffeSenseConfigSchema.safeParse(data);

    if (!result.success) {
      const errors: ValidationError[] = result.error.issues.map((err) => ({
        path: err.path.join('.') || 'root',
        message: err.message,
        code: err.code,
      }));

      return { valid: false, errors, warnings };
    }

    const config = result.data;

    if (config.thresholds?.failAboveRisk !== undefined && config.thresholds?.fail === undefined) {
      warnings.push('thresholds.failAboveRisk is deprecated, use thresholds.fail instead');
      config.thresholds.fail = config.thresholds.failAboveRisk;
    }

    if (config.thresholds?.warnAboveRisk !== undefined && config.thresholds?.warn === undefined) {
      warnings.push('thresholds.warnAboveRisk is deprecated, use thresholds.warn instead');
      config.thresholds.warn = config.thresholds.warnAboveRisk;
    }

    if (Array.isArray(config.ignore)) {
      (config as any).ignore = { patterns: config.ignore };
    }

    if (config.actions?.testMap) {
      const mappings = config.actions.testMap.map((tm) => ({
        pattern: tm.match,
        commands: [tm.cmd],
      }));
      config.actions.mapping = [...(config.actions.mapping || []), ...mappings];
      warnings.push('actions.testMap is deprecated, use actions.mapping instead');
    }

    if (config.topN !== undefined && config.output) {
      config.output.topN = config.topN;
    }

    return { valid: true, config, errors: [], warnings };
  } catch (error) {
    return {
      valid: false,
      errors: [
        {
          path: 'root',
          message: error instanceof Error ? error.message : 'Unknown parse error',
          code: 'parse_error',
        },
      ],
      warnings,
    };
  }
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(result: ValidationResult): string {
  const lines: string[] = [];

  if (result.errors.length > 0) {
    lines.push('Configuration errors:');
    for (const err of result.errors) {
      lines.push(`  ✗ ${err.path}: ${err.message}`);
    }
  }

  if (result.warnings.length > 0) {
    lines.push('');
    lines.push('Warnings:');
    for (const warn of result.warnings) {
      lines.push(`  ⚠ ${warn}`);
    }
  }

  return lines.join('\n');
}

/**
 * Get default config
 */
export function getDefaultConfig(): DiffeSenseConfig {
  return DiffeSenseConfigSchema.parse({});
}
