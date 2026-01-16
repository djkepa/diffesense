# DiffeSense CLI Reference

Complete command-line interface documentation for DiffeSense.

---

## Table of Contents

- [Installation](#installation)
- [Basic Usage](#basic-usage)
- [Commands](#commands)
  - [analyze (default)](#analyze-default)
  - [init](#init)
  - [config check](#config-check)
  - [config print](#config-print)
  - [config init](#config-init)
  - [ci github](#ci-github)
  - [ci gitlab](#ci-gitlab)
  - [doctor](#doctor)
- [Options](#options)
  - [Scope Options](#scope-options)
  - [Profile Options](#profile-options)
  - [Output Options](#output-options)
  - [Filter Options](#filter-options)
  - [Advanced Options](#advanced-options)
- [Exit Codes](#exit-codes)
- [Examples](#examples)

---

## Installation

```bash
# Global installation
npm install -g diffesense

# Or use with npx (no installation)
npx diffesense

# Project-local installation
npm install --save-dev diffesense
```

---

## Basic Usage

```bash
# Run analysis on current branch vs main
dsense

# Use a policy pack for preset configuration
dsense --policy-pack enterprise

# Analyze with specific options
dsense analyze --commit HEAD --format markdown

# Get help
dsense --help
dsense analyze --help
```

---

## Commands

### `analyze` (default)

Analyze code changes and detect risk signals.

**Syntax:**
```bash
dsense [analyze] [options]
```

**Description:**
The main command that analyzes your code changes, detects risk signals, evaluates rules, and outputs a report. This is the default command, so `dsense` and `dsense analyze` are equivalent.

**Examples:**
```bash
# Analyze current branch vs main
dsense

# Analyze last commit
dsense --commit HEAD

# Analyze commit range
dsense --range HEAD~10..HEAD

# Analyze with React profile
dsense --profile react --format markdown
```

---

### `init`

Create a `.diffesense.yml` or `.diffesense.json` configuration file in the current directory.

**Syntax:**
```bash
dsense init [options]
```

**Options:**
- `-p, --profile <name>` - Base profile to use (default: `minimal`)
- `--pack <name>` - Policy pack: `enterprise|startup|oss` (default: `startup`)
- `--json` - Create JSON config instead of YAML
- `--force` - Overwrite existing config file

**Examples:**
```bash
# Create config with startup policy pack (default)
dsense init

# Create config with enterprise pack
dsense init --pack enterprise

# Create JSON config for OSS project
dsense init --pack oss --json

# Create config with React profile
dsense init --profile react

# Overwrite existing config
dsense init --force
```

**Output:**
Creates `.diffesense.yml` (or `.diffesense.json` with `--json`) with pre-configured settings.

---

### `packs`

List available policy packs and their configurations.

**Syntax:**
```bash
dsense packs [options]
```

**Options:**
- `--verbose` - Show detailed configuration for each pack

**Examples:**
```bash
# List all packs
dsense packs

# Show detailed configuration
dsense packs --verbose
```

**Output:**
Shows available policy packs (enterprise, startup, oss) with their fail conditions and category weights.

---

### `config check`

Validate your configuration file.

**Syntax:**
```bash
dsense config check [path]
```

**Arguments:**
- `path` (optional) - Path to config file (default: auto-detect)

**Examples:**
```bash
# Check default config
dsense config check

# Check specific config file
dsense config check .diffesense.json
dsense config check /path/to/config.yml
```

**Output:**
- ✅ Success: "Config file is valid"
- ❌ Error: Detailed validation errors with line numbers

**Exit Codes:**
- `0` - Config is valid
- `2` - Config has errors or not found

---

### `config print`

Display the effective configuration (merged from file + defaults).

**Syntax:**
```bash
dsense config print [options]
```

**Options:**
- `-c, --config <path>` - Path to config file
- `--summary` - Show summary instead of full config

**Examples:**
```bash
# Print full effective config
dsense config print

# Print config summary
dsense config print --summary

# Print specific config file
dsense config print --config .diffesense.json
```

**Output:**
Shows the complete configuration that will be used, including defaults and overrides.

---

### `config init`

Alias for `dsense init`. Creates a configuration file.

**Syntax:**
```bash
dsense config init [options]
```

See [`init`](#init) for details.

---

### `ci github`

Generate GitHub Actions workflow configuration.

**Syntax:**
```bash
dsense ci github [options]
```

**Options:**
- `--simple` - Generate minimal workflow (no PR comments, no status checks)
- `-o, --output <path>` - Output file path (default: stdout)

**Examples:**
```bash
# Generate full workflow to stdout
dsense ci github

# Generate and save to file
dsense ci github --output .github/workflows/diffesense.yml

# Generate simple workflow
dsense ci github --simple

# Generate simple workflow to file
dsense ci github --simple -o .github/workflows/diffesense.yml
```

**Full Workflow Features:**
- ✅ PR comment with analysis results (idempotent updates)
- ✅ Commit status check
- ✅ Artifact upload (JSON + Markdown reports)
- ✅ Proper exit code handling

**Simple Workflow Features:**
- ✅ Basic analysis
- ✅ PR comment (no updates)
- ⚠️ No status check
- ⚠️ No artifacts

---

### `ci gitlab`

Generate GitLab CI configuration.

**Syntax:**
```bash
dsense ci gitlab [options]
```

**Options:**
- `--simple` - Generate minimal job
- `-o, --output <path>` - Output file path (default: stdout)

**Examples:**
```bash
# Generate full job to stdout
dsense ci gitlab

# Generate and save to file
dsense ci gitlab --output .gitlab-ci-diffesense.yml

# Generate simple job
dsense ci gitlab --simple
```

**Full Job Features:**
- ✅ Merge request detection
- ✅ JSON + Markdown reports
- ✅ Artifact upload
- ✅ Exit code handling

**Simple Job Features:**
- ✅ Basic analysis
- ✅ Markdown output
- ⚠️ No artifacts

---

### `doctor`

Check environment and configuration health.

**Syntax:**
```bash
dsense doctor
```

**Checks:**
- ✅ Git installation and version
- ✅ Git repository status
- ✅ Current branch and commits
- ✅ Configuration file validity
- ✅ Node.js version (recommends v18+)
- ✅ Package manager detection (npm, yarn, pnpm, bun)
- ✅ Test framework detection (jest, vitest, mocha, etc.)

**Examples:**
```bash
dsense doctor
```

**Output:**
```
DiffeSense Doctor
=================

Checking git...
  ✓ git version 2.40.0

Checking git repository...
  ✓ In a git repository
  ✓ Current branch: feature/my-feature
  ✓ Repository has commits

Checking configuration...
  ✓ Config found: .diffesense.yml
  ✓ Config is valid

Checking Node.js...
  ✓ Node.js v18.16.0

Checking package manager...
  ✓ Detected: npm

Checking test framework...
  ✓ Detected: jest

✓ All checks passed!
  Run `dsense` to analyze your changes.
```

**Exit Codes:**
- `0` - All checks passed
- `1` - Some checks failed

---

### `suppress`

Manage signal suppressions to reduce noise and handle known issues.

**Syntax:**
```bash
dsense suppress <subcommand> [options]
```

**Subcommands:**

#### `suppress add <signalId>`

Add a new suppression for a signal.

```bash
# Suppress large-file signals for 7 days
dsense suppress add large-file --reason "Generated code" --expires-in 7d

# Suppress deep-nesting in a specific directory
dsense suppress add deep-nesting --file "src/generated/**" --expires-in 30d

# Security signals require a reason
dsense suppress add sec-xss-innerHTML --reason "Sanitized with DOMPurify"
```

**Options:**
- `-f, --file <glob>` - File glob pattern to limit suppression
- `-r, --reason <text>` - Reason for suppression (required for security signals)
- `-e, --expires-in <duration>` - Expiration duration (e.g., 7d, 30d, 2w)
- `--scope <scope>` - Scope: `local` (default) or `global`
- `--force` - Force update existing suppression

**Security Signal Friction:**
- Signals starting with `sec-`, `auth-`, `xss-`, etc. require a `--reason`
- If no `--expires-in` is provided, security signals default to 30 days

#### `suppress remove <signalId>`

Remove an existing suppression.

```bash
dsense suppress remove large-file
dsense suppress remove deep-nesting --file "src/generated/**"
```

#### `suppress list`

List all active and expired suppressions.

```bash
dsense suppress list
dsense suppress list --scope local
dsense suppress list --scope global
```

#### `suppress clean`

Remove expired suppressions.

```bash
dsense suppress clean
dsense suppress clean --scope local
```

**Storage:**
- **Local:** `.diffesense/suppressions.json` (gitignored)
- **Global:** `~/.config/diffesense/suppressions.json`

**Precedence rules:**
- Local suppressions override global suppressions
- More specific globs win over less specific ones
- Order of application: global first, then local (local wins)

**Duration formats:**
- `7d` - 7 days
- `2w` - 2 weeks
- `1m` - 1 month (30 days)
- `24h` - 24 hours

**Glob semantics (minimatch):**
File patterns follow [minimatch](https://github.com/isaacs/minimatch) semantics:
- `src/generated/**` - all files under src/generated/
- `**/*.test.ts` - all .test.ts files anywhere
- `packages/*/src/**` - monorepo pattern
- `**/*.config.{js,ts}` - config files with multiple extensions

**Example workflow:**
```bash
# Suppress a known false positive
dsense suppress add large-file --file "src/generated/**" --reason "Auto-generated" --expires-in 30d

# Check what's suppressed
dsense suppress list

# After 30 days, clean up expired suppressions
dsense suppress clean
```

---

## Options

### Scope Options

Control what code changes to analyze.

#### `-s, --scope <mode>`

Analysis scope mode.

**Values:**
- `working` - Analyze uncommitted changes (working tree)
- `staged` - Analyze staged files (git add)
- `branch` - Compare current branch vs base branch
- `commit` - Analyze specific commit (requires `--commit`)
- `range` - Analyze commit range (requires `--range`)

**Default behavior (auto-detection):**
When no `--scope` is provided, DiffeSense automatically detects:
1. If there are staged changes → uses `staged`
2. Else if there are uncommitted changes → uses `working`
3. Otherwise → uses `branch`

**Examples:**
```bash
# Auto-detect (recommended)
dsense

# Uncommitted changes (local development)
dsense --scope working

# Staged files (pre-commit hook)
dsense --scope staged

# Branch mode (CI/PR)
dsense --scope branch

# Specific commit
dsense --scope commit --commit HEAD

# Commit range
dsense --scope range --range HEAD~5..HEAD
```

---

#### `-b, --base <branch>`

Base branch for comparison (used with `branch` scope).

**Default:** `main` (auto-detects `main` or `master`)

**Examples:**
```bash
# Compare with develop
dsense --base develop

# Compare with custom branch
dsense --base release/v2.0
```

**Environment Variables:**
DiffeSense auto-detects base branch from CI environment:
- `GITHUB_BASE_REF` (GitHub Actions)
- `CI_MERGE_REQUEST_TARGET_BRANCH_NAME` (GitLab CI)
- `BITBUCKET_PR_DESTINATION_BRANCH` (Bitbucket)
- `SYSTEM_PULLREQUEST_TARGETBRANCH` (Azure DevOps)
- `CHANGE_TARGET` (Jenkins)
- `DIFFESENSE_BASE` (custom)

---

#### `--commit <sha>`

Analyze a specific commit.

**Format:** Git commit SHA or ref (e.g., `HEAD`, `abc123`, `HEAD~5`)

**Examples:**
```bash
# Last commit
dsense --commit HEAD

# Specific commit
dsense --commit abc123def

# 5 commits ago
dsense --commit HEAD~5

# Tagged commit
dsense --commit v1.0.0
```

**Note:** Automatically sets `--scope commit`

---

#### `-r, --range <range>`

Analyze a range of commits.

**Format:** Git range syntax (e.g., `HEAD~5..HEAD`, `abc123..def456`)

**Examples:**
```bash
# Last 5 commits
dsense --range HEAD~5..HEAD

# Last 10 commits
dsense --range HEAD~10..HEAD

# Between two commits
dsense --range abc123..def456

# Between branches
dsense --range main..feature-branch
```

**Note:** Automatically sets `--scope range`

---

### Policy Pack Options

Pre-configured policy packs for different use cases.

#### `--policy-pack <name>`

Policy pack to use for fail conditions and category weights.

**Built-in Policy Packs:**

| Pack | Fail Threshold | Best For |
|------|----------------|----------|
| `startup` | Risk ≥ 8.8, 1 CRITICAL | Fast-moving teams (default) |
| `enterprise` | Risk ≥ 7.5, 1 CRITICAL or 2+ HIGH | Strict CI gates |
| `oss` | Risk ≥ 9.2, 1 CRITICAL | Open-source projects |

**Examples:**
```bash
# Use startup pack (default)
dsense --policy-pack startup

# Use enterprise pack for strict CI
dsense --policy-pack enterprise --format markdown --details

# Use OSS pack for open-source
dsense --policy-pack oss
```

**Pack Features:**

**Startup (default):**
- Fail threshold: 8.8
- Catches critical risks without noise
- Maintainability weight: 0.8×

**Enterprise:**
- Fail threshold: 7.5
- Fails on 1 CRITICAL or 2+ HIGH
- Security weight: 1.3×
- Details enabled by default

**OSS:**
- Fail threshold: 9.2
- Focus on supply-chain security
- Maintainability weight: 0.6×

📖 **[Full Policy Pack Documentation →](POLICY_PACKS.md)**

---

### Profile Options

Control detection rules and thresholds.

#### `-p, --profile <name>`

Risk profile to use.

**Built-in Profiles:**

| Profile | Description | Use Case |
|---------|-------------|----------|
| `minimal` | Baseline rules, low noise | Default, general projects |
| `strict` | Stricter thresholds | High-stakes projects |
| `react` | React-optimized patterns | React applications |
| `vue` | Vue-optimized patterns | Vue applications |
| `angular` | Angular-optimized patterns | Angular applications |
| `backend` | Node.js backend patterns | Express, Fastify, NestJS |

**Examples:**
```bash
# Minimal profile (default)
dsense --profile minimal

# Strict profile
dsense --profile strict

# React profile
dsense --profile react

# Backend profile
dsense --profile backend
```

**Profile Differences:**

**Minimal:**
- Fail threshold: 7.0
- Warn threshold: 5.0
- Focus: Critical signals only

**Strict:**
- Fail threshold: 5.0
- Warn threshold: 3.0
- Focus: All signals

**React:**
- Detects: Hooks, effects, lifecycle, context
- Special rules: Effect dependencies, hook rules
- Fail threshold: 6.0

**Vue:**
- Detects: Composition API, reactivity, lifecycle
- Special rules: Ref/reactive usage, computed deps
- Fail threshold: 6.0

**Angular:**
- Detects: Decorators, DI, lifecycle, observables
- Special rules: Change detection, zone.js
- Fail threshold: 6.0

**Backend:**
- Detects: Database, network, auth, middleware
- Special rules: Error handling, async patterns
- Fail threshold: 7.0

---

#### `-d, --detector <type>`

Detector type (usually auto-detected).

**Values:**
- `auto` (default) - Auto-detect from package.json
- `generic` - Generic JS/TS patterns
- `react` - React-specific patterns
- `vue` - Vue-specific patterns
- `angular` - Angular-specific patterns
- `node` - Node.js-specific patterns

**Examples:**
```bash
# Auto-detect (default)
dsense --detector auto

# Force React detector
dsense --detector react

# Generic detector only
dsense --detector generic
```

**Note:** Usually not needed; auto-detection works well.

---

### Output Options

Control output format and verbosity.

#### `-f, --format <type>`

Output format.

**Values:**
- `console` (default) - Human-readable console output with colors
- `markdown` - Markdown format for PR comments
- `json` - Machine-readable JSON

**Examples:**
```bash
# Console output (default)
dsense --format console

# Markdown for PR comments
dsense --format markdown

# JSON for CI/CD
dsense --format json
```

**Console Output:**
```
DIFFESENSE
============================================================

DiffeSense 1.1.0  •  risk gate for code changes
Repo: my-app  |  CWD: /home/user/my-app
Scope: branch  |  Base: main  |  Range: main...HEAD
Profile: minimal  |  Detector: auto
Config: defaults  |  Schema: 1.0.0

Summary
- Changed: 8 files  |  Analyzed: 8  |  Ignored: 0  |  Warnings: 0
- Highest risk: 8.9/10  |  Blockers: 1  |  Exit code: 1

Top 3 risky files
Risk  Sev       Blast  File                      Why (top reasons)
8.9   CRITICAL  12     src/auth/middleware.ts    auth-boundary; async patterns
7.2   HIGH      6      src/api/client.ts         error handling weak
6.8   HIGH      3      src/components/Cart.tsx   heavy component
```

**Markdown Output:**
```markdown
# 🔍 DiffeSense 1.1.0 — Risk Analysis

**Status:** ❌ FAIL (exit code: 1)

## 📊 Top 3 Files

| File | Risk | Signals | Impact |
|------|------|---------|--------|
| 🔴 src/auth/middleware.ts | 8.9 | auth-boundary, async | 12 deps |
| 🔴 src/payments/stripe.ts | 7.8 | payment-logic, error-handling | 8 deps |
| 🟡 src/components/Checkout.tsx | 6.9 | react-effect-no-deps, async | 3 deps |
```

**JSON Output:**
```json
{
  "summary": {
    "exitCode": 1,
    "status": "FAIL",
    "highestRisk": 8.9,
    "filesAnalyzed": 8,
    "filesChanged": 8,
    "signalsDetected": 12
  },
  "files": [
    {
      "path": "src/auth/middleware.ts",
      "riskScore": 8.9,
      "signals": [...]
    }
  ]
}
```

---

#### `-n, --top <n>`

Number of top issues to show. The default is 5 to match the **Noise Budget** principle (MAX 5 items in TOP RISKS).

**Default:** `5` (or policy pack default if using `--policy-pack`)

**Examples:**
```bash
# Show top 5 (default)
dsense --top 5

# Show top 3 for minimal output
dsense --top 3

# Show top 10 for more context
dsense -n 10
```

---

#### `--show-all`

Show all issues, not just top N.

**Examples:**
```bash
# Show all issues
dsense --show-all

# Show all issues with markdown
dsense --show-all --format markdown
```

---

#### `-q, --quiet`

Only output when issues are found (useful for CI).

**Examples:**
```bash
# Quiet mode
dsense --quiet

# Quiet mode in pre-commit hook
dsense --scope staged --quiet
```

**Behavior:**
- No output if no issues found (exit code 0)
- Normal output if issues found (exit code 1)
- Error output on failures (exit code 2)

---

### Filter Options

Control which files to analyze.

#### `--all`

Analyze all files in the project (not just changed files).

**Examples:**
```bash
# Analyze all files
dsense --all

# Analyze all files with strict profile
dsense --all --profile strict
```

**Warning:** Can be slow on large projects.

---

#### `--include-tests`

Include test files in analysis.

**Default:** Test files are excluded

**Examples:**
```bash
# Include test files
dsense --include-tests

# Include tests with strict profile
dsense --include-tests --profile strict
```

**Test File Patterns:**
- `*.test.js`, `*.test.ts`, `*.spec.js`, `*.spec.ts`
- `__tests__/**`, `__mocks__/**`
- `*.test.jsx`, `*.test.tsx`, `*.spec.jsx`, `*.spec.tsx`

---

#### `--include-config`

Include configuration files in analysis.

**Default:** Config files are excluded

**Examples:**
```bash
# Include config files
dsense --include-config
```

**Config File Patterns:**
- `*config.js`, `*config.ts`
- `.eslintrc.*`, `.prettierrc.*`
- `jest.config.*`, `vite.config.*`
- `webpack.config.*`, `rollup.config.*`

---

#### `-c, --config <path>`

Path to custom configuration file.

**Default:** Auto-detects `.diffesense.yml` or `.diffesense.json`

**Examples:**
```bash
# Use custom config
dsense --config custom-config.yml

# Use JSON config
dsense --config .diffesense.json

# Use config from different directory
dsense --config /path/to/config.yml
```

---

### Advanced Options

Advanced features for debugging and optimization.

#### `-t, --threshold <n>`

Override fail threshold (0-10).

**Default:** Profile-specific (usually 7.0)

**Examples:**
```bash
# Fail on risk > 5.0
dsense --threshold 5.0

# Fail on risk > 8.0
dsense --threshold 8.0

# Never fail (for reporting only)
dsense --threshold 10.0
```

---

#### `--no-blast-radius`

Skip blast radius calculation (faster analysis).

**Examples:**
```bash
# Skip blast radius
dsense --no-blast-radius

# Quick check without dependencies
dsense --no-blast-radius --quiet
```

**Performance:**
- With blast radius: ~2-5s for 50 files
- Without blast radius: ~1-2s for 50 files

---

#### `--context <n>`

Number of context lines around changes.

**Default:** `5`

**Examples:**
```bash
# More context
dsense --context 10

# Less context
dsense --context 3

# No context
dsense --context 0
```

**Note:** More context = better signal detection but slower analysis.

---

#### `--no-diff-focus`

Analyze entire files, not just changed lines.

**Default:** Only changed lines are analyzed

**Examples:**
```bash
# Analyze entire files
dsense --no-diff-focus

# Useful for full file audits
dsense --no-diff-focus --all
```

---

#### `--no-class-scoring`

Use simple scoring instead of class-based.

**Default:** Class-based scoring (maintainability signals capped)

**Examples:**
```bash
# Simple scoring
dsense --no-class-scoring
```

**Difference:**
- **Class-based:** Maintainability signals can't block alone
- **Simple:** All signals contribute equally

---

#### `--determinism-check`

Output input/output hashes for determinism verification.

**Examples:**
```bash
# Check determinism
dsense --determinism-check

# Check determinism with JSON
dsense --determinism-check --format json
```

**Output:**
```
DETERMINISM CHECK
=================
Input Hash:  abc123def456
Output Hash: 789ghi012jkl

Run the same command twice to verify determinism.
If hashes match → deterministic ✓
```

**Use Case:** Verify that same input produces same output across:
- Different machines
- Different OS (Windows/Linux/macOS)
- Different runs

---

#### `--explain-ignore`

Explain why files are ignored.

**Examples:**
```bash
# Explain ignored files
dsense --explain-ignore
```

---

#### `--details`

Show detailed analysis with evidence and risk breakdown. In detailed mode, **all files** are shown (not limited by `--top`).

**Default:** Compact output (TOP 5 files with decision + why)

**Examples:**
```bash
# Detailed output with evidence
dsense --details

# Detailed output with commit analysis
dsense --commit HEAD --details

# Detailed output with markdown
dsense --details --format markdown
```

**Detailed Output Includes:**
- **Signal Summary** (high-impact, advisory, filtered counts)
- **Both risk scores**: Raw risk score + Gated score (used for PASS/FAIL)
- Per-file signal breakdown with confidence gate stats
- Evidence (all signals with line numbers)
- Risk breakdown (critical, behavioral, maintainability)
- Blast radius and changed lines
- Full action recommendations

**Use Case:** When you need to understand **why** a file is flagged, **what** specific signals were detected, and **how** the confidence gate is filtering noise.

**Output:**
```
IGNORED FILES EXPLANATION
=========================

File: package-lock.json
  Reason: Matches default ignore pattern
  Pattern: **/package-lock.json
  Source: Built-in defaults
  Override: Add to config: ignore.patterns: ["!**/package-lock.json"]

File: src/utils/helper.test.ts
  Reason: Test file (excluded by default)
  Pattern: **/*.test.ts
  Source: Built-in defaults
  Override: Use --include-tests flag
```

---

## Exit Codes

DiffeSense uses standard exit codes for CI/CD integration.

| Code | Status | Meaning | CI Behavior |
|------|--------|---------|-------------|
| **0** | ✅ PASS | No blockers found | Pipeline continues, merge allowed |
| **1** | ❌ FAIL | Blockers detected | Pipeline fails, merge blocked |
| **2** | ⚠️ ERROR | Internal error or invalid config | Pipeline fails, investigate |

**Examples:**

```bash
# Exit code 0 (PASS)
dsense
echo $?  # 0

# Exit code 1 (FAIL)
dsense --threshold 3.0  # High-risk changes detected
echo $?  # 1

# Exit code 2 (ERROR)
dsense --config invalid.yml  # Config error
echo $?  # 2
```

**CI Integration:**

```yaml
# GitHub Actions
- name: DiffeSense
  run: dsense --format markdown
  # Fails job if exit code = 1 or 2

# GitLab CI
script:
  - dsense --format json
  # Fails pipeline if exit code = 1 or 2
```

---

## Examples

### Basic Workflows

```bash
# 1. Analyze current branch
dsense

# 2. Analyze before committing
dsense --scope staged

# 3. Analyze last commit
dsense --commit HEAD

# 4. Analyze last 10 commits
dsense --range HEAD~10..HEAD
```

### CI/CD Workflows

```bash
# GitHub Actions
dsense --base ${{ github.event.pull_request.base.ref }} --format markdown

# GitLab CI
dsense --base $CI_MERGE_REQUEST_TARGET_BRANCH_NAME --format json

# Jenkins
dsense --base ${CHANGE_TARGET} --format console
```

### Pre-commit Hook

```bash
# .husky/pre-commit
npx diffesense --scope staged --quiet
```

### Custom Profiles

```bash
# React app with strict rules
dsense --profile react --threshold 5.0

# Backend API with custom config
dsense --profile backend --config .diffesense-api.yml

# Monorepo with specific detector
dsense --detector node --include-tests
```

### Debugging

```bash
# Check environment
dsense doctor

# Validate config
dsense config check

# See effective config
dsense config print

# Explain ignored files
dsense --explain-ignore

# Check determinism
dsense --determinism-check
```

### Performance Optimization

```bash
# Quick check (no blast radius)
dsense --no-blast-radius --quiet

# Fast analysis (less context)
dsense --context 0 --no-blast-radius

# Minimal output
dsense --quiet --format json
```

### Full Analysis

```bash
# Comprehensive analysis with all features
dsense \
  --profile strict \
  --format markdown \
  --show-all \
  --include-tests \
  --determinism-check

# Full project audit
dsense \
  --all \
  --profile strict \
  --show-all \
  --format json > audit.json
```

---

## See Also

- [Public Contract](PUBLIC_CONTRACT.md) - Exit codes, determinism guarantees
- [Configuration Guide](../README.md#configuration) - Config file reference
- [Architecture](../ARCHITECTURE.md) - Internal structure
- [Testing Guide](../TESTING_GUIDE.md) - Local testing instructions

---

**Questions or Issues?**
- GitHub: https://github.com/djkepa/diffesense/issues
- Docs: https://github.com/djkepa/diffesense#readme

