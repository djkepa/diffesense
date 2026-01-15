#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { isGitRepo, DiffScope } from '../git/diff';
import { analyze } from '../core/analyze';
import { formatConsoleOutput } from '../output/formatters/dsConsole';
import { formatMarkdownOutput } from '../output/formatters/dsMarkdown';
import { formatJsonOutput } from '../output/formatters/dsJson';
import { DetectorProfile } from '../signals';
import { VERSION } from '../version';

const program = new Command();

program
  .name('dsense')
  .description('DiffeSense - Framework-agnostic JavaScript/TypeScript change-risk engine')
  .version(VERSION)
  .option('-s, --scope <mode>', 'Analysis scope: branch|staged|worktree|commit', 'branch')
  .option('-b, --base <branch>', 'Base branch for comparison')
  .option('-r, --range <range>', 'Git commit range (e.g. HEAD~5..HEAD or abc123..def456)')
  .option('--commit <sha>', 'Analyze specific commit (e.g. HEAD or abc123)')
  .option('-p, --profile <name>', 'Profile: minimal|strict|react|vue|angular|backend')
  .option('-d, --detector <type>', 'Detector: auto|generic|react|vue|angular|node', 'auto')
  .option('-f, --format <type>', 'Output format: console|markdown|json', 'console')
  .option('-c, --config <path>', 'Path to config file')
  .option('-t, --threshold <n>', 'Override fail threshold (0-10)', parseFloat)
  .option('-n, --top <n>', 'Show top N issues (default: 3)', parseInt)
  .option('--show-all', 'Show all issues (not just top N)')
  .option('--no-blast-radius', 'Skip blast radius calculation (faster)')
  .option('-q, --quiet', 'Only output on issues')
  .option('--all', 'Analyze all files (not just changed)')
  .option('--include-tests', 'Include test files in analysis')
  .option('--include-config', 'Include config files in analysis')
  .option('--context <n>', 'Context lines around changes (default: 5)', parseInt)
  .option('--no-diff-focus', 'Analyze entire files, not just changed lines')
  .option('--no-class-scoring', 'Use simple scoring instead of class-based')
  .option('--determinism-check', 'Output input/output hashes for determinism verification')
  .option('--explain-ignore', 'Explain why files are ignored')
  .option('--details', 'Show detailed analysis with evidence and breakdown')
  .action(async (options) => {
    try {
      await runAnalysis(options);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(2);
    }
  });

program
  .command('init')
  .description('Create .diffesense.yml config file')
  .option('-p, --profile <name>', 'Base profile', 'minimal')
  .option('--force', 'Overwrite existing config')
  .action((options) => {
    const configPath = path.join(process.cwd(), '.diffesense.yml');

    if (fs.existsSync(configPath) && !options.force) {
      console.error(chalk.yellow('Config file already exists. Use --force to overwrite.'));
      process.exit(1);
    }

    const profile = options.profile || 'minimal';
    const configContent = `# DiffeSense Configuration
# Framework-agnostic JavaScript/TypeScript change-risk engine
version: 1

# Base profile: minimal | strict | react | vue | angular | backend
profile: ${profile}

# Scope defaults
scope:
  default: branch
  base: main

# Context lines around changes for analysis (default: 5)
# contextLines: 5

# Threshold overrides
# thresholds:
#   failAboveRisk: 7.0
#   warnAboveRisk: 5.0

# Custom ignore patterns (extend defaults)
# ignore:
#   patterns:
#     - "**/legacy/**"
#     - "**/vendor/**"

# Action mappings (glob -> commands/reviewers)
# actions:
#   mapping:
#     - pattern: "**/auth/**"
#       commands:
#         - "npm test -- --grep auth"
#       reviewers:
#         - "@security-team"
#     - pattern: "**/payments/**"
#       commands:
#         - "npm test -- --grep payment"
#       reviewers:
#         - "@payments-team"

# Custom detection patterns
# customPatterns:
#   - id: my-pattern
#     name: My Custom Pattern
#     description: Detects something specific
#     match: "mySpecificFunction\\("
#     category: side-effect
#     signalType: my-custom-signal
#     weight: 0.5
#     signalClass: behavioral

# Custom rules (extend profile rules)
# rules:
#   - id: custom-rule
#     when:
#       riskGte: 7.0
#       pathMatches: ["src/critical/**"]
#       signalTypes: ["auth-boundary"]
#     then:
#       severity: blocker
#       actions:
#         - type: review
#           text: "This file requires senior review"

# Temporary exceptions
# exceptions:
#   - id: legacy-migration
#     until: "2026-06-01"
#     paths: ["src/legacy/**"]
#     reason: "Legacy code migration in progress"
`;

    fs.writeFileSync(configPath, configContent);
    console.log(`Created .diffesense.yml with profile: ${profile}`);
  });

program
  .command('check')
  .description('Validate config file (alias for: config check)')
  .option('-c, --config <path>', 'Path to config file')
  .action((options) => {
    runConfigCheck(options.config);
  });

const configCmd = program.command('config').description('Configuration management commands');

configCmd
  .command('check')
  .description('Validate config file')
  .option('-c, --config <path>', 'Path to config file')
  .action((options) => {
    runConfigCheck(options.config);
  });

configCmd
  .command('print')
  .description('Print effective configuration')
  .option('-c, --config <path>', 'Path to config file')
  .option('--summary', 'Print short summary instead of full config')
  .action((options) => {
    runConfigPrint(options.config, options.summary);
  });

configCmd
  .command('init')
  .description('Create .diffesense.yml config file')
  .option('-p, --profile <name>', 'Base profile', 'minimal')
  .option('--force', 'Overwrite existing config')
  .action((options) => {
    runConfigInit(options.profile, options.force);
  });

const ciCmd = program.command('ci').description('CI/CD integration commands');

ciCmd
  .command('github')
  .description('Generate GitHub Actions workflow')
  .option('--simple', 'Generate simple version (minimal setup)')
  .option('-o, --output <path>', 'Output path', '.github/workflows/diffesense.yml')
  .action((options) => {
    runCiGitHub(options.simple, options.output);
  });

ciCmd
  .command('gitlab')
  .description('Generate GitLab CI job')
  .option('--simple', 'Generate simple version (minimal setup)')
  .option('-o, --output <path>', 'Output path (or "stdout" to print)')
  .action((options) => {
    runCiGitLab(options.simple, options.output);
  });

program
  .command('doctor')
  .description('Check environment and configuration')
  .action(() => {
    runDoctor();
  });

program.parse();

/**
 * Run doctor command - verify environment
 */
function runDoctor(): void {
  const { execSync } = require('child_process');
  const cwd = process.cwd();
  let allGood = true;

  console.log(chalk.bold('DiffeSense Doctor'));
  console.log('=================');
  console.log('');

  console.log('Checking git...');
  try {
    const gitVersion = execSync('git --version', { encoding: 'utf-8' }).trim();
    console.log(chalk.green(`  ✓ ${gitVersion}`));
  } catch {
    console.log(chalk.red('  ✗ Git not found'));
    allGood = false;
  }

  console.log('Checking git repository...');
  if (isGitRepo(cwd)) {
    console.log(chalk.green('  ✓ In a git repository'));

    try {
      const branch = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd,
        encoding: 'utf-8',
      }).trim();
      console.log(chalk.green(`  ✓ Current branch: ${branch}`));
    } catch {
      console.log(chalk.yellow('  ⚠ Could not determine current branch'));
    }

    try {
      execSync('git rev-parse HEAD', { cwd, encoding: 'utf-8' });
      console.log(chalk.green('  ✓ Repository has commits'));
    } catch {
      console.log(chalk.yellow('  ⚠ Repository has no commits yet'));
    }
  } else {
    console.log(chalk.red('  ✗ Not in a git repository'));
    allGood = false;
  }

  console.log('Checking configuration...');
  const { findConfigFile } = require('../config/loader');
  const configPath = findConfigFile(cwd);
  if (configPath) {
    console.log(chalk.green(`  ✓ Config found: ${path.relative(cwd, configPath)}`));

    const { loadConfigFile } = require('../config');
    const result = loadConfigFile(configPath);
    if (result.valid) {
      console.log(chalk.green('  ✓ Config is valid'));
      if (result.warnings.length > 0) {
        for (const warn of result.warnings) {
          console.log(chalk.yellow(`  ⚠ ${warn}`));
        }
      }
    } else {
      console.log(chalk.red('  ✗ Config has errors'));
      allGood = false;
    }
  } else {
    console.log(chalk.yellow('  ⚠ No config file (using defaults)'));
    console.log(chalk.gray('    Run `dsense init` to create one'));
  }

  console.log('Checking Node.js...');
  const nodeVersion = process.version;
  const major = parseInt(nodeVersion.slice(1).split('.')[0], 10);
  if (major >= 18) {
    console.log(chalk.green(`  ✓ Node.js ${nodeVersion}`));
  } else {
    console.log(chalk.yellow(`  ⚠ Node.js ${nodeVersion} (recommend v18+)`));
  }

  console.log('Checking package manager...');
  const { detectPackageManager } = require('../core/testRunner');
  const pm = detectPackageManager(cwd);
  console.log(chalk.green(`  ✓ Detected: ${pm}`));

  console.log('Checking test framework...');
  const { detectTestFramework } = require('../core/testRunner');
  const tf = detectTestFramework(cwd);
  if (tf !== 'unknown') {
    console.log(chalk.green(`  ✓ Detected: ${tf}`));
  } else {
    console.log(chalk.yellow('  ⚠ No test framework detected'));
  }

  console.log('');
  if (allGood) {
    console.log(chalk.green.bold('✓ All checks passed!'));
    console.log(chalk.gray('  Run `dsense` to analyze your changes.'));
  } else {
    console.log(chalk.red.bold('✗ Some checks failed'));
    console.log(chalk.gray('  Fix the issues above and run `dsense doctor` again.'));
    process.exit(1);
  }
}

/**
 * Run config check command
 */
function runConfigCheck(configPath?: string): void {
  const { loadConfigFile, formatValidationErrors } = require('../config');
  const { findConfigFile } = require('../config/loader');
  const cwd = process.cwd();

  const targetPath = configPath
    ? path.isAbsolute(configPath)
      ? configPath
      : path.join(cwd, configPath)
    : findConfigFile(cwd);

  if (!targetPath) {
    console.error(chalk.red('No config file found'));
    console.log(chalk.gray('Run `dsense init` to create one'));
    process.exit(2);
  }

  if (!fs.existsSync(targetPath)) {
    console.error(chalk.red(`Config file not found: ${targetPath}`));
    process.exit(2);
  }

  const result = loadConfigFile(targetPath);

  if (result.valid) {
    console.log(chalk.green('✓ Config file is valid'));
    console.log(chalk.gray(`  ${targetPath}`));

    if (result.warnings.length > 0) {
      console.log('');
      console.log(chalk.yellow('Warnings:'));
      for (const warn of result.warnings) {
        console.log(chalk.yellow(`  ⚠ ${warn}`));
      }
    }
  } else {
    console.error(chalk.red('✗ Config file has errors:'));
    console.log(formatValidationErrors(result));
    process.exit(2);
  }
}

/**
 * Run config print command
 */
function runConfigPrint(configPath?: string, summary?: boolean): void {
  const { resolveConfig, printEffectiveConfig } = require('../config');
  const { printConfigSummary } = require('../config/loader');

  const { config, source, warnings } = resolveConfig({
    configPath,
    cwd: process.cwd(),
  });

  if (summary) {
    console.log(printConfigSummary(config, source));
  } else {
    console.log(printEffectiveConfig(config, source));
  }

  if (warnings.length > 0) {
    console.log('');
    console.log(chalk.yellow('Warnings:'));
    for (const warn of warnings) {
      console.log(chalk.yellow(`  ⚠ ${warn}`));
    }
  }
}

/**
 * Run config init command
 */
function runConfigInit(profile: string, force: boolean): void {
  const configPath = path.join(process.cwd(), '.diffesense.yml');

  if (fs.existsSync(configPath) && !force) {
    console.error(chalk.yellow('Config file already exists. Use --force to overwrite.'));
    process.exit(1);
  }

  const configContent = `# DiffeSense Configuration
# Framework-agnostic JavaScript/TypeScript change-risk engine
version: 1

# Base profile: minimal | strict | react | vue | angular | backend
profile: ${profile}

# Scope defaults
scope:
  default: branch
  base: main

# Context lines around changes for analysis (default: 5)
# contextLines: 5

# Threshold overrides
# thresholds:
#   fail: 7.0
#   warn: 5.0

# Top N issues to show (default: 3)
# topN: 3

# Ignore patterns (extend defaults)
# ignore:
#   - "**/legacy/**"
#   - "**/vendor/**"

# Action mappings (glob -> commands/reviewers)
# actions:
#   mapping:
#     - pattern: "**/auth/**"
#       commands:
#         - "npm test -- --grep auth"
#       reviewers:
#         - "@security-team"
#     - pattern: "**/payments/**"
#       commands:
#         - "npm test -- --grep payment"
#       reviewers:
#         - "@payments-team"

# CODEOWNERS integration (v1.1)
# ownership:
#   useCodeowners: true
#   escalateIfRiskAbove: 7.5

# Custom detection patterns
# customPatterns:
#   - id: my-pattern
#     name: My Custom Pattern
#     description: Detects something specific
#     match: "mySpecificFunction\\\\("
#     category: side-effect
#     signalType: my-custom-signal
#     weight: 0.5
#     signalClass: behavioral

# Custom rules (extend profile rules)
# rules:
#   - id: custom-rule
#     when:
#       riskGte: 7.0
#       pathMatches: ["src/critical/**"]
#       signalTypes: ["auth-boundary"]
#     then:
#       severity: blocker
#       actions:
#         - type: review
#           text: "This file requires senior review"

# Temporary exceptions
# exceptions:
#   - id: legacy-migration
#     until: "2026-06-01"
#     paths: ["src/legacy/**"]
#     reason: "Legacy code migration in progress"
`;

  fs.writeFileSync(configPath, configContent);
  console.log(chalk.green(`✓ Created .diffesense.yml with profile: ${profile}`));
}

/**
 * Run CI GitHub command - generate GitHub Actions workflow
 */
function runCiGitHub(simple: boolean, outputPath: string): void {
  const template = simple ? getGitHubActionSimple() : getGitHubActionFull();

  if (outputPath === 'stdout') {
    console.log(template);
    return;
  }

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, template);
  console.log(chalk.green(`✓ Created GitHub Actions workflow: ${outputPath}`));
  console.log(chalk.gray('  Commit and push to enable DiffeSense in your PRs'));
}

/**
 * Run CI GitLab command - generate GitLab CI config
 */
function runCiGitLab(simple: boolean, outputPath?: string): void {
  const template = simple ? getGitLabCISimple() : getGitLabCIFull();

  if (!outputPath || outputPath === 'stdout') {
    console.log(template);
    console.log(chalk.gray('\n# Add the above to your .gitlab-ci.yml'));
    return;
  }

  fs.writeFileSync(outputPath, template);
  console.log(chalk.green(`✓ Created GitLab CI config: ${outputPath}`));
}

/**
 * GitHub Actions workflow (full version)
 */
function getGitHubActionFull(): string {
  return `# DiffeSense GitHub Action
# Change-risk analysis for pull requests

name: DiffeSense Risk Analysis

on:
  pull_request:
    types: [opened, synchronize, reopened]
    branches: [main, master, develop]

permissions:
  contents: read
  pull-requests: write
  statuses: write

jobs:
  risk-analysis:
    name: Analyze Change Risk
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          ref: \${{ github.event.pull_request.head.sha }}

      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install DiffeSense
        run: npm install -g diffesense

      - name: Run Analysis
        id: diffesense
        run: |
          dsense --base \${{ github.event.pull_request.base.ref }} --format json > report.json || true
          dsense --base \${{ github.event.pull_request.base.ref }} --format markdown > report.md || true

          EXIT_CODE=\$(cat report.json | jq -r '.summary.exitCode // 0')
          RISK=\$(cat report.json | jq -r '.summary.highestRisk // 0')
          echo "exit_code=\$EXIT_CODE" >> \$GITHUB_OUTPUT
          echo "risk=\$RISK" >> \$GITHUB_OUTPUT

      - name: Post PR Comment
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const MARKER = '<!-- diffesense-comment -->';
            let report = fs.readFileSync('report.md', 'utf8');
            
            if (!report.includes(MARKER)) {
              report = MARKER + '\\n' + report;
            }
            const { data: comments } = await github.rest.issues.listComments({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
            });
            
            const existing = comments.find(c => c.body.includes(MARKER));
            if (existing) {
              await github.rest.issues.updateComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                comment_id: existing.id,
                body: report
              });
              console.log('Updated existing DiffeSense comment');
            } else {
              await github.rest.issues.createComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: context.issue.number,
                body: report
              });
              console.log('Created new DiffeSense comment');
            }

      - name: Set Status
        uses: actions/github-script@v7
        with:
          script: |
            const state = '\${{ steps.diffesense.outputs.exit_code }}' === '1' ? 'failure' : 'success';
            await github.rest.repos.createCommitStatus({
              owner: context.repo.owner,
              repo: context.repo.repo,
              sha: context.payload.pull_request.head.sha,
              state,
              description: 'Risk: \${{ steps.diffesense.outputs.risk }}/10',
              context: 'DiffeSense'
            });

      - uses: actions/upload-artifact@v4
        with:
          name: diffesense-reports
          path: report.*
`;
}

/**
 * GitHub Actions workflow (simple version)
 */
function getGitHubActionSimple(): string {
  return `# DiffeSense GitHub Action (Simple)
name: DiffeSense

on:
  pull_request:
    branches: [main, master]

permissions:
  contents: read
  pull-requests: write

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: '18'

      - run: npm install -g diffesense

      - name: Analyze
        run: dsense --base \${{ github.event.pull_request.base.ref }} --format markdown > report.md

      - name: Comment
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const report = fs.readFileSync('report.md', 'utf8');
            github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body: report
            });
`;
}

/**
 * GitLab CI config (full version)
 */
function getGitLabCIFull(): string {
  return `# DiffeSense GitLab CI
# Add to your .gitlab-ci.yml

diffesense:
  image: node:18-alpine
  stage: test
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
  before_script:
    - npm install -g diffesense
  script:
    - git fetch origin $CI_MERGE_REQUEST_TARGET_BRANCH_NAME 2>/dev/null || true
    - dsense --base $CI_MERGE_REQUEST_TARGET_BRANCH_NAME --format json > report.json || true
    - dsense --base $CI_MERGE_REQUEST_TARGET_BRANCH_NAME --format markdown > report.md || true
    - cat report.md
    - |
      EXIT_CODE=$(cat report.json | jq -r '.summary.exitCode // 0')
      if [ "$EXIT_CODE" = "1" ]; then
        echo "High-risk changes detected"
      fi
  artifacts:
    paths:
      - report.json
      - report.md
    when: always
  allow_failure: true
`;
}

/**
 * GitLab CI config (simple version)
 */
function getGitLabCISimple(): string {
  return `# DiffeSense GitLab CI (Simple)
diffesense:
  image: node:18-alpine
  stage: test
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
  before_script:
    - npm install -g diffesense
  script:
    - git fetch origin $CI_MERGE_REQUEST_TARGET_BRANCH_NAME 2>/dev/null || true
    - dsense --base $CI_MERGE_REQUEST_TARGET_BRANCH_NAME --format markdown
  allow_failure: true
`;
}

/**
 * CLI Analysis Options
 */
interface CLIAnalysisOptions {
  scope?: string;
  base?: string;
  commit?: string;
  range?: string;
  profile?: string;
  detector?: string;
  format?: string;
  config?: string;
  threshold?: number;
  top?: number;
  showAll?: boolean;
  blastRadius?: boolean;
  quiet?: boolean;
  all?: boolean;
  includeTests?: boolean;
  includeConfig?: boolean;
  context?: number;
  diffFocus?: boolean;
  classScoring?: boolean;
  determinismCheck?: boolean;
  explainIgnore?: boolean;
  details?: boolean;
}

/**
 * CLI Analysis result (for backwards compatibility)
 */
export interface CliAnalysisResult {
  output: string;
  exitCode: 0 | 1 | 2;
  summary: {
    changedCount: number;
    analyzedCount: number;
    highestRisk: number;
    blockerCount: number;
    warningCount: number;
  };
}

/**
 * Main analysis function - thin wrapper around core analyze()
 */
async function performAnalysis(options: CLIAnalysisOptions): Promise<CliAnalysisResult> {
  const cwd = process.cwd();
  const format = options.format || 'console';
  const quiet = options.quiet || false;
  const determinismCheck = options.determinismCheck || false;
  const explainIgnoreFlag = options.explainIgnore || false;

  if (explainIgnoreFlag) {
    const { getChangedFiles } = require('../git/diff');
    const { explainIgnoreMultiple, formatIgnoreExplanations } = require('../core/ignore');

    let scope: DiffScope = (options.scope || 'branch') as DiffScope;
    if (options.commit) scope = 'commit';
    else if (options.range) scope = 'range';

    const changedFiles = getChangedFiles({
      scope,
      base: options.base || 'main',
      commit: options.commit,
      range: options.range,
      cwd,
      ignoreConfig: { includeTests: true, includeConfig: true },
    });

    const ignoreConfig = {
      includeTests: options.includeTests || false,
      includeConfig: options.includeConfig || false,
    };

    const allPaths = changedFiles.map((f: { path: string }) => f.path);
    const explanations = explainIgnoreMultiple(allPaths, ignoreConfig);

    return {
      output: formatIgnoreExplanations(explanations),
      exitCode: 0,
      summary: {
        changedCount: allPaths.length,
        analyzedCount: 0,
        highestRisk: 0,
        blockerCount: 0,
        warningCount: 0,
      },
    };
  }

  const result = await analyze({
    cwd,
    scope: options.scope as DiffScope,
    base: options.base,
    commit: options.commit,
    range: options.range,
    profile: options.profile,
    detector: options.detector as DetectorProfile,
    configPath: options.config,
    threshold: options.threshold,
    includeTests: options.includeTests,
    includeConfig: options.includeConfig,
    contextLines: options.context,
    skipBlastRadius: options.blastRadius === false,
    fullFileAnalysis: options.diffFocus === false,
    classBasedScoring: options.classScoring,
    analyzeAll: options.all,
  });

  if (!result.success) {
    return {
      output: chalk.red(result.error || 'Analysis failed'),
      exitCode: 2,
      summary: {
        changedCount: 0,
        analyzedCount: 0,
        highestRisk: 0,
        blockerCount: 0,
        warningCount: 0,
      },
    };
  }

  if (result.summary.analyzedCount === 0) {
    const msg =
      result.summary.changedCount === 0 ? 'No source files changed' : 'No analyzable files found';
    return {
      output: quiet ? '' : msg,
      exitCode: 0,
      summary: {
        changedCount: result.summary.changedCount,
        analyzedCount: 0,
        highestRisk: 0,
        blockerCount: 0,
        warningCount: 0,
      },
    };
  }

  if (quiet && result.summary.blockerCount === 0 && result.summary.warningCount === 0) {
    return {
      output: '',
      exitCode: 0,
      summary: {
        changedCount: result.summary.changedCount,
        analyzedCount: result.summary.analyzedCount,
        highestRisk: result.summary.highestRisk,
        blockerCount: 0,
        warningCount: 0,
      },
    };
  }

  const outputConfig = {
    showAll: options.showAll || false,
    topN: options.top || 3,
    details: options.details || false,
    quiet,
  };

  let output: string;

  switch (format) {
    case 'markdown':
      output = formatMarkdownOutput(result, outputConfig);
      break;
    case 'json':
      output = formatJsonOutput(result, outputConfig);
      break;
    default:
      output = formatConsoleOutput(result, outputConfig);
  }

  if (determinismCheck) {
    const {
      checkDeterminism,
      formatDeterminismResult,
      formatDeterminismJson,
    } = require('../core/determinism');

    const { execSync } = require('child_process');
    let diffContent = '';
    try {
      if (result.meta.scope === 'staged') {
        diffContent = execSync('git diff --cached', { cwd, encoding: 'utf-8' });
      } else if (result.meta.scope === 'worktree') {
        diffContent = execSync('git diff', { cwd, encoding: 'utf-8' });
      } else {
        diffContent = execSync(`git diff ${result.meta.base}...HEAD`, { cwd, encoding: 'utf-8' });
      }
    } catch {
      diffContent = '';
    }

    const jsonOutput = formatJsonOutput(result, outputConfig);
    const signalsDetected = result.files.reduce((sum, f) => sum + f.evidence.length, 0);

    const deterministmResult = checkDeterminism(
      {
        diffContent,
        configJson: JSON.stringify(result.config),
        profile: result.meta.profile,
        options: {
          scope: result.meta.scope,
          base: result.meta.base,
          topN: outputConfig.topN,
          includeTests: options.includeTests || false,
          includeConfig: options.includeConfig || false,
        },
      },
      {
        resultJson: jsonOutput,
        filesAnalyzed: result.summary.analyzedCount,
        signalsDetected,
      },
    );

    output += '\n';
    if (format === 'json') {
      output += formatDeterminismJson(deterministmResult);
    } else {
      output += formatDeterminismResult(deterministmResult);
    }
  }

  return {
    output,
    exitCode: result.exitCode,
    summary: {
      changedCount: result.summary.changedCount,
      analyzedCount: result.summary.analyzedCount,
      highestRisk: result.summary.highestRisk,
      blockerCount: result.summary.blockerCount,
      warningCount: result.summary.warningCount,
    },
  };
}

/**
 * Main CLI entry point - calls performAnalysis and handles exit
 */
async function runAnalysis(options: CLIAnalysisOptions): Promise<void> {
  try {
    const result = await performAnalysis(options);
    if (result.output) {
      console.log(result.output);
    }
    process.exit(result.exitCode);
  } catch (error) {
    console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
    process.exit(2);
  }
}

export { performAnalysis };
