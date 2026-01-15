<div align="center">

<img src="https://i.ibb.co/RkSKQT68/diffesense-logo.png" alt="DiffeSense Logo" width="200"/>

# DiffeSense

**Know your risk before you merge.**

DiffeSense analyzes code changes in your Pull Requests and tells you which files are risky and what to do about them. It's not a linter—it's a risk engine that helps you make better merge decisions.

[![npm version](https://img.shields.io/npm/v/diffesense.svg)](https://www.npmjs.com/package/diffesense)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/diffesense.svg)](https://nodejs.org)

</div>

---

## The Problem

You're reviewing a PR with 15 changed files. Which ones actually matter? Which ones could break production?

**Traditional tools tell you:**
- "Missing semicolon on line 42" ❌
- "Unused variable" ❌
- "Prefer const over let" ❌

**DiffeSense tells you:**
- "This auth file has 23 dependents and 4 side-effects" ✅
- "Run: `npm test -- auth`" ✅
- "Review: @security-team" ✅

---

## Quick Start

```bash
# Install
npm install -g diffesense

# Run on your PR
dsense

# That's it. Top 3 risky files, concrete actions.
```

📖 **[Complete Documentation →](docs/QUICK_START.md)**

---

## What You Get

```
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

**Key Features:**
- 🎯 **Top 3 by Default** - No noise, only what matters
- 🔇 **Smart Ignore** - Lock files, generated code automatically filtered
- ⚖️ **Signal Classes** - Maintainability issues can't block PRs alone
- 🎬 **Concrete Actions** - Not "add tests", but `npm test -- auth`
- 🔄 **CI Ready** - GitHub Actions, GitLab CI, Jenkins templates included

---

## Why DiffeSense?

### For Developers

**Before DiffeSense:**
```
You: "Is this PR safe to merge?"
Linter: "You have 47 warnings"
You: "...which ones matter?"
Linter: "¯\_(ツ)_/¯"
```

**With DiffeSense:**
```
You: "Is this PR safe to merge?"
DiffeSense: "FAIL ✖ - auth file changed, 12 dependents"
You: "What should I do?"
DiffeSense: "Run: npm test -- auth, Review: @security-team"
```

### For Teams

- ✅ **Consistent Reviews** - Same criteria every time
- ✅ **Faster Decisions** - Know what to focus on
- ✅ **Better Context** - Understand impact before merging
- ✅ **Actionable** - Clear next steps, not vague advice

---

## Installation

```bash
# Global (recommended)
npm install -g diffesense

# Project-local
npm install --save-dev diffesense

# Or use without installing
npx diffesense
```

---

## Usage

### Basic Analysis

```bash
# Analyze current branch vs main
dsense

# Analyze last commit
dsense --commit HEAD

# Analyze last 5 commits
dsense --range HEAD~5..HEAD

# Analyze staged files (pre-commit)
dsense --scope staged
```

### Different Profiles

```bash
# React app
dsense --profile react

# Vue app
dsense --profile vue

# Node.js backend
dsense --profile backend

# Strict rules
dsense --profile strict
```

### Output Formats

```bash
# Console (default, with colors)
dsense

# Markdown (for PR comments)
dsense --format markdown

# JSON (for CI/CD)
dsense --format json

# Detailed analysis
dsense --details
```

---

## CI Integration

### GitHub Actions

```bash
# Generate workflow
dsense ci github > .github/workflows/diffesense.yml
```

Or manually:

```yaml
name: DiffeSense
on:
  pull_request:
    branches: [main, master]

jobs:
  risk-analysis:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: Run DiffeSense
        run: npx diffesense --format markdown
```

### GitLab CI

```bash
# Generate job
dsense ci gitlab > .gitlab-ci-diffesense.yml
```

### Pre-commit Hook

```bash
# .husky/pre-commit
npx diffesense --scope staged --quiet
```

---

## Programmatic API (v1.1.0+)

Use DiffeSense as a library in your own tools:

```typescript
import { analyze } from 'diffesense';

const result = await analyze({
  cwd: '/path/to/repo',
  scope: 'branch',
  base: 'main',
  profile: 'react',
});

// Structured result - no console.log, no process.exit
console.log(`Exit code: ${result.exitCode}`);
console.log(`Blockers: ${result.summary.blockerCount}`);
console.log(`Highest risk: ${result.summary.highestRisk}`);

// Iterate over risky files
for (const file of result.files) {
  console.log(`${file.path}: ${file.severity} (${file.riskScore})`);
}

// Check ignored files
for (const ignored of result.ignoredFiles) {
  console.log(`Skipped: ${ignored.path} - ${ignored.reason}`);
}
```

### API Contract

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Whether analysis completed |
| `exitCode` | 0 \| 1 \| 2 | PASS / FAIL / ERROR |
| `meta` | object | Analysis context (scope, base, profile, etc.) |
| `summary` | object | Statistics (changedCount, blockerCount, etc.) |
| `files` | array | Analyzed files with risk scores and severity |
| `ignoredFiles` | array | Skipped files with reasons |
| `warnings` | array | Config/analysis warnings |

### Severity Levels

| Severity | Risk Score | Description |
|----------|------------|-------------|
| `CRITICAL` | ≥ 8.0 | Immediate attention required |
| `HIGH` | 6.0-7.9 | Should be reviewed carefully |
| `MED` | 3.0-5.9 | Moderate risk |
| `LOW` | < 3.0 | Low risk |

📖 **[Full API Documentation →](docs/api-schema.json)**

---

## Exit Codes

| Code | Status | Meaning | CI Behavior |
|------|--------|---------|-------------|
| **0** | ✔ PASS | No blockers, safe to merge | Pipeline continues |
| **1** | ✖ FAIL | Blockers detected | Pipeline fails, merge blocked |
| **2** | ✖ ERROR | Internal error | Pipeline fails, investigate |

**Deterministic:** Same input → same exit code, always.

---

## Configuration

Create `.diffesense.yml` in your project root:

```yaml
# DiffeSense Configuration
version: 1

# Base profile
profile: react

# Scope defaults
scope:
  default: branch
  base: main

# Thresholds
thresholds:
  fail: 7.0
  warn: 5.0

# Top N issues to show
topN: 3

# Ignore patterns
ignore:
  - "**/legacy/**"
  - "**/vendor/**"

# Action mappings
actions:
  mapping:
    - pattern: "**/auth/**"
      commands:
        - "npm test -- --grep auth"
      reviewers:
        - "@security-team"
```

**Generate config:**
```bash
dsense init --profile react
```

---

## How It Works

### 1. Signal Detection

DiffeSense detects **risk signals** in your code changes:

**Critical Signals** (can block alone):
- Auth boundaries
- Payment logic
- Security-sensitive code

**Behavioral Signals** (can block combined):
- Side effects (network, DOM, storage)
- Async patterns
- Error handling

**Maintainability Signals** (never block alone):
- Code complexity
- File size
- Deep nesting

### 2. Risk Scoring

Each file gets a risk score (0-10) based on:
- Signal types and severity
- Blast radius (how many files depend on it)
- Confidence level

### 3. Top N Selection

Shows you the **most important issues** first:
- Highest risk score
- Highest blast radius
- Critical signals prioritized

### 4. Actionable Output

Tells you **what to do next**:
- Specific test commands
- Reviewers to tag
- Mitigation steps

---

## Examples

### Example 1: Auth Change

```bash
$ dsense --commit HEAD

DiffeSense 1.1.0  •  risk gate for code changes
Summary
- Changed: 1 file  |  Analyzed: 1  |  Ignored: 0  |  Warnings: 0
- Highest risk: 8.9/10  |  Blockers: 1  |  Exit code: 1

Top 1 risky file
Risk  Sev       Blast  File                 Why (top reasons)
8.9   CRITICAL  12     src/auth/login.ts    auth-boundary; async patterns
```

### Example 2: Safe Refactor

```bash
$ dsense --commit HEAD

DiffeSense 1.1.0  •  risk gate for code changes
Summary
- Changed: 3 files  |  Analyzed: 3  |  Ignored: 0  |  Warnings: 0
- Highest risk: 2.1/10  |  Blockers: 0  |  Exit code: 0

Top 3 risky files
Risk  Sev  Blast  File                    Why (top reasons)
2.1   LOW  2      src/utils/format.ts     minor refactor
1.8   LOW  1      src/utils/validate.ts   minor refactor
1.5   LOW  0      src/utils/parse.ts      minor refactor
```

### Example 3: Detailed Analysis

```bash
$ dsense --commit HEAD --details

DiffeSense 1.1.0 — DETAILED ANALYSIS

Details: src/api/users.ts
- Risk: 6.5 (HIGH)  |  Blast radius: 8
- Signals:
  ✗ async-await pattern (line 45)
  ⚠ error handling weak (line 67)
  • network request added (line 89)
- Risk reasons:
  • Behavioral side-effects detected
  • Error handling needs improvement

   Risk breakdown:
     Behavioral:      +4.5
     Maintainability: +2.0   (cannot block alone)
     Critical:        +0.0

   Evidence (top 3):
     L128  [behavioral/network-axios]
           HTTP request introduced or modified
     L207  [behavioral/async-await]
           Async boundary added
     L210  [behavioral/error-handling]
           Error handling pattern detected

   Do next:
     Run:    npm test -- api/users
     Check:  error handling + retries
```

---

## Documentation

- **[Quick Start Guide](docs/QUICK_START.md)** - Get started in 5 minutes
- **[CLI Reference](docs/CLI_REFERENCE.md)** - All commands and options
- **[Output Formats](docs/OUTPUT_FORMATS.md)** - Console, Markdown, JSON
- **[Public Contract](docs/PUBLIC_CONTRACT.md)** - Exit codes, determinism
- **[Detectors](docs/DETECTORS.md)** - Signal detection reference
- **[Profiles](docs/PROFILES.md)** - Profile configuration guide
- **[Architecture](ARCHITECTURE.md)** - Project structure
- **[Contributing](CONTRIBUTING.md)** - How to contribute

---

## Free & Open Source

**DiffeSense CLI is 100% free and open-source (MIT).**

- ✅ No account required
- ✅ No data collection
- ✅ Works offline
- ✅ Unlimited usage
- ✅ CI-ready out of the box
- ✅ No hidden paywalls

**You own your data. Always.**

The CLI and core engine will remain free forever. Optional managed services (GitHub App, Dashboard) may be available in the future for teams who want zero-setup automation.

---

## FAQ

**Q: Is this a linter?**
A: No. Linters catch syntax issues. DiffeSense catches impact issues.

**Q: Do I still need ESLint/Prettier?**
A: Yes! Use both. Linters catch bugs, DiffeSense catches risk.

**Q: Why only top 3 by default?**
A: Because developers ignore tools that spam them. Top 3 = actually actionable.

**Q: Can I use this for languages other than JS/TS?**
A: Not yet. But the architecture is designed to support any language. PRs welcome!

**Q: Does it send my code anywhere?**
A: No. Everything runs locally. No data leaves your machine.

**Q: How is this different from CodeClimate/SonarQube?**
A: Those analyze entire codebases. DiffeSense analyzes **only your changes** and tells you **what to do next**.

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

**Ways to contribute:**
- 🐛 Report bugs
- 💡 Suggest features
- 📝 Improve documentation
- 🔧 Submit PRs
- ⭐ Star the repo

---

## License

MIT © [Branislav Grozdanovic](https://github.com/djkepa)

**DiffeSense CLI and core engine are open-source under the MIT license.**

Commercial use, modification, and distribution are permitted.

---

## Support

- 📖 [Documentation](docs/)
- 🐛 [Report Issues](https://github.com/djkepa/diffesense/issues)
- 💬 [Discussions](https://github.com/djkepa/diffesense/discussions)
- 📧 [Email](mailto:contact@diffesense.dev)

---

**DiffeSense** — Know your risk before you merge.

Built with ❤️ for developers who care about code quality.

---

<p align="center">
  <sub>If DiffeSense helps you ship better code, consider giving it a ⭐ on GitHub!</sub>
</p>
