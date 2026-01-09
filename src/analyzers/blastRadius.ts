import * as fs from 'fs';
import * as path from 'path';

export interface BlastRadiusResult {
  totalDependents: number;
  directDependents: string[];
  indirectDependents: string[];
  confidence: 'high' | 'medium' | 'low';
  confidenceReason?: string;
}

export interface DependencyGraph {
  dependents: Map<string, Set<string>>;

  dependencies: Map<string, Set<string>>;
}

export function buildDependencyGraph(rootPath: string, files: string[]): DependencyGraph {
  const dependents = new Map<string, Set<string>>();
  const dependencies = new Map<string, Set<string>>();

  for (const filePath of files) {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(rootPath, filePath);

    if (!fs.existsSync(fullPath)) continue;

    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const imports = extractImports(content);
      const relativePath = path.relative(rootPath, fullPath);

      dependencies.set(relativePath, new Set());

      for (const imp of imports) {
        const resolvedImport = resolveImport(imp, filePath, rootPath);
        if (resolvedImport) {
          dependencies.get(relativePath)?.add(resolvedImport);

          if (!dependents.has(resolvedImport)) {
            dependents.set(resolvedImport, new Set());
          }
          dependents.get(resolvedImport)?.add(relativePath);
        }
      }
    } catch {}
  }

  return { dependents, dependencies };
}

export function calculateBlastRadiusFromGraph(
  filePath: string,
  graph: DependencyGraph,
): BlastRadiusResult {
  const normalizedPath = filePath.replace(/\\/g, '/');
  const directDeps = graph.dependents.get(normalizedPath) || new Set();

  const allDependents = new Set<string>();
  const queue = [...directDeps];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    allDependents.add(current);

    const transitive = graph.dependents.get(current);
    if (transitive) {
      for (const dep of transitive) {
        if (!visited.has(dep)) {
          queue.push(dep);
        }
      }
    }
  }

  const directArr = [...directDeps];
  const indirectArr = [...allDependents].filter((d) => !directDeps.has(d));

  const confidence: 'high' | 'medium' | 'low' = 'medium';
  const confidenceReason =
    'Regex-based import resolution (may miss path aliases and barrel exports)';

  return {
    totalDependents: allDependents.size,
    directDependents: directArr,
    indirectDependents: indirectArr,
    confidence,
    confidenceReason,
  };
}

export function calculateBlastRadius(
  filePath: string,
  allFiles: Array<{ path: string; imports?: string[] }>,
): BlastRadiusResult {
  const normalizedPath = normalizePath(filePath);
  const directDependents: string[] = [];

  for (const file of allFiles) {
    if (file.path === filePath) continue;

    const imports = file.imports || [];
    for (const imp of imports) {
      const resolvedImp = normalizePath(imp);
      if (resolvedImp.includes(normalizedPath) || normalizedPath.includes(resolvedImp)) {
        directDependents.push(file.path);
        break;
      }
    }
  }

  return {
    totalDependents: directDependents.length,
    directDependents,
    indirectDependents: [],
    confidence: 'low' as const,
    confidenceReason: 'Simplified import matching (no transitive analysis)',
  };
}

export function getBlastRadiusConfidenceDescription(confidence: 'high' | 'medium' | 'low'): string {
  switch (confidence) {
    case 'high':
      return 'Full TypeScript-aware resolution with path aliases';
    case 'medium':
      return 'Regex-based import resolution (may miss some edge cases)';
    case 'low':
      return 'Simplified matching (no transitive analysis)';
  }
}

export function extractImports(content: string): string[] {
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

function resolveImport(importPath: string, fromFile: string, rootPath: string): string | null {
  if (!importPath.startsWith('.')) return null;

  const fromDir = path.dirname(fromFile);
  let resolved = path.join(fromDir, importPath);

  if (resolved.startsWith(rootPath)) {
    resolved = path.relative(rootPath, resolved);
  }

  resolved = resolved.replace(/\\/g, '/');

  const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js'];
  for (const ext of extensions) {
    const withExt = resolved + ext;
    const fullPath = path.join(rootPath, withExt);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      return withExt;
    }
  }

  return resolved;
}

function normalizePath(p: string): string {
  return p
    .replace(/\\/g, '/')
    .replace(/\.(ts|tsx|js|jsx)$/, '')
    .replace(/\/index$/, '');
}
