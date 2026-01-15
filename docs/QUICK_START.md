# DiffeSense Quick Start Guide

Get started with DiffeSense in 5 minutes.

---

## Installation

```bash
# Global (recommended)
npm install -g diffesense

# Or use without installing
npx diffesense
```

---

## Basic Usage

### 1. Analyze Your Changes

```bash
# Default: analyze current branch vs main
dsense
```

**Output:**
```
DiffeSense 1.1.0  •  risk gate for code changes
Repo: my-app  |  CWD: /home/user/my-app
Scope: branch  |  Base: main  |  Range: main...HEAD
Profile: minimal  |  Detector: auto

Summary
- Changed: 5 files  |  Analyzed: 5  |  Ignored: 0  |  Warnings: 0
- Highest risk: 8.2/10  |  Blockers: 1  |  Exit code: 1

Top 3 risky files
Risk  Sev       Blast  File                      Why (top reasons)
8.2   CRITICAL  12     src/auth/login.ts         auth-sensitive; complex logic
```

### 2. Analyze Specific Commits

```bash
# Last commit
dsense --commit HEAD

# Last 5 commits
dsense --range HEAD~5..HEAD

# Specific commit
dsense --commit abc123
```

### 3. Different Output Formats

```bash
# Markdown (for PR comments)
dsense --format markdown

# JSON (for CI/CD)
dsense --format json

# Console (default, with colors)
dsense --format console
```

---

## Common Workflows

### Pre-commit Hook

```bash
# Check staged files before committing
dsense --scope staged --quiet
```

**Setup with Husky:**
```bash
# Install husky
npm install --save-dev husky
npx husky init

# Add to .husky/pre-commit
npx diffesense --scope staged --quiet
```

### CI/CD Integration

#### GitHub Actions

```bash
# Generate workflow
dsense ci github > .github/workflows/diffesense.yml

# Commit and push
git add .github/workflows/diffesense.yml
git commit -m "Add DiffeSense workflow"
git push
```

#### GitLab CI

```bash
# Generate job
dsense ci gitlab > .gitlab-ci-diffesense.yml

# Add to .gitlab-ci.yml
echo "include:" >> .gitlab-ci.yml
echo "  - local: '.gitlab-ci-diffesense.yml'" >> .gitlab-ci.yml

# Commit and push
git add .gitlab-ci.yml .gitlab-ci-diffesense.yml
git commit -m "Add DiffeSense job"
git push
```

### Framework-Specific Analysis

```bash
# React app
dsense --profile react

# Vue app
dsense --profile vue

# Angular app
dsense --profile angular

# Node.js backend
dsense --profile backend
```

---

## Configuration

### Create Config File

```bash
# Create .diffesense.yml
dsense init

# Or with specific profile
dsense init --profile react
```

### Basic Config Example

```yaml
# .diffesense.yml
version: 1
profile: react

scope:
  default: branch
  base: main

thresholds:
  fail: 7.0
  warn: 5.0

topN: 3

ignore:
  - "**/legacy/**"
  - "**/vendor/**"

actions:
  mapping:
    - pattern: "**/auth/**"
      commands:
        - "npm test -- --grep auth"
      reviewers:
        - "@security-team"
```

### Validate Config

```bash
# Check if config is valid
dsense config check

# Show effective config
dsense config print
```

---

## Troubleshooting

### Check Environment

```bash
dsense doctor
```

**Output:**
```
DiffeSense Doctor
=================
✓ git version 2.40.0
✓ In a git repository
✓ Current branch: feature/my-feature
✓ Config is valid
✓ Node.js v18.16.0
✓ All checks passed!
```

### No Changes Detected?

```bash
# Make sure you have commits
git log --oneline -5

# Try analyzing last commit
dsense --commit HEAD

# Or last 5 commits
dsense --range HEAD~5..HEAD
```

### Files Being Ignored?

```bash
# See why files are ignored
dsense --explain-ignore
```

### High Risk Score?

```bash
# See all issues (not just top 3)
dsense --show-all

# Use stricter profile
dsense --profile strict

# Override threshold
dsense --threshold 5.0
```

---

## Exit Codes

| Code | Status | Meaning |
|------|--------|---------|
| **0** | ✅ PASS | No blockers, safe to merge |
| **1** | ❌ FAIL | Blockers detected, review needed |
| **2** | ⚠️ ERROR | Config error or internal issue |

**Check exit code:**
```bash
dsense
echo $?  # 0, 1, or 2
```

---

## Cheat Sheet

### Analysis Scopes

```bash
dsense                           # Current branch vs main
dsense --scope staged            # Staged files only
dsense --scope worktree          # Uncommitted changes
dsense --commit HEAD             # Last commit
dsense --range HEAD~10..HEAD     # Last 10 commits
```

### Profiles

```bash
dsense --profile minimal         # Default, low noise
dsense --profile strict          # Stricter rules
dsense --profile react           # React-optimized
dsense --profile vue             # Vue-optimized
dsense --profile angular         # Angular-optimized
dsense --profile backend         # Node.js backend
```

### Output Formats

```bash
dsense --format console          # Human-readable (default)
dsense --format markdown         # For PR comments
dsense --format json             # Machine-readable
```

### Filters

```bash
dsense --top 5                   # Show top 5 issues
dsense --show-all                # Show all issues
dsense --include-tests           # Include test files
dsense --include-config          # Include config files
dsense --quiet                   # Only output on issues
```

### Advanced

```bash
dsense --no-blast-radius         # Skip dependency analysis (faster)
dsense --threshold 5.0           # Custom fail threshold
dsense --determinism-check       # Verify deterministic output
dsense --explain-ignore          # Why files are ignored
dsense --config custom.yml       # Use custom config
```

---

## Next Steps

1. **Read Full Documentation:**
   - [CLI Reference](CLI_REFERENCE.md) - All commands and options
   - [Public Contract](PUBLIC_CONTRACT.md) - Exit codes, guarantees
   - [Configuration Guide](../README.md#configuration) - Config reference

2. **Set Up CI/CD:**
   - Generate workflow: `dsense ci github`
   - Test locally: `dsense --format markdown`
   - Commit and push

3. **Customize for Your Project:**
   - Create config: `dsense init --profile react`
   - Add custom patterns
   - Define action mappings

4. **Integrate with Git Hooks:**
   - Pre-commit: `dsense --scope staged --quiet`
   - Pre-push: `dsense --quiet`

---

## Common Questions

**Q: Do I need uncommitted changes?**
No! Use `--commit HEAD` or `--range HEAD~5..HEAD` to analyze existing commits.

**Q: Can I use this in CI without changes?**
Yes! Analyze the PR diff: `dsense --base main --format markdown`

**Q: How do I reduce noise?**
Use `--top 3` (default), `--quiet`, or adjust `thresholds` in config.

**Q: What if I disagree with a signal?**
Add to `exceptions` in config, or adjust profile thresholds.

**Q: Is it slow?**
No. ~2s for 50 files. Use `--no-blast-radius` for even faster analysis.

---

## Support

- 📖 [Full Documentation](CLI_REFERENCE.md)
- 🐛 [Report Issues](https://github.com/djkepa/diffesense/issues)
- 💬 [Discussions](https://github.com/djkepa/diffesense/discussions)

---

**Ready to go!** Run `dsense` and see your risk score. 🚀

