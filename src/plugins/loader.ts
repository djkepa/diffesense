/**
 * Plugin Loader - Load and validate detector packs
 *
 * Per Operating Document Section 14 (P2 - Detector registry)
 *
 * Features:
 * - Load packs from npm packages
 * - Load packs from local files
 * - Validate pack manifests
 * - Merge patterns and rules from packs
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  DetectorPackManifest,
  DetectorDefinition,
  PatternDefinition,
  RulePreset,
  LoadedPack,
  PackRegistry,
} from './types';

/**
 * Load pack from npm package
 */
export async function loadPackFromPackage(
  packageName: string,
): Promise<DetectorPackManifest | null> {
  try {
    const packagePath = require.resolve(packageName);
    const packageDir = path.dirname(packagePath);
    const manifestPath = path.join(packageDir, 'package.json');

    if (!fs.existsSync(manifestPath)) {
      console.warn(`Package ${packageName} has no package.json`);
      return null;
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

    if (!manifest.diffesense || manifest.diffesense.type !== 'detector-pack') {
      console.warn(`Package ${packageName} is not a DiffeSense detector pack`);
      return null;
    }

    return validateManifest(manifest);
  } catch (error) {
    console.warn(`Could not load pack ${packageName}: ${error}`);
    return null;
  }
}

/**
 * Load pack from local path
 */
export async function loadPackFromPath(packPath: string): Promise<DetectorPackManifest | null> {
  try {
    const fullPath = path.isAbsolute(packPath) ? packPath : path.resolve(packPath);

    const manifestPath = fs.statSync(fullPath).isDirectory()
      ? path.join(fullPath, 'package.json')
      : fullPath;

    if (!fs.existsSync(manifestPath)) {
      console.warn(`Pack manifest not found: ${manifestPath}`);
      return null;
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    return validateManifest(manifest);
  } catch (error) {
    console.warn(`Could not load pack from ${packPath}: ${error}`);
    return null;
  }
}

/**
 * Load pack from YAML definition file
 */
export async function loadPackFromYaml(yamlPath: string): Promise<DetectorPackManifest | null> {
  try {
    const yaml = require('js-yaml');
    const content = fs.readFileSync(yamlPath, 'utf-8');
    const manifest = yaml.load(content);
    return validateManifest(manifest);
  } catch (error) {
    console.warn(`Could not load pack from YAML ${yamlPath}: ${error}`);
    return null;
  }
}

/** Valid severity values */
const VALID_SEVERITIES = ['blocker', 'warn', 'info'];

/** Current supported API version */
const SUPPORTED_API_VERSION = 1;

/**
 * Validate pack manifest
 */
export function validateManifest(manifest: unknown): DetectorPackManifest {
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('Invalid manifest: not an object');
  }

  const m = manifest as Record<string, unknown>;

  if (m.apiVersion !== undefined) {
    if (typeof m.apiVersion !== 'number' || m.apiVersion !== SUPPORTED_API_VERSION) {
      throw new Error(
        `Unsupported API version: ${m.apiVersion}. Supported version: ${SUPPORTED_API_VERSION}`,
      );
    }
  }

  if (!m.name || typeof m.name !== 'string') {
    throw new Error('Invalid manifest: missing or invalid name');
  }

  if (!m.version || typeof m.version !== 'string') {
    throw new Error('Invalid manifest: missing or invalid version');
  }

  if (!m.diffesense || typeof m.diffesense !== 'object') {
    throw new Error('Invalid manifest: missing diffesense config');
  }

  const ds = m.diffesense as Record<string, unknown>;

  if (ds.type !== 'detector-pack') {
    throw new Error('Invalid manifest: type must be "detector-pack"');
  }

  if (!Array.isArray(ds.detectors)) {
    throw new Error('Invalid manifest: detectors must be an array');
  }

  for (const detector of ds.detectors) {
    validateDetector(detector);
  }

  if (ds.patterns && Array.isArray(ds.patterns)) {
    for (const pattern of ds.patterns) {
      validatePattern(pattern);
    }
  }

  if (ds.rules && Array.isArray(ds.rules)) {
    for (const rule of ds.rules) {
      validateRule(rule);
    }
  }

  return manifest as DetectorPackManifest;
}

/**
 * Validate detector definition
 */
function validateDetector(detector: unknown): void {
  if (!detector || typeof detector !== 'object') {
    throw new Error('Invalid detector: not an object');
  }

  const d = detector as Record<string, unknown>;

  if (!d.id || typeof d.id !== 'string') {
    throw new Error('Invalid detector: missing or invalid id');
  }

  if (!d.name || typeof d.name !== 'string') {
    throw new Error('Invalid detector: missing or invalid name');
  }

  if (!d.detect || typeof d.detect !== 'object') {
    throw new Error(`Invalid detector ${d.id}: missing detect method`);
  }
}

/**
 * Validate pattern definition
 */
function validatePattern(pattern: unknown): void {
  if (!pattern || typeof pattern !== 'object') {
    throw new Error('Invalid pattern: not an object');
  }

  const p = pattern as Record<string, unknown>;

  if (!p.id || typeof p.id !== 'string') {
    throw new Error('Invalid pattern: missing or invalid id');
  }

  if (!p.match) {
    throw new Error(`Invalid pattern ${p.id}: missing match`);
  }
}

/**
 * Validate rule definition
 */
function validateRule(rule: unknown): void {
  if (!rule || typeof rule !== 'object') {
    throw new Error('Invalid rule: not an object');
  }

  const r = rule as Record<string, unknown>;

  if (!r.id || typeof r.id !== 'string') {
    throw new Error('Invalid rule: missing or invalid id');
  }

  if (!r.when || typeof r.when !== 'object') {
    throw new Error(`Invalid rule ${r.id}: missing when conditions`);
  }

  if (!r.then || typeof r.then !== 'object') {
    throw new Error(`Invalid rule ${r.id}: missing then actions`);
  }

  const then = r.then as Record<string, unknown>;
  if (then.severity && !VALID_SEVERITIES.includes(then.severity as string)) {
    throw new Error(
      `Invalid rule ${r.id}: severity must be one of: ${VALID_SEVERITIES.join(', ')} (got: ${
        then.severity
      })`,
    );
  }
}

/**
 * Create a new pack registry
 */
export function createPackRegistry(): PackRegistry {
  const packs = new Map<string, LoadedPack>();

  return {
    packs,

    getAllDetectors(): DetectorDefinition[] {
      const detectors: DetectorDefinition[] = [];
      for (const pack of packs.values()) {
        if (pack.enabled) {
          detectors.push(...pack.manifest.diffesense.detectors);
        }
      }
      return detectors;
    },

    getAllPatterns(): PatternDefinition[] {
      const patterns: PatternDefinition[] = [];
      for (const pack of packs.values()) {
        if (pack.enabled && pack.manifest.diffesense.patterns) {
          patterns.push(...pack.manifest.diffesense.patterns);
        }
      }
      return patterns;
    },

    getAllRules(): RulePreset[] {
      const rules: RulePreset[] = [];
      for (const pack of packs.values()) {
        if (pack.enabled && pack.manifest.diffesense.rules) {
          rules.push(...pack.manifest.diffesense.rules);
        }
      }
      return rules;
    },
  };
}

/**
 * Load packs from config
 */
export async function loadPacksFromConfig(
  packNames: string[],
  registry: PackRegistry,
): Promise<void> {
  if (packNames.length > 0) {
    console.warn('⚠️  Loading external detector packs. Packs execute code during analysis.');
    console.warn('   Only use packs from trusted sources.');
  }

  for (const packName of packNames) {
    let manifest: DetectorPackManifest | null = null;

    if (packName.startsWith('@') || !packName.includes('/')) {
      manifest = await loadPackFromPackage(packName);
    }

    if (!manifest) {
      manifest = await loadPackFromPath(packName);
    }

    if ((!manifest && packName.endsWith('.yml')) || packName.endsWith('.yaml')) {
      manifest = await loadPackFromYaml(packName);
    }

    if (manifest) {
      registry.packs.set(manifest.name, {
        manifest,
        source: packName.startsWith('@') ? 'npm' : 'local',
        sourcePath: packName,
        enabled: true,
      });
      console.log(`✓ Loaded detector pack: ${manifest.name} v${manifest.version}`);
    } else {
      console.warn(`⚠️  Could not load pack: ${packName}`);
    }
  }
}

/**
 * Get built-in detector pack definitions
 */
export function getBuiltinPacks(): DetectorPackManifest[] {
  return [
    {
      name: '@diffesense/detector-pack-react',
      version: '1.0.0',
      description: 'React-specific detectors for DiffeSense',
      diffesenseVersion: '>=1.0.0',
      diffesense: {
        type: 'detector-pack',
        frameworks: ['react'],
        detectors: [
          {
            id: 'react-effect-deps',
            name: 'React Effect Dependencies',
            description: 'Detects useEffect without dependencies or with problematic deps',
            frameworks: ['react'],
            filePatterns: ['**/*.tsx', '**/*.jsx'],
            detect: {
              type: 'regex',
              patterns: [
                {
                  id: 'effect-no-deps',
                  pattern: 'useEffect\\s*\\([^,]+\\)',
                  signal: {
                    id: 'react-effect-no-deps',
                    title: 'useEffect without dependencies',
                    reason: 'useEffect without dependency array runs on every render',
                    class: 'behavioral',
                    category: 'side-effect',
                    severity: 'warn',
                    confidence: 'high',
                    weight: 0.6,
                    actions: [
                      { type: 'check', text: 'Add dependency array or use useLayoutEffect' },
                    ],
                  },
                },
              ],
            },
          },
        ],
        patterns: [],
        rules: [],
      },
    },

    {
      name: '@diffesense/detector-pack-node',
      version: '1.0.0',
      description: 'Node.js-specific detectors for DiffeSense',
      diffesenseVersion: '>=1.0.0',
      diffesense: {
        type: 'detector-pack',
        frameworks: ['node'],
        detectors: [
          {
            id: 'node-auth-middleware',
            name: 'Auth Middleware Changes',
            description: 'Detects changes to authentication middleware',
            frameworks: ['node'],
            filePatterns: ['**/middleware/**', '**/auth/**'],
            detect: {
              type: 'regex',
              patterns: [
                {
                  id: 'auth-check',
                  pattern: '(authenticate|authorize|isAuthenticated|checkAuth)',
                  signal: {
                    id: 'node-auth-middleware',
                    title: 'Auth middleware changed',
                    reason: 'Changes to authentication logic require careful review',
                    class: 'critical',
                    category: 'core-impact',
                    severity: 'blocker',
                    confidence: 'high',
                    weight: 0.9,
                    actions: [
                      { type: 'test', text: 'Run auth tests', command: 'npm test -- auth' },
                      { type: 'review', text: 'Request security review' },
                    ],
                  },
                },
              ],
            },
          },
        ],
        patterns: [],
        rules: [],
      },
    },
  ];
}
