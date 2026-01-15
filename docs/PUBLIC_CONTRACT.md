# DiffeSense Public Contract

**Version:** 1.0  
**Last Updated:** January 2026

This document defines the public contract for DiffeSense — what you can rely on when integrating it into your workflow.

---

## Exit Codes

DiffeSense uses standard Unix exit codes for CI integration:

| Exit Code | Status | Meaning | CI Behavior |
|-----------|--------|---------|-------------|
| **0** | ✅ PASS | No blockers found. Changes are within acceptable risk levels. | Pipeline continues, merge allowed |
| **1** | ❌ FAIL | One or more blockers detected. High-risk changes require attention. | Pipeline fails, merge blocked (if configured) |
| **2** | ⚠️ ERROR | Internal error (config invalid, git error, etc.) | Pipeline fails, investigate issue |

### Exit Code Guarantees

- **Deterministic**: Same input (diff + config) → same exit code
- **Stable**: Exit code logic will not change in minor/patch versions
- **Documented**: Any exit code change is a breaking change (major version bump)

---

## Status Levels: PASS / FAIL / ERROR

DiffeSense evaluates changes and assigns one of three statuses:

### ✅ PASS (Exit 0)
- **No blockers detected**
- May have info-level signals or low-risk files
- Safe to merge (within configured risk tolerance)

**Example:**
```
Status: ✅ PASS (exit code: 0)
Highest risk: 3.2/10
Blockers: 0
```

### ❌ FAIL (Exit 1)
- **One or more blockers detected**
- High-risk changes that should block merge
- Typically: critical signals (auth, payments, security)

**Example:**
```
Status: ❌ FAIL (exit code: 1)
Highest risk: 8.9/10
Blockers: 1
```

### ⛔ ERROR (Exit 2)
- **Internal error or invalid configuration**
- Analysis could not complete
- Investigate and fix before re-running

**Example:**
```
Status: ⛔ ERROR (exit code: 2)
Error: Not a git repository
```

---

## Signal Classes & Severity

DiffeSense uses a **class-based severity system** to prevent false positives:

### Signal Classes

| Class | Can Block? | Max Contribution | Examples |
|-------|-----------|------------------|----------|
| **Critical** | ✅ Yes | 5.0 | Auth boundaries, payment logic, security-sensitive code |
| **Behavioral** | ✅ Yes | 3.0 | Async patterns, error handling, conditional logic, API changes |
| **Maintainability** | ❌ **NEVER** | 1.0 | Nesting depth, file size, complexity metrics |

### Key Rule

**Maintainability signals can NEVER block your PR alone.**

This prevents scenarios like:
- ❌ "Merge blocked because of deep nesting"
- ❌ "Merge blocked because file is large"

Only **Critical** and **Behavioral** signals can produce blockers.

---

## Top N Selection (Default: Top 3)

### Why Top 3?

Research shows developers act on **3 or fewer items** in PR reviews. More than that creates decision paralysis.

### Selection Criteria

Files are ranked by:
1. **Risk Score** (highest first)
2. **Signal Class** (critical > behavioral > maintainability)
3. **Blast Radius** (more dependents = higher priority)
4. **Confidence** (high confidence signals prioritized)

### Rationale Output

DiffeSense explains **why** these files were selected:

```
Selection criteria: highest risk + critical class + high blast radius + high confidence
Next candidates: src/utils/helper.ts (5.7), src/config/env.ts (5.6)
```

This transparency builds trust.

---

## Determinism Check (`--determinism-check`)

### What It Does

Outputs cryptographic hashes of:
- **Input Hash**: diff content + config + options
- **Output Hash**: analysis result (excluding timestamps)

### Why It Matters

**Trust in CI gates requires reproducibility.**

If DiffeSense says "risk = 7.2" today and "risk = 8.1" tomorrow for the **same diff**, trust is broken.

### Example Output

```
Determinism Check
=================
Input Hash:  e8c2546b65030d6d
Output Hash: a3f7d8e9c1b2a456

Details:
  Diff Hash:        abc123
  Config Hash:      def456
  Files Analyzed:   8
  Signals Detected: 12
```

### Guarantees

- **Cross-platform**: Same hash on Windows, Linux, macOS (newlines normalized)
- **Stable**: Same input → same hash (no timestamps, no random order)
- **Verifiable**: Run twice → same hashes

### When to Use

- **CI flakiness debugging**: "Why did the same PR fail today?"
- **Config changes**: Verify that config changes affect output as expected
- **Regression testing**: Ensure updates don't change behavior

---

## Plugin Security Model

### ⚠️ CRITICAL: Plugins Execute Code

**Detector packs are arbitrary code execution.**

When you load a plugin, it runs during analysis with full access to:
- File system (read)
- Your codebase
- Node.js runtime

### Safety Guarantees

1. **No Auto-Loading**: Plugins are NEVER loaded automatically
2. **Explicit Config**: Must be listed in `.diffesense.yml`
3. **Warning on Load**: Console warning when loading external packs
4. **API Version Check**: Incompatible plugins are rejected

### Safe Usage

✅ **DO:**
- Use official `@diffesense/*` packs
- Review plugin source code before use
- Pin plugin versions in config

❌ **DON'T:**
- Install plugins from untrusted sources
- Use plugins without reviewing code
- Auto-update plugins in CI without testing

### Example Warning

```
⚠️  Loading external detector packs. Packs execute code during analysis.
   Only use packs from trusted sources.
✓ Loaded detector pack: @diffesense/detector-pack-react v1.0.0
```

---

## Ignore System Transparency (`--explain-ignore`)

### Why Files Are Ignored

DiffeSense ignores files by default to reduce noise:

| Source | Examples | Override |
|--------|----------|----------|
| **ALWAYS** | Lockfiles, `node_modules`, build output | Cannot override |
| **DEFAULT** | Generated files, `.d.ts`, minified files | `overrideDefaults: true` |
| **TEST** | `*.test.ts`, `__tests__/` | `--include-tests` |
| **CONFIG** | `*.config.js`, `tsconfig.json` | `--include-config` |
| **USER** | Custom patterns in config | Remove from config |

### Transparency Guarantee

Run `dsense --explain-ignore` to see:
- Which files are ignored
- Why (which pattern matched)
- How to include them

**Example:**
```
✗ src/utils/helper.test.ts
  Source:  TEST
  Pattern: **/*.test.ts
  Reason:  Test file (excluded by default)
  Include: Use --include-tests flag
```

---

## Versioning & Breaking Changes

### Semantic Versioning

DiffeSense follows [SemVer](https://semver.org/):

- **Major (2.0.0)**: Breaking changes (exit code logic, signal classes, API)
- **Minor (1.1.0)**: New features (new detectors, new signals, new flags)
- **Patch (1.0.1)**: Bug fixes (no behavior change)

### What's Considered Breaking

- Exit code logic changes
- Signal class definitions
- Default ignore patterns (ALWAYS/DEFAULT)
- Config schema (removing fields)
- Plugin API changes

### What's NOT Breaking

- New detectors (can be disabled)
- New CLI flags (opt-in)
- Performance improvements
- Bug fixes that restore intended behavior

---

## Support & Feedback

- **Issues**: [GitHub Issues](https://github.com/djkepa/diffesense/issues)
- **Discussions**: [GitHub Discussions](https://github.com/djkepa/diffesense/discussions)
- **Security**: security@diffesense.dev (for security issues only)

---

## License

MIT License - see [LICENSE](../LICENSE) file.

**Commercial use, modification, and distribution are permitted.**

---

*This contract is versioned and changes are tracked in [CHANGELOG.md](../CHANGELOG.md).*

