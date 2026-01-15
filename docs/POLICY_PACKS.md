# Policy Packs

DiffeSense includes pre-configured **policy packs** for different use cases. Policy packs provide sensible defaults so you can get started in 60 seconds without configuring individual thresholds.

## Quick Start

```bash
# Local development (default: startup pack)
npx diffesense

# Enterprise CI gate
npx diffesense --scope branch --base main --policy-pack enterprise --format markdown

# Open-source project
npx diffesense --policy-pack oss
```

## Available Packs

### 🏢 Enterprise

Strict CI gating for quality and security requirements.

| Setting | Value |
|---------|-------|
| Fail threshold | Risk >= 7.5 |
| Blockers | >= 1 |
| Severity gate | 1 CRITICAL or 2+ HIGH |
| Top N | 15 files |
| Details | Enabled |

**Category weights:**
- 🔒 Security: 1.3× (boosted)
- 🌐 SSR Boundary: 1.2× (boosted)
- 📜 API Contract: 1.2× (boosted)
- ✅ Correctness: 1.1× (boosted)
- ⚡ Performance: 1.1× (boosted)
- 🔧 Maintainability: 0.9× (reduced)
- 📦 Supply Chain: 1.2× (boosted)

**Best for:**
- Enterprise CI/CD pipelines
- Security-sensitive projects
- Quality gates before production

```bash
npx diffesense --policy-pack enterprise --format markdown --details
```

---

### ⚡ Startup (Default)

Pragmatic defaults for fast-moving teams. Catches critical risks without noise.

| Setting | Value |
|---------|-------|
| Fail threshold | Risk >= 8.8 |
| Blockers | >= 1 |
| Severity gate | 1 CRITICAL |
| Top N | 10 files |
| Details | Disabled |

**Category weights:**
- 🔒 Security: 1.2× (boosted)
- 🌐 SSR Boundary: 1.1× (slightly boosted)
- 📜 API Contract: 1.1× (slightly boosted)
- ✅ Correctness: 1.0× (neutral)
- ⚡ Performance: 1.0× (neutral)
- 🔧 Maintainability: 0.8× (reduced)
- 📦 Supply Chain: 1.0× (neutral)

**Best for:**
- Startups and small teams
- Fast iteration cycles
- Balanced risk awareness

```bash
npx diffesense --policy-pack startup
```

---

### 🌍 OSS (Open Source)

Focused on supply-chain security and correctness. Doesn't block on style issues.

| Setting | Value |
|---------|-------|
| Fail threshold | Risk >= 9.2 |
| Blockers | >= 1 |
| Severity gate | 1 CRITICAL |
| Top N | 12 files |
| Details | Disabled |

**Category weights:**
- 🔒 Security: 1.3× (boosted)
- 📦 Supply Chain: 1.3× (boosted)
- ✅ Correctness: 1.1× (boosted)
- ⚡ Performance: 1.0× (neutral)
- 🔧 Maintainability: 0.6× (significantly reduced)
- 🌐 SSR Boundary: 1.0× (neutral)
- 📜 API Contract: 1.0× (neutral)

**Best for:**
- Open-source projects
- Community contributions
- Focus on security over style

```bash
npx diffesense --policy-pack oss
```

---

## Configuration File

You can set the policy pack in your config file:

### JSON Format

```json
{
  "$schema": "https://diffesense.dev/schemas/config-1.0.json",
  "policyPack": "enterprise",
  "detector": "auto",
  "failOn": {
    "minHighestRisk": 7.5,
    "minBlockers": 1,
    "severityCounts": {
      "CRITICAL": 1,
      "HIGH": 2
    }
  },
  "output": {
    "format": "console",
    "topN": 15,
    "details": true
  },
  "scope": {
    "mode": "auto"
  }
}
```

### YAML Format

```yaml
# .diffesense.yml
policyPack: enterprise
detector: auto

failOn:
  minHighestRisk: 7.5
  minBlockers: 1
  severityCounts:
    CRITICAL: 1
    HIGH: 2

output:
  format: console
  topN: 15
  details: true

scope:
  mode: auto
```

### Generate Config with Policy Pack

```bash
# Create YAML config with startup pack (default)
dsense init

# Create YAML config with enterprise pack
dsense init --pack enterprise

# Create JSON config with OSS pack
dsense init --pack oss --json
```

---

## Override Policy Pack Settings

CLI flags and config file settings override policy pack defaults:

```bash
# Use enterprise pack but show only top 5
npx diffesense --policy-pack enterprise --top 5

# Use startup pack with custom threshold
npx diffesense --policy-pack startup --threshold 6.0

# Use enterprise but skip details
npx diffesense --policy-pack enterprise --no-details
```

---

## List Available Packs

```bash
# List all packs
dsense packs

# Show detailed configuration
dsense packs --verbose
```

---

## CI/CD Integration

### GitHub Actions

```yaml
- name: Run DiffeSense
  run: |
    npx diffesense \
      --base ${{ github.event.pull_request.base.ref }} \
      --policy-pack enterprise \
      --format markdown \
      --details > report.md
```

### GitLab CI

```yaml
diffesense:
  script:
    - npx diffesense --base $CI_MERGE_REQUEST_TARGET_BRANCH_NAME --policy-pack enterprise
```

---

## Custom Policy Pack (Advanced)

For custom thresholds, use `failOn` in your config:

```json
{
  "policyPack": "startup",
  "failOn": {
    "minHighestRisk": 7.0,
    "minBlockers": 1,
    "severityCounts": {
      "CRITICAL": 1,
      "HIGH": 3,
      "MED": 10
    }
  }
}
```

This uses `startup` as the base but overrides the fail conditions.
