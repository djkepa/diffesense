import * as fs from 'fs';
import * as path from 'path';
import { detectSignals, DetectorProfile, DetectorOptions } from '../signals';
import { summarizeSignals, Signal, SignalSummary, ChangedRange } from '../signals/types';
import {
  classifySignals,
  calculateClassBasedRiskScore,
  getReasonChain,
  RiskScoreBreakdown,
} from '../core/signalClasses';

export interface AnalyzedFile {
  path: string;
  riskScore: number;
  blastRadius: number;
  signals: Signal[];
  summary: SignalSummary;
  evidence: Evidence[];
  riskReasons: string[];
  imports: string[];
  loc: number;
  changedLines?: number;
  isDiffAnalysis?: boolean;
  signalTypes: string[];
  riskBreakdown?: RiskScoreBreakdown;
}

export interface Evidence {
  line?: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
  tag?: string;
}

export interface ProjectAnalysis {
  rootPath: string;
  analyzedFiles: AnalyzedFile[];
  dependencyGraph: Map<string, string[]>;
  isDiffAnalysis: boolean;
}

export interface ChangedFileDetail {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  ranges: ChangedRange[];
  totalLinesChanged: number;
  oldPath?: string;
}

export interface AnalyzeOptions {
  rootPath: string;
  includePatterns?: string[];
  excludePatterns?: string[];
  files?: string[];
  detectorProfile?: DetectorProfile;
  changedFileDetails?: ChangedFileDetail[];
  contextLines?: number;
  useClassBasedScoring?: boolean;
}

export async function analyzeProject(options: AnalyzeOptions): Promise<ProjectAnalysis> {
  const {
    rootPath,
    detectorProfile = 'auto',
    changedFileDetails,
    contextLines = 5,
    useClassBasedScoring = true,
  } = options;
  const filesToAnalyze = options.files || findSourceFiles(rootPath, options);

  const changedRangesMap = new Map<string, ChangedRange[]>();
  if (changedFileDetails) {
    for (const detail of changedFileDetails) {
      const normalizedPath = detail.path.replace(/\\/g, '/');
      changedRangesMap.set(normalizedPath, detail.ranges);
    }
  }

  const analyzedFiles: AnalyzedFile[] = [];
  const dependencyGraph = new Map<string, string[]>();
  const isDiffAnalysis = changedFileDetails !== undefined && changedFileDetails.length > 0;

  for (const filePath of filesToAnalyze) {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(rootPath, filePath);

    if (!fs.existsSync(fullPath)) continue;

    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const relativePath = path.relative(rootPath, fullPath).replace(/\\/g, '/');

      const changedRanges = changedRangesMap.get(relativePath);

      const detectorOptions: DetectorOptions = {
        changedRanges,
        contextLines,
      };

      const signals = detectSignals(content, relativePath, detectorProfile, detectorOptions);

      let riskScore: number;
      let riskBreakdown: RiskScoreBreakdown | undefined;
      let riskReasons: string[];

      if (useClassBasedScoring) {
        const classified = classifySignals(signals);
        riskBreakdown = calculateClassBasedRiskScore(classified);
        riskScore = riskBreakdown.total;
        riskReasons = getReasonChain(classified, riskBreakdown);
      } else {
        const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
        riskScore = Math.min(totalWeight * 2, 10);
        riskReasons = generateRiskReasons(signals);
      }

      const summary = summarizeSignals(signals);

      const imports = extractImports(content);

      const evidence = signals.map((s) => ({
        line: s.lines[0],
        message: s.reason,
        severity: signalToSeverity(s.weight),
        tag: `${s.category}:${s.id}`,
      }));

      const signalTypes = [...new Set(signals.map((s) => s.id))];

      const changedLines = changedRanges
        ? changedRanges.reduce((sum, r) => sum + r.lineCount, 0)
        : content.split('\n').length;

      analyzedFiles.push({
        path: relativePath,
        riskScore,
        blastRadius: 0,
        signals,
        summary,
        evidence,
        riskReasons,
        imports,
        loc: content.split('\n').length,
        changedLines,
        isDiffAnalysis: changedRanges !== undefined,
        signalTypes,
        riskBreakdown,
      });

      dependencyGraph.set(relativePath, imports);
    } catch {}
  }

  return {
    rootPath,
    analyzedFiles,
    dependencyGraph,
    isDiffAnalysis,
  };
}

function signalToSeverity(weight: number): 'error' | 'warning' | 'info' {
  if (weight >= 0.7) return 'error';
  if (weight >= 0.4) return 'warning';
  return 'info';
}

function generateRiskReasons(signals: Signal[]): string[] {
  const reasons: string[] = [];

  const byCategory = new Map<string, Signal[]>();
  for (const signal of signals) {
    const existing = byCategory.get(signal.category) || [];
    existing.push(signal);
    byCategory.set(signal.category, existing);
  }

  const complexity = byCategory.get('complexity') || [];
  if (complexity.length > 0) {
    reasons.push(`Complexity: ${complexity.length} indicator(s)`);
  }

  const sideEffects = byCategory.get('side-effect') || [];
  if (sideEffects.length > 0) {
    const ids = [...new Set(sideEffects.map((e) => e.id))];
    reasons.push(`Side-effects: ${ids.slice(0, 3).join(', ')}`);
  }

  const async = byCategory.get('async') || [];
  if (async.length > 0) {
    reasons.push(`Async patterns: ${async.length} detected`);
  }

  const signature = byCategory.get('signature') || [];
  if (signature.length > 0) {
    reasons.push(`Exports/signatures: ${signature.length} found`);
  }

  const changedLineSignals = signals.filter((s) => s.inChangedRange).length;
  if (changedLineSignals > 0) {
    reasons.push(`Changed lines: ${changedLineSignals} signal(s) in diff`);
  }

  return reasons;
}

function extractImports(content: string): string[] {
  const imports: string[] = [];

  const es6Pattern = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/g;
  let match;
  while ((match = es6Pattern.exec(content)) !== null) {
    imports.push(match[1]);
  }

  const cjsPattern = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = cjsPattern.exec(content)) !== null) {
    imports.push(match[1]);
  }

  const dynamicPattern = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = dynamicPattern.exec(content)) !== null) {
    imports.push(match[1]);
  }

  return imports.filter((imp) => imp.startsWith('.') || imp.startsWith('/'));
}

function findSourceFiles(rootPath: string, options: AnalyzeOptions): string[] {
  const files: string[] = [];
  const excludePatterns = options.excludePatterns || [
    'node_modules',
    'dist',
    'build',
    '.git',
    'coverage',
    '__tests__',
    '__mocks__',
  ];

  function walk(dir: string): void {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(rootPath, fullPath);

        if (excludePatterns.some((p) => relativePath.includes(p))) continue;

        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile() && isAnalyzableFile(entry.name)) {
          files.push(relativePath);
        }
      }
    } catch {}
  }

  walk(rootPath);
  return files;
}

function isAnalyzableFile(fileName: string): boolean {
  const ext = path.extname(fileName).toLowerCase();
  const validExts = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

  if (!validExts.includes(ext)) return false;

  const lower = fileName.toLowerCase();

  if (lower.includes('.test.') || lower.includes('.spec.')) return false;

  if (lower.startsWith('.')) return false;
  if (lower.includes('config')) return false;

  return true;
}

export { calculateBlastRadius, BlastRadiusResult } from './blastRadius';
