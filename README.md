# DiffeSense

**Know your risk before you merge.**

DiffeSense analyzes code changes in your Pull Requests and tells you which files are risky and what to do about them. It's not a linter—it's a risk engine that helps you make better merge decisions.

[![npm version](https://img.shields.io/npm/v/@diffesense/cli.svg)](https://www.npmjs.com/package/@diffesense/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/@diffesense/cli.svg)](https://nodejs.org)

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
npm install -g @diffesense/cli

# Run on your PR
dsense

# That's it. Top 3 risky files, concrete actions.
```

📖 **[Complete Documentation →](docs/QUICK_START.md)**

---

## What You Get

```
DIFFESENSE
============================================================
Scope:     branch vs main
Changed:   8 files | Analyzed: 8

Decision:  FAIL ✖
Highest:   8.9/10  HIGH  | Confidence: HIGH (0.89)

Top risk (1/3)   [--details for explanation]
------------------------------------------------------------
src/auth/middleware.ts
Risk: 8.9  BLOCKER | Δ lines: 23 | Blast radius: 12
Why: Critical signals present (auth, payments, security)
------------------------------------------------------------

Summary: blockers=1 | warnings=2 | highest=8.9 | exit=1
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
npm install -g @diffesense/cli

# Project-local
npm install --save-dev @diffesense/cli

# Or use without installing
npx @diffesense/cli
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
        run: npx @diffesense/cli --format markdown
```

### GitLab CI

```bash
# Generate job
dsense ci gitlab > .gitlab-ci-diffesense.yml
```

### Pre-commit Hook

```bash
# .husky/pre-commit
npx @diffesense/cli --scope staged --quiet
```

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

Decision:  FAIL ✖
Highest:   8.9/10  HIGH  | Confidence: HIGH (0.89)

src/auth/login.ts
Risk: 8.9  BLOCKER | Δ lines: 23 | Blast radius: 12
Why: Critical signals present (auth, payments, security)

Do next:
  Run:    npm test -- --grep auth
  Review: @security-team
```

### Example 2: Safe Refactor

```bash
$ dsense --commit HEAD

Decision:  PASS ✔
Highest:   2.1/10  LOW  | Confidence: MEDIUM (0.65)

All changed files are within acceptable risk levels.
```

### Example 3: Detailed Analysis

```bash
$ dsense --commit HEAD --details

Decision:  WARN !
Highest:   6.5/10  MEDIUM  | Confidence: MEDIUM (0.72)

1) src/api/users.ts
   Risk: 6.5  WARNING | Δ lines: 45 | Blast radius: 8

   Why this file:
   Behavioral side-effects detected in changed lines

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
