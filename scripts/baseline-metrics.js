#!/usr/bin/env node

/**
 * DiffeSense Baseline Metrics Script
 *
 * Measures key performance and quality metrics for DiffeSense.
 * Used to track progress and validate improvements.
 *
 * Usage:
 *   node scripts/baseline-metrics.js                    # Run on current repo
 *   node scripts/baseline-metrics.js --repos repos.json # Run on multiple repos
 *   node scripts/baseline-metrics.js --output results.json
 *
 * Metrics collected:
 *   - TTFR (Time To First Result)
 *   - Total runtime
 *   - Number of signals detected
 *   - Number of files analyzed
 *   - TOP N items count
 *   - Exit code
 *   - Memory usage
 */

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const DEFAULT_RUNS = 3;
const TIMEOUT_MS = 120000;

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    repos: null,
    output: null,
    runs: DEFAULT_RUNS,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--repos' && args[i + 1]) {
      options.repos = args[++i];
    } else if (args[i] === '--output' && args[i + 1]) {
      options.output = args[++i];
    } else if (args[i] === '--runs' && args[i + 1]) {
      options.runs = parseInt(args[++i], 10);
    } else if (args[i] === '--verbose' || args[i] === '-v') {
      options.verbose = true;
    }
  }

  return options;
}

/**
 * Run DiffeSense and collect metrics
 */
async function runDiffeSense(repoPath, options = {}) {
  const dsensePath = path.join(__dirname, '..', 'dist', 'cli', 'dsense.js');
  const startTime = Date.now();
  const startMemory = process.memoryUsage();

  return new Promise((resolve) => {
    const args = [
      dsensePath,
      '--format',
      'json',
      '--scope',
      options.scope || 'branch',
      '--base',
      options.base || 'main',
    ];

    if (options.policyPack) {
      args.push('--policy-pack', options.policyPack);
    }

    if (options.analyzeAll) {
      args.push('--all');
    }

    const proc = spawn('node', args, {
      cwd: repoPath,
      timeout: TIMEOUT_MS,
      env: { ...process.env, FORCE_COLOR: '0' },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      const endTime = Date.now();
      const runtime = endTime - startTime;

      let result = null;
      let parseError = null;

      try {
        const jsonMatch = stdout.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        parseError = e.message;
      }

      resolve({
        success: code === 0 || code === 1,
        exitCode: code,
        runtime,
        ttfr: runtime,
        result,
        parseError,
        stderr: stderr.trim(),
        memoryUsed: process.memoryUsage().heapUsed - startMemory.heapUsed,
      });
    });

    proc.on('error', (err) => {
      resolve({
        success: false,
        exitCode: -1,
        runtime: Date.now() - startTime,
        ttfr: Date.now() - startTime,
        result: null,
        parseError: err.message,
        stderr: '',
        memoryUsed: 0,
      });
    });
  });
}

/**
 * Extract metrics from DiffeSense result
 */
function extractMetrics(runResult) {
  const metrics = {
    success: runResult.success,
    exitCode: runResult.exitCode,
    runtime: runResult.runtime,
    ttfr: runResult.ttfr,
    memoryUsed: runResult.memoryUsed,
    parseError: runResult.parseError,

    filesAnalyzed: 0,
    filesChanged: 0,
    signalsTotal: 0,
    highestRisk: 0,
    blockerCount: 0,
    warningCount: 0,
    infoCount: 0,
    signalsByConfidence: { high: 0, medium: 0, low: 0 },
    signalsByClass: { critical: 0, behavioral: 0, maintainability: 0 },
  };

  if (!runResult.result) {
    return metrics;
  }

  const r = runResult.result;

  if (r.summary) {
    metrics.filesAnalyzed = r.summary.analyzedCount || 0;
    metrics.filesChanged = r.summary.changedCount || 0;
    metrics.highestRisk = r.summary.highestRisk || 0;
    metrics.blockerCount = r.summary.blockerCount || 0;
    metrics.warningCount = r.summary.warningCount || 0;
    metrics.infoCount = r.summary.infoCount || 0;
  }

  if (r.files && Array.isArray(r.files)) {
    for (const file of r.files) {
      if (file.evidence && Array.isArray(file.evidence)) {
        metrics.signalsTotal += file.evidence.length;
      }
      if (file.signalTypes && Array.isArray(file.signalTypes)) {
      }
    }
  }

  return metrics;
}

/**
 * Run multiple iterations and calculate statistics
 */
async function runBenchmark(repoPath, options, numRuns) {
  const runs = [];

  console.log(`  Running ${numRuns} iterations...`);

  for (let i = 0; i < numRuns; i++) {
    const result = await runDiffeSense(repoPath, options);
    runs.push(extractMetrics(result));
    process.stdout.write(`    Run ${i + 1}/${numRuns}: ${result.runtime}ms\n`);
  }

  const runtimes = runs.map((r) => r.runtime);
  const ttfrs = runs.map((r) => r.ttfr);

  return {
    repo: repoPath,
    options,
    runs,
    stats: {
      avgRuntime: average(runtimes),
      minRuntime: Math.min(...runtimes),
      maxRuntime: Math.max(...runtimes),
      p95Runtime: percentile(runtimes, 95),
      avgTTFR: average(ttfrs),
      minTTFR: Math.min(...ttfrs),

      filesAnalyzed: runs[0]?.filesAnalyzed || 0,
      filesChanged: runs[0]?.filesChanged || 0,
      signalsTotal: runs[0]?.signalsTotal || 0,
      highestRisk: runs[0]?.highestRisk || 0,
      blockerCount: runs[0]?.blockerCount || 0,
      warningCount: runs[0]?.warningCount || 0,

      isDeterministic: checkDeterminism(runs),
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Check if all runs produced the same results
 */
function checkDeterminism(runs) {
  if (runs.length < 2) return true;

  const first = runs[0];
  return runs.every(
    (r) =>
      r.filesAnalyzed === first.filesAnalyzed &&
      r.signalsTotal === first.signalsTotal &&
      r.highestRisk === first.highestRisk &&
      r.blockerCount === first.blockerCount,
  );
}

/**
 * Calculate average
 */
function average(arr) {
  if (arr.length === 0) return 0;
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
}

/**
 * Calculate percentile
 */
function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

/**
 * Format duration for display
 */
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Print results summary
 */
function printSummary(results) {
  console.log('\n' + '='.repeat(60));
  console.log('BASELINE METRICS SUMMARY');
  console.log('='.repeat(60));

  for (const result of results) {
    const s = result.stats;
    const status = s.isDeterministic ? '✓' : '⚠';

    console.log(`\n${status} ${result.repo}`);
    console.log('  Performance:');
    console.log(`    Avg Runtime:  ${formatDuration(s.avgRuntime)}`);
    console.log(`    Min Runtime:  ${formatDuration(s.minRuntime)}`);
    console.log(`    P95 Runtime:  ${formatDuration(s.p95Runtime)}`);
    console.log(`    Avg TTFR:     ${formatDuration(s.avgTTFR)}`);

    console.log('  Analysis:');
    console.log(`    Files Changed:  ${s.filesChanged}`);
    console.log(`    Files Analyzed: ${s.filesAnalyzed}`);
    console.log(`    Signals Total:  ${s.signalsTotal}`);
    console.log(`    Highest Risk:   ${s.highestRisk.toFixed(1)}`);

    console.log('  Results:');
    console.log(`    Blockers:  ${s.blockerCount}`);
    console.log(`    Warnings:  ${s.warningCount}`);
    console.log(`    Deterministic: ${s.isDeterministic ? 'Yes' : 'No ⚠'}`);
  }

  console.log('\n' + '-'.repeat(60));
  console.log('TARGETS vs ACTUAL');
  console.log('-'.repeat(60));

  const avgTTFR = average(results.map((r) => r.stats.avgTTFR));
  const maxSignals = Math.max(...results.map((r) => r.stats.signalsTotal));
  const allDeterministic = results.every((r) => r.stats.isDeterministic);

  console.log(
    `  TTFR Target:     < 15s   | Actual: ${formatDuration(avgTTFR)} ${
      avgTTFR < 15000 ? '✓' : '✗'
    }`,
  );
  console.log(`  Deterministic:   Yes     | Actual: ${allDeterministic ? 'Yes ✓' : 'No ✗'}`);
  console.log(`  Max Signals:     -       | Actual: ${maxSignals}`);
}

/**
 * Main function
 */
async function main() {
  const options = parseArgs();

  console.log('DiffeSense Baseline Metrics');
  console.log('===========================\n');

  const dsensePath = path.join(__dirname, '..', 'dist', 'cli', 'dsense.js');
  if (!fs.existsSync(dsensePath)) {
    console.log('Building DiffeSense...');
    try {
      execSync('npm run build', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
    } catch (e) {
      console.error('Failed to build DiffeSense');
      process.exit(1);
    }
  }

  let repos = [];

  if (options.repos) {
    const reposFile = path.resolve(options.repos);
    if (fs.existsSync(reposFile)) {
      repos = JSON.parse(fs.readFileSync(reposFile, 'utf-8'));
    } else {
      console.error(`Repos file not found: ${reposFile}`);
      process.exit(1);
    }
  } else {
    repos = [
      {
        path: process.cwd(),
        name: path.basename(process.cwd()),
        options: { scope: 'branch', base: 'main' },
      },
    ];
  }

  const results = [];

  for (const repo of repos) {
    const repoPath = repo.path || repo;
    const repoName = repo.name || path.basename(repoPath);

    console.log(`\nBenchmarking: ${repoName}`);
    console.log(`  Path: ${repoPath}`);

    if (!fs.existsSync(repoPath)) {
      console.log(`  ⚠ Path does not exist, skipping`);
      continue;
    }

    const result = await runBenchmark(repoPath, repo.options || {}, options.runs);

    result.name = repoName;
    results.push(result);
  }

  printSummary(results);

  const outputPath = options.output || path.join(__dirname, '..', 'baseline-results.json');
  const outputData = {
    timestamp: new Date().toISOString(),
    version: require('../package.json').version,
    config: {
      runs: options.runs,
    },
    results,
  };

  fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
  console.log(`\nResults saved to: ${outputPath}`);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
