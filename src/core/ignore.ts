import { minimatch } from 'minimatch';

export const ALWAYS_IGNORE: string[] = [
  '**/package-lock.json',
  '**/yarn.lock',
  '**/pnpm-lock.yaml',
  '**/composer.lock',
  '**/Gemfile.lock',
  '**/Cargo.lock',
  '**/poetry.lock',

  '**/dist/**',
  '**/build/**',
  '**/out/**',
  '**/.next/**',
  '**/.nuxt/**',
  '**/.output/**',
  '**/coverage/**',

  '**/node_modules/**',
  '**/vendor/**',
  '**/bower_components/**',

  '**/.idea/**',
  '**/.vscode/**',
  '**/.git/**',
  '**/.DS_Store',
  '**/Thumbs.db',
];

export const DEFAULT_IGNORE: string[] = [
  '**/*.generated.ts',
  '**/*.generated.js',
  '**/generated/**',
  '**/*.gen.ts',
  '**/*.gen.js',

  '**/*.d.ts',

  '**/*.min.js',
  '**/*.min.css',

  '**/*.map',
  '**/*.js.map',
  '**/*.css.map',

  '**/bundle.js',
  '**/chunk-*.js',
  '**/vendor.js',

  '**/docs/**',
  '**/documentation/**',

  '**/assets/**',
  '**/public/**',
  '**/static/**',
  '**/*.png',
  '**/*.jpg',
  '**/*.jpeg',
  '**/*.gif',
  '**/*.svg',
  '**/*.ico',
  '**/*.woff',
  '**/*.woff2',
  '**/*.ttf',
  '**/*.eot',
];

export const TEST_PATTERNS: string[] = [
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/*.test.js',
  '**/*.test.jsx',
  '**/*.spec.ts',
  '**/*.spec.tsx',
  '**/*.spec.js',
  '**/*.spec.jsx',
  '**/__tests__/**',
  '**/__mocks__/**',
  '**/test/**',
  '**/tests/**',
  '**/*.stories.ts',
  '**/*.stories.tsx',
  '**/*.stories.js',
  '**/*.stories.jsx',
];

export const CONFIG_PATTERNS: string[] = [
  '**/.*rc',
  '**/.*rc.js',
  '**/.*rc.json',
  '**/.*rc.yml',
  '**/.*rc.yaml',
  '**/*.config.js',
  '**/*.config.ts',
  '**/*.config.mjs',
  '**/tsconfig.json',
  '**/jsconfig.json',
  '**/package.json',
  '**/webpack.config.*',
  '**/vite.config.*',
  '**/rollup.config.*',
  '**/babel.config.*',
  '**/jest.config.*',
  '**/vitest.config.*',
  '**/tailwind.config.*',
  '**/postcss.config.*',
  '**/next.config.*',
  '**/nuxt.config.*',
];

export interface IgnoreConfig {
  patterns?: string[];
  includeTests?: boolean;
  includeConfig?: boolean;
  overrideDefaults?: boolean;
}

export function buildIgnoreList(config: IgnoreConfig = {}): string[] {
  const patterns: string[] = [];

  patterns.push(...ALWAYS_IGNORE);

  if (!config.overrideDefaults) {
    patterns.push(...DEFAULT_IGNORE);
  }

  if (!config.includeTests) {
    patterns.push(...TEST_PATTERNS);
  }

  if (!config.includeConfig) {
    patterns.push(...CONFIG_PATTERNS);
  }

  if (config.patterns && config.patterns.length > 0) {
    patterns.push(...config.patterns);
  }

  return patterns;
}

export function shouldIgnore(filePath: string, ignorePatterns: string[]): boolean {
  const normalizedPath = filePath.replace(/\\/g, '/');

  for (const pattern of ignorePatterns) {
    if (minimatch(normalizedPath, pattern, { dot: true })) {
      return true;
    }
  }

  return false;
}

export function filterIgnored(files: string[], ignorePatterns: string[]): string[] {
  return files.filter((file) => !shouldIgnore(file, ignorePatterns));
}

export function getIgnoreReason(filePath: string, ignorePatterns: string[]): string | null {
  const normalizedPath = filePath.replace(/\\/g, '/');

  for (const pattern of ALWAYS_IGNORE) {
    if (minimatch(normalizedPath, pattern, { dot: true })) {
      return `Matches always-ignore pattern: ${pattern}`;
    }
  }

  for (const pattern of ignorePatterns) {
    if (minimatch(normalizedPath, pattern, { dot: true })) {
      if (TEST_PATTERNS.includes(pattern)) {
        return `Test file (use --include-tests to analyze)`;
      }
      if (CONFIG_PATTERNS.includes(pattern)) {
        return `Config file (use --include-config to analyze)`;
      }
      if (DEFAULT_IGNORE.includes(pattern)) {
        return `Generated/build file: ${pattern}`;
      }
      return `Matches ignore pattern: ${pattern}`;
    }
  }

  return null;
}

export type IgnoreSource = 'ALWAYS' | 'DEFAULT' | 'TEST' | 'CONFIG' | 'USER';

export interface IgnoreExplanation {
  filePath: string;
  ignored: boolean;
  source?: IgnoreSource;
  matchedPattern?: string;
  reason?: string;
  howToInclude?: string;
}

export function explainIgnore(filePath: string, config: IgnoreConfig = {}): IgnoreExplanation {
  const normalizedPath = filePath.replace(/\\/g, '/');

  for (const pattern of ALWAYS_IGNORE) {
    if (minimatch(normalizedPath, pattern, { dot: true })) {
      return {
        filePath,
        ignored: true,
        source: 'ALWAYS',
        matchedPattern: pattern,
        reason: 'Hardcoded always-ignore (lockfiles, build output, dependencies)',
        howToInclude: 'Cannot be included - these files are never analyzed',
      };
    }
  }

  if (!config.includeTests) {
    for (const pattern of TEST_PATTERNS) {
      if (minimatch(normalizedPath, pattern, { dot: true })) {
        return {
          filePath,
          ignored: true,
          source: 'TEST',
          matchedPattern: pattern,
          reason: 'Test file (excluded by default)',
          howToInclude: 'Use --include-tests flag or set ignore.includeTests: true in config',
        };
      }
    }
  }

  if (!config.includeConfig) {
    for (const pattern of CONFIG_PATTERNS) {
      if (minimatch(normalizedPath, pattern, { dot: true })) {
        return {
          filePath,
          ignored: true,
          source: 'CONFIG',
          matchedPattern: pattern,
          reason: 'Config file (excluded by default)',
          howToInclude: 'Use --include-config flag or set ignore.includeConfig: true in config',
        };
      }
    }
  }

  if (!config.overrideDefaults) {
    for (const pattern of DEFAULT_IGNORE) {
      if (minimatch(normalizedPath, pattern, { dot: true })) {
        return {
          filePath,
          ignored: true,
          source: 'DEFAULT',
          matchedPattern: pattern,
          reason: 'Default ignore (generated files, type definitions, assets)',
          howToInclude: 'Set ignore.overrideDefaults: true in config (use with caution)',
        };
      }
    }
  }

  if (config.patterns && config.patterns.length > 0) {
    for (const pattern of config.patterns) {
      if (minimatch(normalizedPath, pattern, { dot: true })) {
        return {
          filePath,
          ignored: true,
          source: 'USER',
          matchedPattern: pattern,
          reason: 'User-defined ignore pattern in config',
          howToInclude: 'Remove pattern from ignore.patterns in .diffesense.yml',
        };
      }
    }
  }

  return {
    filePath,
    ignored: false,
  };
}

export function explainIgnoreMultiple(
  filePaths: string[],
  config: IgnoreConfig = {},
): IgnoreExplanation[] {
  return filePaths.map((fp) => explainIgnore(fp, config));
}

export function formatIgnoreExplanation(explanation: IgnoreExplanation): string {
  if (!explanation.ignored) {
    return `✓ ${explanation.filePath} - NOT IGNORED (will be analyzed)`;
  }

  const lines: string[] = [];
  lines.push(`✗ ${explanation.filePath}`);
  lines.push(`  Source:  ${explanation.source}`);
  lines.push(`  Pattern: ${explanation.matchedPattern}`);
  lines.push(`  Reason:  ${explanation.reason}`);
  lines.push(`  Include: ${explanation.howToInclude}`);

  return lines.join('\n');
}

export function formatIgnoreExplanations(explanations: IgnoreExplanation[]): string {
  const ignored = explanations.filter((e) => e.ignored);
  const notIgnored = explanations.filter((e) => !e.ignored);

  const lines: string[] = [];

  lines.push('Ignore Analysis');
  lines.push('===============');
  lines.push('');

  if (ignored.length > 0) {
    lines.push(`Ignored files (${ignored.length}):`);
    lines.push('');

    const bySource = new Map<IgnoreSource, IgnoreExplanation[]>();
    for (const exp of ignored) {
      const source = exp.source || 'USER';
      if (!bySource.has(source)) {
        bySource.set(source, []);
      }
      bySource.get(source)!.push(exp);
    }

    const sourceOrder: IgnoreSource[] = ['ALWAYS', 'DEFAULT', 'TEST', 'CONFIG', 'USER'];
    for (const source of sourceOrder) {
      const files = bySource.get(source);
      if (files && files.length > 0) {
        lines.push(`[${source}] (${files.length} files)`);
        for (const exp of files.slice(0, 10)) {
          lines.push(`  ${exp.filePath}`);
          lines.push(`    Pattern: ${exp.matchedPattern}`);
        }
        if (files.length > 10) {
          lines.push(`  ... and ${files.length - 10} more`);
        }
        lines.push('');
      }
    }
  }

  if (notIgnored.length > 0) {
    lines.push(`Analyzed files (${notIgnored.length}):`);
    for (const exp of notIgnored.slice(0, 20)) {
      lines.push(`  ✓ ${exp.filePath}`);
    }
    if (notIgnored.length > 20) {
      lines.push(`  ... and ${notIgnored.length - 20} more`);
    }
  }

  return lines.join('\n');
}
