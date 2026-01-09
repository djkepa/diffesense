import * as fs from 'fs';
import * as path from 'path';

export type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun';
export type TestFramework = 'jest' | 'vitest' | 'mocha' | 'ava' | 'tap' | 'unknown';

export interface TestRunnerConfig {
  packageManager: PackageManager;
  testFramework: TestFramework;
  baseCommand: string;
  isMonorepo: boolean;
  workspaceRoot?: string;
}

export interface TestCommand {
  command: string;
  target: string;
  description: string;
  confidence: number;
}

export function detectPackageManager(repoRoot: string = process.cwd()): PackageManager {
  if (fs.existsSync(path.join(repoRoot, 'bun.lockb'))) {
    return 'bun';
  }
  if (fs.existsSync(path.join(repoRoot, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }
  if (fs.existsSync(path.join(repoRoot, 'yarn.lock'))) {
    return 'yarn';
  }
  if (fs.existsSync(path.join(repoRoot, 'package-lock.json'))) {
    return 'npm';
  }

  return 'npm';
}

export function getRunCommand(pm: PackageManager): string {
  switch (pm) {
    case 'yarn':
      return 'yarn';
    case 'pnpm':
      return 'pnpm';
    case 'bun':
      return 'bun';
    case 'npm':
    default:
      return 'npm run';
  }
}

export function getExecCommand(pm: PackageManager): string {
  switch (pm) {
    case 'yarn':
      return 'yarn';
    case 'pnpm':
      return 'pnpm exec';
    case 'bun':
      return 'bunx';
    case 'npm':
    default:
      return 'npx';
  }
}

export function detectTestFramework(repoRoot: string = process.cwd()): TestFramework {
  const packageJsonPath = path.join(repoRoot, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    return 'unknown';
  }

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    if (allDeps['vitest']) {
      return 'vitest';
    }
    if (allDeps['jest']) {
      return 'jest';
    }
    if (allDeps['mocha']) {
      return 'mocha';
    }
    if (allDeps['ava']) {
      return 'ava';
    }
    if (allDeps['tap']) {
      return 'tap';
    }

    const testScript = packageJson.scripts?.test || '';
    if (testScript.includes('vitest')) {
      return 'vitest';
    }
    if (testScript.includes('jest')) {
      return 'jest';
    }
    if (testScript.includes('mocha')) {
      return 'mocha';
    }

    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Check if repository is a monorepo
 */
export function detectMonorepo(repoRoot: string = process.cwd()): boolean {
  const packageJsonPath = path.join(repoRoot, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    return false;
  }

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    if (packageJson.workspaces) {
      return true;
    }

    if (fs.existsSync(path.join(repoRoot, 'pnpm-workspace.yaml'))) {
      return true;
    }

    if (fs.existsSync(path.join(repoRoot, 'lerna.json'))) {
      return true;
    }

    if (fs.existsSync(path.join(repoRoot, 'nx.json'))) {
      return true;
    }

    if (fs.existsSync(path.join(repoRoot, 'turbo.json'))) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

export function detectTestRunner(repoRoot: string = process.cwd()): TestRunnerConfig {
  const packageManager = detectPackageManager(repoRoot);
  const testFramework = detectTestFramework(repoRoot);
  const isMonorepo = detectMonorepo(repoRoot);

  let baseCommand: string;

  if (testFramework === 'unknown') {
    baseCommand = `${getRunCommand(packageManager)} test`;
  } else {
    baseCommand = `${getExecCommand(packageManager)} ${testFramework}`;
  }

  return {
    packageManager,
    testFramework,
    baseCommand,
    isMonorepo,
    workspaceRoot: repoRoot,
  };
}

export function generateTestCommand(filePath: string, config: TestRunnerConfig): TestCommand {
  const fileName = path.basename(filePath);
  const fileDir = path.dirname(filePath);
  const fileNameWithoutExt = fileName.replace(/\.(ts|tsx|js|jsx)$/, '');

  let testPattern: string;
  let confidence = 0.7;

  if (isTestFile(filePath)) {
    testPattern = filePath;
    confidence = 0.95;
  } else {
    const possibleTestFiles = [
      path.join(fileDir, `${fileNameWithoutExt}.test.ts`),
      path.join(fileDir, `${fileNameWithoutExt}.test.tsx`),
      path.join(fileDir, `${fileNameWithoutExt}.spec.ts`),
      path.join(fileDir, `${fileNameWithoutExt}.spec.tsx`),
      path.join(fileDir, '__tests__', `${fileNameWithoutExt}.test.ts`),
      path.join(fileDir, '__tests__', `${fileNameWithoutExt}.test.tsx`),
      path.join('tests', `${fileNameWithoutExt}.test.ts`),
      path.join('test', `${fileNameWithoutExt}.test.ts`),
    ];

    const existingTestFile = possibleTestFiles.find((f) =>
      fs.existsSync(path.join(config.workspaceRoot || '', f)),
    );

    if (existingTestFile) {
      testPattern = existingTestFile;
      confidence = 0.9;
    } else {
      testPattern = `**/${fileNameWithoutExt}*.{test,spec}.{ts,tsx,js,jsx}`;
      confidence = 0.5;
    }
  }

  let command: string;

  switch (config.testFramework) {
    case 'jest':
      command = `${config.baseCommand} --testPathPattern="${testPattern}"`;
      break;
    case 'vitest':
      command = `${config.baseCommand} run ${testPattern}`;
      break;
    case 'mocha':
      command = `${config.baseCommand} "${testPattern}"`;
      break;
    default:
      command = `${config.baseCommand} -- ${testPattern}`;
  }

  return {
    command,
    target: testPattern,
    description: `Run tests for ${fileName}`,
    confidence,
  };
}

export function generateModuleTestCommand(dirPath: string, config: TestRunnerConfig): TestCommand {
  const dirName = path.basename(dirPath);

  let command: string;
  let testPattern = `${dirPath}/**/*.{test,spec}.{ts,tsx,js,jsx}`;

  switch (config.testFramework) {
    case 'jest':
      command = `${config.baseCommand} --testPathPattern="${dirPath}"`;
      break;
    case 'vitest':
      command = `${config.baseCommand} run ${dirPath}`;
      break;
    case 'mocha':
      command = `${config.baseCommand} "${testPattern}"`;
      break;
    default:
      command = `${config.baseCommand} -- ${dirPath}`;
  }

  return {
    command,
    target: dirPath,
    description: `Run tests for ${dirName} module`,
    confidence: 0.8,
  };
}

export function isTestFile(filePath: string): boolean {
  const fileName = path.basename(filePath);

  const normalizedPath = filePath.replace(/\\/g, '/');

  return (
    fileName.includes('.test.') ||
    fileName.includes('.spec.') ||
    fileName.includes('__tests__') ||
    normalizedPath.includes('/__tests__/') ||
    normalizedPath.includes('/test/') ||
    normalizedPath.includes('/tests/') ||
    normalizedPath.startsWith('test/') ||
    normalizedPath.startsWith('tests/')
  );
}

export function getFallbackTestCommand(config: TestRunnerConfig): string {
  return `${getRunCommand(config.packageManager)} test`;
}

export interface TestMapping {
  pattern: string;
  command: string;
  priority: number;
}

export const DEFAULT_TEST_MAPPINGS: TestMapping[] = [
  {
    pattern: '**/auth/**',
    command: 'npm test -- --grep auth',
    priority: 10,
  },
  {
    pattern: '**/api/**',
    command: 'npm test -- --grep api',
    priority: 10,
  },
  {
    pattern: '**/components/**',
    command: 'npm test -- --grep components',
    priority: 5,
  },
  {
    pattern: '**/utils/**',
    command: 'npm test -- --grep utils',
    priority: 5,
  },
  {
    pattern: '**/hooks/**',
    command: 'npm test -- --grep hooks',
    priority: 5,
  },
];

/**
 * Find matching test command from mappings
 */
export function findTestMapping(filePath: string, mappings: TestMapping[]): TestMapping | null {
  const { minimatch } = require('minimatch');

  const sorted = [...mappings].sort((a, b) => b.priority - a.priority);

  for (const mapping of sorted) {
    if (minimatch(filePath, mapping.pattern, { dot: true })) {
      return mapping;
    }
  }

  return null;
}

export function getTestCommandForFile(
  filePath: string,
  config: TestRunnerConfig,
  customMappings: TestMapping[] = [],
): TestCommand {
  const allMappings = [...customMappings, ...DEFAULT_TEST_MAPPINGS];
  const mapping = findTestMapping(filePath, allMappings);

  if (mapping) {
    return {
      command: mapping.command.replace('{file}', filePath),
      target: filePath,
      description: `Run tests matching pattern: ${mapping.pattern}`,
      confidence: 0.85,
    };
  }

  return generateTestCommand(filePath, config);
}
