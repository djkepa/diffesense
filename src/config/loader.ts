import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import {
  DiffeSenseConfig,
  parseConfig,
  formatValidationErrors,
  getDefaultConfig,
  ValidationResult,
} from './schema';

const CONFIG_SEARCH_PATHS = [
  '.diffesense.yml',
  '.diffesense.yaml',
  '.diffesense.json',
  'diffesense.config.yml',
  'diffesense.config.yaml',
  'diffesense.config.json',
];

export function loadConfigFile(filePath: string): ValidationResult {
  if (!fs.existsSync(filePath)) {
    return {
      valid: false,
      errors: [{ path: 'file', message: `Config file not found: ${filePath}`, code: 'not_found' }],
      warnings: [],
    };
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const ext = path.extname(filePath).toLowerCase();

    let data: unknown;

    if (ext === '.json') {
      data = JSON.parse(content);
    } else {
      data = yaml.load(content);
    }

    const result = parseConfig(data);

    if (!result.valid) {
      result.errors = result.errors.map((err) => ({
        ...err,
        message: `${err.message} (in ${filePath})`,
      }));
    }

    return result;
  } catch (error) {
    const message =
      error instanceof SyntaxError
        ? `JSON parse error: ${error.message}`
        : error instanceof yaml.YAMLException
        ? `YAML parse error: ${error.message}`
        : `Failed to load config: ${error}`;

    return {
      valid: false,
      errors: [{ path: 'file', message: `${message} (in ${filePath})`, code: 'parse_error' }],
      warnings: [],
    };
  }
}

export function findConfigFile(cwd: string = process.cwd()): string | null {
  for (const configName of CONFIG_SEARCH_PATHS) {
    const configPath = path.join(cwd, configName);
    if (fs.existsSync(configPath)) {
      return configPath;
    }
  }
  return null;
}

export function resolveConfig(options: {
  configPath?: string;
  cwd?: string;
  cliOverrides?: Partial<DiffeSenseConfig>;
}): { config: DiffeSenseConfig; source: string; warnings: string[] } {
  const { configPath, cwd = process.cwd(), cliOverrides = {} } = options;
  const warnings: string[] = [];

  let config = getDefaultConfig();
  let source = 'defaults';

  const homeConfig = path.join(
    process.env.HOME || process.env.USERPROFILE || '',
    '.diffesense.yml',
  );
  if (fs.existsSync(homeConfig)) {
    const homeResult = loadConfigFile(homeConfig);
    if (homeResult.valid && homeResult.config) {
      config = mergeConfigs(config, homeResult.config);
      source = homeConfig;
      warnings.push(...homeResult.warnings);
    }
  }

  const autoConfig = findConfigFile(cwd);
  if (autoConfig && !configPath) {
    const autoResult = loadConfigFile(autoConfig);
    if (autoResult.valid && autoResult.config) {
      config = mergeConfigs(config, autoResult.config);
      source = autoConfig;
      warnings.push(...autoResult.warnings);
    } else {
      console.error(formatValidationErrors(autoResult));
      process.exit(2);
    }
  }

  if (configPath) {
    const fullPath = path.isAbsolute(configPath) ? configPath : path.join(cwd, configPath);
    const explicitResult = loadConfigFile(fullPath);
    if (explicitResult.valid && explicitResult.config) {
      config = mergeConfigs(config, explicitResult.config);
      source = fullPath;
      warnings.push(...explicitResult.warnings);
    } else {
      console.error(formatValidationErrors(explicitResult));
      process.exit(2);
    }
  }

  config = mergeConfigs(config, cliOverrides);
  if (Object.keys(cliOverrides).length > 0) {
    source = `${source} + CLI`;
  }

  return { config, source, warnings };
}

function mergeConfigs(
  base: DiffeSenseConfig,
  override: Partial<DiffeSenseConfig>,
): DiffeSenseConfig {
  const merged: DiffeSenseConfig = { ...base };

  if (override.version !== undefined) merged.version = override.version;
  if (override.profile !== undefined) merged.profile = override.profile;
  if (override.topN !== undefined) merged.topN = override.topN;
  if (override.contextLines !== undefined) merged.contextLines = override.contextLines;

  if (override.scope) {
    merged.scope = { ...merged.scope, ...override.scope };
  }

  if (override.thresholds) {
    merged.thresholds = { ...merged.thresholds, ...override.thresholds };
  }

  if (override.output) {
    merged.output = { ...merged.output, ...override.output };
  }

  if (override.patterns) {
    merged.patterns = { ...merged.patterns, ...override.patterns };
  }

  if (override.actions) {
    merged.actions = {
      ...merged.actions,
      mapping: [...(merged.actions?.mapping || []), ...(override.actions.mapping || [])],
    };
  }

  if (override.ownership) {
    merged.ownership = { ...merged.ownership, ...override.ownership };
  }

  if (override.customPatterns) {
    merged.customPatterns = [...(merged.customPatterns || []), ...override.customPatterns];
  }

  if (override.rules) {
    type RuleType = NonNullable<typeof merged.rules>[number];
    const ruleMap = new Map<string, RuleType>();
    for (const rule of merged.rules || []) {
      ruleMap.set(rule.id, rule);
    }
    for (const rule of override.rules) {
      ruleMap.set(rule.id, rule);
    }
    merged.rules = Array.from(ruleMap.values());
  }

  if (override.exceptions) {
    type ExceptionType = NonNullable<typeof merged.exceptions>[number];
    const excMap = new Map<string, ExceptionType>();
    for (const exc of merged.exceptions || []) {
      excMap.set(exc.id, exc);
    }
    for (const exc of override.exceptions) {
      excMap.set(exc.id, exc);
    }
    merged.exceptions = Array.from(excMap.values());
  }

  if (override.ignore) {
    if (Array.isArray(override.ignore)) {
      const existingPatterns = Array.isArray(merged.ignore)
        ? merged.ignore
        : (merged.ignore as { patterns?: string[] })?.patterns || [];
      (merged as any).ignore = [...existingPatterns, ...override.ignore];
    } else {
      const existingIgnore = Array.isArray(merged.ignore)
        ? { patterns: merged.ignore }
        : (merged.ignore as {
            patterns?: string[];
            includeTests?: boolean;
            includeConfig?: boolean;
          }) || {};
      (merged as any).ignore = {
        ...existingIgnore,
        ...override.ignore,
        patterns: [
          ...(existingIgnore.patterns || []),
          ...((override.ignore as { patterns?: string[] }).patterns || []),
        ],
      };
    }
  }

  return merged;
}

export function printEffectiveConfig(config: DiffeSenseConfig, source: string): string {
  const lines: string[] = [];

  lines.push('# Effective DiffeSense Configuration');
  lines.push(`# Source: ${source}`);
  lines.push('');

  const cleanConfig = JSON.parse(JSON.stringify(config));
  const yamlOutput = yaml.dump(cleanConfig, {
    indent: 2,
    lineWidth: 100,
    noRefs: true,
    sortKeys: true,
  });

  lines.push(yamlOutput);

  return lines.join('\n');
}

export function printConfigSummary(config: DiffeSenseConfig, source: string): string {
  const lines: string[] = [];

  lines.push(`Config: ${source}`);
  lines.push(`Profile: ${config.profile || 'minimal'}`);
  lines.push(`Scope: ${config.scope?.default || 'branch'} vs ${config.scope?.base || 'main'}`);

  if (config.thresholds?.fail || config.thresholds?.warn) {
    lines.push(
      `Thresholds: fail=${config.thresholds.fail || 'default'}, warn=${
        config.thresholds.warn || 'default'
      }`,
    );
  }

  if (config.output?.topN || config.topN) {
    lines.push(`Top N: ${config.output?.topN || config.topN || 5}`);
  }

  const ignorePatterns = Array.isArray(config.ignore)
    ? config.ignore
    : (config.ignore as any)?.patterns || [];
  if (ignorePatterns.length > 0) {
    lines.push(`Ignore patterns: ${ignorePatterns.length}`);
  }

  if (config.rules && config.rules.length > 0) {
    lines.push(`Custom rules: ${config.rules.length}`);
  }

  if (config.customPatterns && config.customPatterns.length > 0) {
    lines.push(`Custom patterns: ${config.customPatterns.length}`);
  }

  return lines.join('\n');
}
