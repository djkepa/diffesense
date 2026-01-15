import { spawnSync } from 'child_process';
import * as path from 'path';
import { shouldIgnore, buildIgnoreList, IgnoreConfig } from '../core/ignore';

export type DiffScope = 'branch' | 'staged' | 'worktree' | 'commit' | 'range';

export interface DiffOptions {
  scope: DiffScope;
  base?: string;
  commit?: string;
  range?: string;
  cwd?: string;
  ignoreConfig?: IgnoreConfig;
}

export interface ChangedFile {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
}

export {
  parseGitDiff,
  ChangedFileDetail,
  ChangedRange,
  expandRangesWithContext,
  mergeRanges,
  isLineInChangedRange,
  isTrivialChange,
} from './diffParser';

export function getChangedFiles(options: DiffOptions): ChangedFile[] {
  const { scope, cwd = process.cwd(), ignoreConfig } = options;
  const base = options.base || detectBaseBranch(cwd);

  const sourceOptions: SourceFileOptions = {
    includeTests: ignoreConfig?.includeTests,
    includeConfig: ignoreConfig?.includeConfig,
  };

  let args: string[];

  switch (scope) {
    case 'branch':
      const remote = detectUpstreamRemote(cwd, base);
      args = ['diff', '--name-status', remote ? `${remote}/${base}...HEAD` : `${base}...HEAD`];
      break;
    case 'staged':
      args = ['diff', '--cached', '--name-status'];
      break;
    case 'worktree':
      args = ['diff', '--name-status'];
      break;
    case 'commit':
      const commitRef = options.commit || 'HEAD';
      args = ['diff', '--name-status', `${commitRef}^..${commitRef}`];
      break;
    case 'range':
      if (!options.range) {
        throw new Error('Range scope requires --range option');
      }
      args = ['diff', '--name-status', options.range];
      break;
  }

  const result = spawnSync('git', args, {
    encoding: 'utf-8',
    cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let files: ChangedFile[] = [];

  if (result.status !== 0) {
    if (scope === 'branch') {
      const fallbackArgs = ['diff', '--name-status', `${base}...HEAD`];
      const fallbackResult = spawnSync('git', fallbackArgs, {
        encoding: 'utf-8',
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      if (fallbackResult.status === 0 && fallbackResult.stdout) {
        files = parseGitNameStatus(fallbackResult.stdout, sourceOptions);
      }
    }
  } else {
    files = parseGitNameStatus(result.stdout || '', sourceOptions);
  }

  const ignorePatterns = buildIgnoreList(ignoreConfig);
  return files.filter((f) => !shouldIgnore(f.path, ignorePatterns));
}

/**
 * Detect the upstream remote for a branch
 * Returns 'origin' if it exists, otherwise checks for other common remotes
 */
function detectUpstreamRemote(cwd: string, branch: string): string | null {
  const originCheck = spawnSync('git', ['remote', 'get-url', 'origin'], {
    cwd,
    stdio: 'pipe',
  });

  if (originCheck.status === 0) {
    return 'origin';
  }

  const upstreamCheck = spawnSync('git', ['remote', 'get-url', 'upstream'], {
    cwd,
    stdio: 'pipe',
  });

  if (upstreamCheck.status === 0) {
    return 'upstream';
  }

  const remotesResult = spawnSync('git', ['remote'], {
    cwd,
    encoding: 'utf-8',
    stdio: 'pipe',
  });

  if (remotesResult.status === 0 && remotesResult.stdout) {
    const remotes = remotesResult.stdout.trim().split('\n').filter(Boolean);
    if (remotes.length > 0) {
      return remotes[0];
    }
  }

  return null;
}

export function detectBaseBranch(cwd: string = process.cwd()): string {
  const ciBase =
    process.env.GITHUB_BASE_REF ||
    process.env.CI_MERGE_REQUEST_TARGET_BRANCH_NAME ||
    process.env.BITBUCKET_PR_DESTINATION_BRANCH ||
    process.env.SYSTEM_PULLREQUEST_TARGETBRANCH ||
    process.env.CHANGE_TARGET ||
    process.env.DIFFESENSE_BASE;

  if (ciBase) return ciBase;

  const mainResult = spawnSync('git', ['rev-parse', '--verify', 'main'], {
    cwd,
    stdio: 'pipe',
  });

  if (mainResult.status === 0) {
    return 'main';
  }

  const masterResult = spawnSync('git', ['rev-parse', '--verify', 'master'], {
    cwd,
    stdio: 'pipe',
  });

  if (masterResult.status === 0) {
    return 'master';
  }

  return 'main';
}

/**
 * Parse git diff --name-status output
 * @param output - Raw git output
 * @param sourceOptions - Options for source file filtering
 * @returns Parsed changed files
 */
function parseGitNameStatus(output: string, sourceOptions: SourceFileOptions = {}): ChangedFile[] {
  const lines = output.trim().split('\n').filter(Boolean);
  const files: ChangedFile[] = [];

  for (const line of lines) {
    const parts = line.split('\t');
    const status = parts[0];

    let filePath: string;
    if (status.startsWith('R') || status.startsWith('C')) {
      filePath = parts[2] || parts[1];
    } else {
      filePath = parts.slice(1).join('\t');
    }

    if (!filePath || !isSourceFile(filePath, sourceOptions)) continue;

    files.push({
      path: filePath,
      status: parseStatus(status),
    });
  }

  return files;
}

export interface SourceFileOptions {
  includeTests?: boolean;
  includeConfig?: boolean;
}

/**
 * Check if file is a JS/TS source file
 * @param filePath - Path to check
 * @param options - Options to include tests/config files
 * @returns true if it's a source file we should analyze
 */
function isSourceFile(filePath: string, options: SourceFileOptions = {}): boolean {
  const ext = path.extname(filePath).toLowerCase();
  const validExts = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

  if (!validExts.includes(ext)) return false;

  const lower = filePath.toLowerCase();
  const fileName = path.basename(lower);

  if (fileName.startsWith('.')) return false;

  if (!options.includeTests) {
    if (lower.includes('.test.') || lower.includes('.spec.')) return false;
    if (lower.includes('__tests__') || lower.includes('__mocks__')) return false;
  }

  if (!options.includeConfig) {
    if (
      fileName.match(/^config\.(js|ts|mjs|cjs)$/) ||
      fileName.match(/\.(config|rc)\.(js|ts|mjs|cjs|json|yml|yaml)$/)
    ) {
      return false;
    }
  }

  return true;
}

function parseStatus(status: string): ChangedFile['status'] {
  switch (status.charAt(0)) {
    case 'A':
      return 'added';
    case 'M':
      return 'modified';
    case 'D':
      return 'deleted';
    case 'R':
      return 'renamed';
    default:
      return 'modified';
  }
}

export function getCurrentBranch(cwd: string = process.cwd()): string | null {
  const result = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    encoding: 'utf-8',
    cwd,
  });

  if (result.status === 0 && result.stdout) {
    return result.stdout.trim();
  }
  return null;
}

export function isGitRepo(cwd: string = process.cwd()): boolean {
  const result = spawnSync('git', ['rev-parse', '--git-dir'], {
    cwd,
    stdio: 'pipe',
  });
  return result.status === 0;
}
