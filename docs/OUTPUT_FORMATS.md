# DiffeSense Output Formats

Complete reference for all output formats and status codes.

---

## Status Codes (Unified)

All output formats use the same status mapping:

| Exit Code | Status | Icon | Meaning |
|-----------|--------|------|---------|
| **0** | **PASS** | ✅ | No blockers, safe to merge |
| **1** | **FAIL** | ❌ | Blockers detected, merge should be blocked |
| **2** | **ERROR** | ⛔ | Internal error or invalid config, investigate |

**Note:** Exit code 0 = safe to merge. Exit code 1 = blockers detected. Exit code 2 = error.

---

## Console Output (Default)

Human-readable format with colors for terminal use.

### Default Format (Compact)

```bash
$ dsense --range HEAD~10..HEAD

DiffeSense 1.1.0  •  risk gate for code changes
Repo: my-app  |  CWD: /home/user/my-app
Scope: range  |  Base: main  |  Range: HEAD~10..HEAD
Profile: minimal  |  Detector: auto
Config: defaults  |  Schema: 1.0.0

Summary
- Changed: 12 files  |  Analyzed: 12  |  Ignored: 0  |  Warnings: 0
- Highest risk: 4.0/10  |  Blockers: 0  |  Exit code: 0

Top 3 risky files
Risk  Sev   Blast  File                           Why (top reasons)
4.0   MED   0      src/components/MosaicModule.tsx   behavioral side-effects
```

**Features:**
- ✅ Clear header with version and metadata
- ✅ Summary with key metrics
- ✅ Deterministic table format
- ✅ Severity classification (CRITICAL/HIGH/MED/LOW)
- ✅ CI-friendly

### Detailed Format (`--details`)

```bash
$ dsense --range HEAD~10..HEAD --details

DIFFESENSE — DETAILS
============================================================
Scope:     range
Profile:   minimal
Changed:   12 files | Analyzed: 12

Decision:  PASS ✔
Highest:   4.0/10  LOW   | Confidence: MEDIUM (0.72)

Top 1 risk
------------------------------------------------------------

1) src/.../MosaicModule.tsx
   Risk: 4.0  INFO   | Δ lines: 18 | Blast radius: 0

   Why this file:
   Behavioral side-effects detected in changed lines

   Risk breakdown:
     Behavioral:      +3.0
     Maintainability: +1.0   (cannot block alone)
     Critical:        +0.0

   Evidence (top 3):
     L128  [behavioral/network-axios]
           Axios request introduced or modified
     L207  [behavioral/dom-manipulation]
           Direct DOM access detected
     L210  [behavioral/async-await]
           Async boundary added in render-adjacent path

   Do next:
     Run:    npm test -- --testPathPattern="components"
     Check:  effect dependencies / async outside render
------------------------------------------------------------

Summary: blockers=0 | warnings=0 | highest=4.0 | exit=0
```

**Additional Features:**
- ✅ Risk breakdown by class
- ✅ Evidence with line numbers and tags
- ✅ Detailed explanations
- ✅ Full action recommendations

---

## Markdown Output

GitHub/GitLab-friendly format for PR comments.

```bash
$ dsense --format markdown
```

**Output:**

```markdown
<!-- diffesense-comment -->
## DiffeSense Risk Report

**Status:** ✔ PASS
**PR Risk:** 4.0/10 (Medium Confidence)
**Top risks:** 1 file

| File | Risk | Why | Next action |
|------|------|-----|-------------|
| `src/.../MosaicModule.tsx` | 4.0 | Behavioral side-effects | Run tests |

> **Selection criteria:** Highest risk score (4.0) + 3 dependents

<details>
<summary>📋 Details</summary>

### 1. src/.../MosaicModule.tsx

**Risk:** 4.0/10 (INFO)

**Signals:**
- Network call (axios)
- DOM manipulation
- Async/await pattern

**Actions:**
- Run: `npm test -- --testPathPattern="components"`
- Review: Check effect dependencies

</details>

---

*12 files analyzed • Profile: minimal*
```

**Features:**
- ✅ GitHub/GitLab markdown compatible
- ✅ Idempotent comment marker (`<!-- diffesense-comment -->`)
- ✅ Collapsible details section
- ✅ Table format for quick scanning
- ✅ Selection criteria rationale

**Status Icons:**
- `✅ PASS` - No blockers (exit 0)
- `❌ FAIL` - Blockers detected (exit 1)
- `⛔ ERROR` - Internal error (exit 2)

---

## JSON Output

Machine-readable format for CI/CD integration and tooling.

```bash
$ dsense --format json
```

**Output:**

```json
{
  "schemaVersion": "1.0.0",
  "toolVersion": "1.1.0",
  "success": true,
  "exitCode": 0,
  "status": "PASS",
  "meta": {
    "cwd": "/home/user/my-app",
    "repo": "my-app",
    "scope": "range",
    "base": "main",
    "range": "HEAD~10..HEAD",
    "profile": "minimal",
    "detector": "auto",
    "config": { "source": "defaults" },
    "branch": "feature/my-feature",
    "timestamp": "2026-01-15T14:30:00.000Z"
  },
  "summary": {
    "changedCount": 12,
    "analyzedCount": 12,
    "ignoredCount": 0,
    "warningCount": 0,
    "highestRisk": 4.0,
    "blockerCount": 0,
    "topN": 3
  },
  "files": [
    {
      "path": "src/components/MosaicModule.tsx",
      "riskScore": 4.0,
      "severity": "MED",
      "blastRadius": 0,
      "signalTypes": ["network-axios", "dom-manipulation"],
      "reasons": ["behavioral side-effects"],
      "evidence": [
        { "line": 128, "message": "Axios request", "severity": "warning" }
      ]
    }
  ],
  "ignoredFiles": [],
  "warnings": [],
  "evaluation": null
}
```

**Features:**
- ✅ Structured, machine-readable
- ✅ Complete metadata (tool, version, timestamp)
- ✅ Status field in summary
- ✅ Full evidence and actions
- ✅ Easy to parse and integrate

**Status Values:**
- `"PASS"` - No blockers (exit code 0)
- `"FAIL"` - Blockers detected (exit code 1)
- `"ERROR"` - Internal error (exit code 2)

---

## Comparison

| Feature | Console | Console --details | Markdown | JSON |
|---------|---------|-------------------|----------|------|
| **Human-readable** | ✅ | ✅ | ✅ | ❌ |
| **Machine-readable** | ❌ | ❌ | ❌ | ✅ |
| **Colors** | ✅ | ✅ | ❌ | ❌ |
| **Compact** | ✅ | ❌ | ✅ | ❌ |
| **Evidence details** | ❌ | ✅ | ✅ | ✅ |
| **Risk breakdown** | ❌ | ✅ | ❌ | ❌ |
| **PR-friendly** | ❌ | ❌ | ✅ | ❌ |
| **CI-friendly** | ✅ | ❌ | ✅ | ✅ |
| **Idempotent** | ❌ | ❌ | ✅ | ❌ |

---

## Use Cases

### Local Development

```bash
# Quick check
dsense

# Detailed analysis
dsense --details

# Pre-commit check
dsense --scope staged --quiet
```

**Best format:** Console (default)

---

### CI/CD Pipeline

```bash
# GitHub Actions
dsense --format markdown > report.md

# GitLab CI
dsense --format json > report.json

# Jenkins
dsense --format console
```

**Best format:** Markdown (for PR comments) or JSON (for parsing)

---

### PR Comments

```bash
# Generate PR comment
dsense --format markdown

# With all issues
dsense --format markdown --show-all
```

**Best format:** Markdown (idempotent updates)

---

### Tooling Integration

```bash
# Parse output
dsense --format json | jq '.summary.status'

# Check exit code
dsense && echo "PASS" || echo "FAIL"

# Extract highest risk
dsense --format json | jq '.summary.highestRisk'
```

**Best format:** JSON (structured data)

---

## Environment Variables

### `DIFFESENSE_DETERMINISTIC`

When set, produces deterministic output (fixed timestamp).

```bash
export DIFFESENSE_DETERMINISTIC=1
dsense --format json
# timestamp: "2026-01-01T00:00:00.000Z"
```

**Use case:** Testing, snapshots, reproducible builds

---

## Exit Code Behavior

All formats respect the same exit codes:

```bash
# PASS (exit 0) - safe to merge
dsense
echo $?  # 0

# FAIL (exit 1) - blockers detected
dsense  # blockers detected
echo $?  # 1

# ERROR (exit 2) - something went wrong
dsense --config invalid.yml
echo $?  # 2
```

**CI Integration:**

```yaml
# GitHub Actions
- name: DiffeSense
  run: dsense --format markdown
  # Fails if exit code != 0

# GitLab CI
script:
  - dsense --format json
  # Fails if exit code != 0
```

---

## See Also

- [CLI Reference](CLI_REFERENCE.md) - All commands and options
- [Public Contract](PUBLIC_CONTRACT.md) - Exit codes and guarantees
- [Quick Start](QUICK_START.md) - Getting started guide

---

**DiffeSense** — Know your risk before you merge.

