import { spawnSync } from 'child_process';

export interface ChangedRange {
  startLine: number;
  endLine: number;
  type: 'added' | 'modified' | 'deleted';
  lineCount: number;
}

export interface ChangedFileDetail {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  ranges: ChangedRange[];
  totalLinesChanged: number;
  oldPath?: string;
}

export type DiffScope = 'branch' | 'staged' | 'working' | 'worktree' | 'commit' | 'range';

export interface DiffParseOptions {
  scope: DiffScope;
  base?: string;
  commit?: string;
  range?: string;
  cwd?: string;
  contextLines?: number;
}

export function parseGitDiff(options: DiffParseOptions): ChangedFileDetail[] {
  const { scope, cwd = process.cwd(), contextLines = 0 } = options;
  const base = options.base || 'main';

  let args: string[];

  switch (scope) {
    case 'branch':
      args = ['diff', `origin/${base}...HEAD`, '-U' + contextLines, '--no-color'];
      break;
    case 'staged':
      args = ['diff', '--cached', '-U' + contextLines, '--no-color'];
      break;
    case 'working':
    case 'worktree':
      args = ['diff', '-U' + contextLines, '--no-color'];
      break;
    case 'commit':
      const commitRef = options.commit || 'HEAD';
      args = ['diff', `${commitRef}^..${commitRef}`, '-U' + contextLines, '--no-color'];
      break;
    case 'range':
      if (!options.range) {
        throw new Error('Range scope requires --range option');
      }
      args = ['diff', options.range, '-U' + contextLines, '--no-color'];
      break;
  }

  const result = spawnSync('git', args, {
    encoding: 'utf-8',
    cwd,
    maxBuffer: 50 * 1024 * 1024,
  });

  if (result.status !== 0) {
    if (scope === 'branch') {
      const fallbackArgs = ['diff', `${base}...HEAD`, '-U' + contextLines, '--no-color'];
      const fallbackResult = spawnSync('git', fallbackArgs, {
        encoding: 'utf-8',
        cwd,
        maxBuffer: 50 * 1024 * 1024,
      });

      if (fallbackResult.status === 0 && fallbackResult.stdout) {
        return parseDiffOutput(fallbackResult.stdout);
      }
    }
    return [];
  }

  return parseDiffOutput(result.stdout || '');
}

function parseDiffOutput(diffOutput: string): ChangedFileDetail[] {
  const files: ChangedFileDetail[] = [];

  const fileChunks = diffOutput.split(/^diff --git /m).filter(Boolean);

  for (const chunk of fileChunks) {
    const file = parseFileChunk(chunk);
    if (file) {
      files.push(file);
    }
  }

  return files;
}

/**
 * Parse a single file's diff chunk
 */
function parseFileChunk(chunk: string): ChangedFileDetail | null {
  const lines = chunk.split('\n');

  const headerMatch = lines[0]?.match(/^a\/(.+?)\s+b\/(.+?)$/);
  if (!headerMatch) return null;

  const oldPath = headerMatch[1];
  const newPath = headerMatch[2];

  let status: ChangedFileDetail['status'] = 'modified';
  const indexLine = lines.find((l) => l.startsWith('new file mode'));
  const deleteLine = lines.find((l) => l.startsWith('deleted file mode'));
  const renameLine = lines.find((l) => l.startsWith('rename from'));

  if (indexLine) status = 'added';
  else if (deleteLine) status = 'deleted';
  else if (renameLine || oldPath !== newPath) status = 'renamed';

  const ranges: ChangedRange[] = [];

  const hunkPattern = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

  let currentLine = 0;
  let inHunk = false;
  let hunkNewStart = 0;
  let hunkNewLine = 0;
  let rangeStart = 0;
  let rangeType: ChangedRange['type'] = 'modified';

  for (const line of lines) {
    const hunkMatch = line.match(hunkPattern);

    if (hunkMatch) {
      hunkNewStart = parseInt(hunkMatch[3], 10);
      hunkNewLine = hunkNewStart;
      inHunk = true;
      rangeStart = 0;
      continue;
    }

    if (!inHunk) continue;

    if (line.startsWith('+') && !line.startsWith('+++')) {
      if (rangeStart === 0) {
        rangeStart = hunkNewLine;
        rangeType = status === 'added' ? 'added' : 'modified';
      }
      hunkNewLine++;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      if (rangeStart === 0) {
        rangeStart = hunkNewLine;
        rangeType = 'modified';
      }
    } else if (line.startsWith(' ')) {
      if (rangeStart > 0) {
        ranges.push({
          startLine: rangeStart,
          endLine: hunkNewLine - 1,
          type: rangeType,
          lineCount: hunkNewLine - rangeStart,
        });
        rangeStart = 0;
      }
      hunkNewLine++;
    }
  }

  if (rangeStart > 0) {
    ranges.push({
      startLine: rangeStart,
      endLine: Math.max(hunkNewLine - 1, rangeStart),
      type: rangeType,
      lineCount: Math.max(hunkNewLine - rangeStart, 1),
    });
  }

  if (ranges.length === 0 && status !== 'deleted') {
    ranges.push({
      startLine: 1,
      endLine: 1,
      type: status === 'added' ? 'added' : 'modified',
      lineCount: 1,
    });
  }

  const totalLinesChanged = ranges.reduce((sum, r) => sum + r.lineCount, 0);

  return {
    path: newPath,
    status,
    ranges,
    totalLinesChanged,
    oldPath: oldPath !== newPath ? oldPath : undefined,
  };
}

export function expandRangesWithContext(
  ranges: ChangedRange[],
  contextLines: number,
  maxLine: number,
): ChangedRange[] {
  if (contextLines <= 0) return ranges;

  return ranges.map((range) => ({
    ...range,
    startLine: Math.max(1, range.startLine - contextLines),
    endLine: Math.min(maxLine, range.endLine + contextLines),
    lineCount:
      Math.min(maxLine, range.endLine + contextLines) -
      Math.max(1, range.startLine - contextLines) +
      1,
  }));
}

export function mergeRanges(ranges: ChangedRange[]): ChangedRange[] {
  if (ranges.length <= 1) return ranges;

  const sorted = [...ranges].sort((a, b) => a.startLine - b.startLine);
  const merged: ChangedRange[] = [];

  let current = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];

    if (next.startLine <= current.endLine + 1) {
      current = {
        startLine: current.startLine,
        endLine: Math.max(current.endLine, next.endLine),
        type: current.type === 'added' && next.type === 'added' ? 'added' : 'modified',
        lineCount: Math.max(current.endLine, next.endLine) - current.startLine + 1,
      };
    } else {
      merged.push(current);
      current = next;
    }
  }

  merged.push(current);
  return merged;
}

export function isLineInChangedRange(lineNumber: number, ranges: ChangedRange[]): boolean {
  return ranges.some((r) => lineNumber >= r.startLine && lineNumber <= r.endLine);
}

export function getContainingRange(
  lineNumber: number,
  ranges: ChangedRange[],
): ChangedRange | null {
  return ranges.find((r) => lineNumber >= r.startLine && lineNumber <= r.endLine) || null;
}

export function calculateChangeDensity(totalLinesChanged: number, totalLines: number): number {
  if (totalLines === 0) return 1;
  return Math.min(totalLinesChanged / totalLines, 1);
}

export function isTrivialChange(detail: ChangedFileDetail, fileContent: string): boolean {
  if (detail.totalLinesChanged <= 3) {
    const lines = fileContent.split('\n');
    let meaningfulChanges = 0;

    for (const range of detail.ranges) {
      for (let i = range.startLine - 1; i < range.endLine && i < lines.length; i++) {
        const line = lines[i]?.trim() || '';

        if (
          line === '' ||
          line.startsWith('//') ||
          line.startsWith('/*') ||
          line.startsWith('*') ||
          line.startsWith('import ') ||
          (line.startsWith('export ') && !line.includes('function') && !line.includes('class'))
        ) {
          continue;
        }

        meaningfulChanges++;
      }
    }

    return meaningfulChanges === 0;
  }

  return false;
}
