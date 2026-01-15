/**
 * Policy Rules Provider
 *
 * Provides baseline rules and profile rules for the policy engine.
 *
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { Rule } from './engine';
import { getProfile, ProfileName } from './profiles';

export type { DiffeSenseConfig } from '../config/schema';
import type { DiffeSenseConfig } from '../config/schema';

/**
 * @deprecated Use `resolveConfig` from '../config' instead.
 * This function is kept for backwards compatibility.
 */
export function loadConfig(
  configPath?: string,
  cwd: string = process.cwd(),
): Partial<DiffeSenseConfig> {
  const config: Partial<DiffeSenseConfig> = {};

  if (configPath) {
    const fullPath = path.isAbsolute(configPath) ? configPath : path.join(cwd, configPath);
    if (fs.existsSync(fullPath)) {
      return mergeConfig(config, loadConfigFileLocal(fullPath));
    }
    return config;
  }

  const repoConfig = path.join(cwd, '.diffesense.yml');
  if (fs.existsSync(repoConfig)) {
    return mergeConfig(config, loadConfigFileLocal(repoConfig));
  }

  const repoConfigYaml = path.join(cwd, '.diffesense.yaml');
  if (fs.existsSync(repoConfigYaml)) {
    return mergeConfig(config, loadConfigFileLocal(repoConfigYaml));
  }

  const homeConfig = path.join(process.env.HOME || '', '.diffesense.yml');
  if (fs.existsSync(homeConfig)) {
    return mergeConfig(config, loadConfigFileLocal(homeConfig));
  }

  return config;
}

function loadConfigFileLocal(filePath: string): Partial<DiffeSenseConfig> {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = yaml.load(content) as Partial<DiffeSenseConfig>;
    return parsed || {};
  } catch {
    return {};
  }
}

function mergeConfig(
  base: Partial<DiffeSenseConfig>,
  override: Partial<DiffeSenseConfig>,
): Partial<DiffeSenseConfig> {
  const merged: Partial<DiffeSenseConfig> = {
    ...base,
    ...override,
  };

  if (base.scope || override.scope) {
    merged.scope = { ...base.scope, ...override.scope };
  }
  if (base.thresholds || override.thresholds) {
    merged.thresholds = { ...base.thresholds, ...override.thresholds };
  }
  if (base.output || override.output) {
    merged.output = { ...base.output, ...override.output };
  }
  if (base.patterns || override.patterns) {
    merged.patterns = { ...base.patterns, ...override.patterns };
  }
  if (base.rules || override.rules) {
    merged.rules = [...(base.rules || []), ...(override.rules || [])];
  }
  if (base.exceptions || override.exceptions) {
    merged.exceptions = [...(base.exceptions || []), ...(override.exceptions || [])];
  }

  return merged;
}

/**
 * Get baseline rules that are always applied
 * These define DiffeSense's core identity
 */
export function getBaselineRules(): Rule[] {
  return [
    {
      id: 'baseline-critical-risk',
      description: 'Critical risk files always block',
      when: { riskGte: 8.0 },
      then: { severity: 'blocker' },
    },
    {
      id: 'baseline-high-risk-high-radius',
      description: 'High risk + high blast radius = blocker',
      when: { riskGte: 7.0, blastRadiusGte: 10 },
      then: { severity: 'blocker' },
    },
    {
      id: 'baseline-high-risk',
      description: 'High risk files need attention',
      when: { riskGte: 6.0 },
      then: { severity: 'warning' },
    },
    {
      id: 'baseline-high-blast-radius',
      description: 'High blast radius files need attention',
      when: { blastRadiusGte: 15 },
      then: { severity: 'warning' },
    },
    {
      id: 'baseline-side-effects-core',
      description: 'Side effects in core paths need attention',
      when: {
        evidenceContains: ['side-effect'],
        pathMatches: ['src/core/**', 'src/store/**'],
      },
      then: { severity: 'warning' },
    },
    {
      id: 'baseline-large-file',
      description: 'Large files touched',
      when: { evidenceContains: ['large file'] },
      then: { severity: 'info' },
    },
  ];
}

/**
 * Get all rules for a profile, including baseline
 * @param profileName - Profile name
 * @param customRules - Additional custom rules
 * @returns Combined rules array
 */
export function getProfileRules(profileName?: string, customRules: Rule[] = []): Rule[] {
  const profile = profileName as ProfileName | undefined;
  const baselineRules = getBaselineRules();
  const profileRules = profile ? getProfile(profile) : [];

  const ruleMap = new Map<string, Rule>();

  for (const rule of baselineRules) {
    ruleMap.set(rule.id, rule);
  }

  for (const rule of profileRules) {
    ruleMap.set(rule.id, rule);
  }

  for (const rule of customRules) {
    ruleMap.set(rule.id, rule);
  }

  return Array.from(ruleMap.values());
}

/**
 * Validate config file
 * @param configPath - Path to config file
 * @returns Validation result
 */
export function validateConfig(configPath: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!fs.existsSync(configPath)) {
    return { valid: false, errors: ['Config file not found'] };
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const config = yaml.load(content) as DiffeSenseConfig;

    if (config.version !== undefined && config.version !== 1) {
      errors.push(`Unsupported config version: ${config.version}`);
    }

    if (
      config.profile &&
      !['minimal', 'strict', 'react', 'vue', 'angular', 'backend'].includes(config.profile)
    ) {
      errors.push(`Unknown profile: ${config.profile}`);
    }

    if (config.thresholds?.failAboveRisk !== undefined) {
      if (config.thresholds.failAboveRisk < 0 || config.thresholds.failAboveRisk > 10) {
        errors.push('failAboveRisk must be between 0 and 10');
      }
    }

    if (config.rules) {
      for (const rule of config.rules) {
        if (!rule.id) {
          errors.push('Rule missing required id field');
        }
        if (!rule.when) {
          errors.push(`Rule ${rule.id || 'unknown'} missing required when field`);
        }
        if (!rule.then?.severity) {
          errors.push(`Rule ${rule.id || 'unknown'} missing required then.severity field`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  } catch (error) {
    return { valid: false, errors: [`YAML parse error: ${error}`] };
  }
}
