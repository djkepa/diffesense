import * as crypto from 'crypto';

export interface DeterminismResult {
  inputHash: string;
  outputHash: string;
  passed: boolean;
  details: {
    diffHash: string;
    configHash: string;
    filesAnalyzed: number;
    signalsDetected: number;
  };
}

export interface DeterminismInput {
  diffContent: string;
  configJson: string;
  profile: string;
  options: {
    scope: string;
    base: string;
    topN: number;
    includeTests: boolean;
    includeConfig: boolean;
  };
}

export interface DeterminismOutput {
  resultJson: string;
  filesAnalyzed: number;
  signalsDetected: number;
}

export function computeHash(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex').slice(0, 16);
}

function normalizeForHash(content: string): string {
  return content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+$/gm, '');
}

export function computeInputHash(input: DeterminismInput): string {
  const normalizedDiff = normalizeForHash(input.diffContent);
  const normalizedConfig = normalizeForHash(input.configJson);

  const normalized = JSON.stringify(
    {
      diff: normalizedDiff,
      config: normalizedConfig,
      profile: input.profile,
      options: {
        scope: input.options.scope,
        base: input.options.base,
        topN: input.options.topN,
        includeTests: input.options.includeTests,
        includeConfig: input.options.includeConfig,
      },
    },
    null,
    0,
  );

  return computeHash(normalized);
}

export function computeOutputHash(output: DeterminismOutput): string {
  try {
    const parsed = JSON.parse(output.resultJson);

    const cleaned = removeNonDeterministicFields(parsed);
    const normalized = JSON.stringify(cleaned, Object.keys(cleaned).sort());
    return computeHash(normalized);
  } catch {
    return computeHash(output.resultJson);
  }
}

function removeNonDeterministicFields(obj: Record<string, unknown>): Record<string, unknown> {
  const cleaned = { ...obj };

  delete cleaned.timestamp;

  delete cleaned.duration;
  delete cleaned.analysisTime;

  for (const key of Object.keys(cleaned)) {
    if (cleaned[key] && typeof cleaned[key] === 'object' && !Array.isArray(cleaned[key])) {
      cleaned[key] = removeNonDeterministicFields(cleaned[key] as Record<string, unknown>);
    }
  }

  return cleaned;
}

export function checkDeterminism(
  input: DeterminismInput,
  output: DeterminismOutput,
): DeterminismResult {
  const diffHash = computeHash(input.diffContent);
  const configHash = computeHash(input.configJson);
  const inputHash = computeInputHash(input);
  const outputHash = computeOutputHash(output);

  return {
    inputHash,
    outputHash,
    passed: true,
    details: {
      diffHash,
      configHash,
      filesAnalyzed: output.filesAnalyzed,
      signalsDetected: output.signalsDetected,
    },
  };
}

export function compareDeterminismResults(
  result1: DeterminismResult,
  result2: DeterminismResult,
): { match: boolean; differences: string[] } {
  const differences: string[] = [];

  if (result1.inputHash !== result2.inputHash) {
    differences.push(`Input hash mismatch: ${result1.inputHash} vs ${result2.inputHash}`);
  }

  if (result1.outputHash !== result2.outputHash) {
    differences.push(`Output hash mismatch: ${result1.outputHash} vs ${result2.outputHash}`);
  }

  if (result1.details.filesAnalyzed !== result2.details.filesAnalyzed) {
    differences.push(
      `Files analyzed mismatch: ${result1.details.filesAnalyzed} vs ${result2.details.filesAnalyzed}`,
    );
  }

  if (result1.details.signalsDetected !== result2.details.signalsDetected) {
    differences.push(
      `Signals detected mismatch: ${result1.details.signalsDetected} vs ${result2.details.signalsDetected}`,
    );
  }

  return {
    match: differences.length === 0,
    differences,
  };
}

export function formatDeterminismResult(result: DeterminismResult): string {
  const lines: string[] = [];

  lines.push('Determinism Check');
  lines.push('=================');
  lines.push(`Input Hash:  ${result.inputHash}`);
  lines.push(`Output Hash: ${result.outputHash}`);
  lines.push('');
  lines.push('Details:');
  lines.push(`  Diff Hash:        ${result.details.diffHash}`);
  lines.push(`  Config Hash:      ${result.details.configHash}`);
  lines.push(`  Files Analyzed:   ${result.details.filesAnalyzed}`);
  lines.push(`  Signals Detected: ${result.details.signalsDetected}`);

  return lines.join('\n');
}

export function formatDeterminismJson(result: DeterminismResult): string {
  return JSON.stringify(
    {
      determinism: {
        inputHash: result.inputHash,
        outputHash: result.outputHash,
        passed: result.passed,
        details: result.details,
      },
    },
    null,
    2,
  );
}
