# DiffeSense Profiles

Profiles define how DiffeSense evaluates risk and what actions to recommend. Each profile is a collection of rules that map conditions to severities and actions.

---

## Available Profiles

| Profile | Use Case | Strictness |
|---------|----------|------------|
| `minimal` | Getting started, legacy codebases | Low |
| `strict` | Production repositories | High |
| `react` | React/Next.js projects | Medium |
| `vue` | Vue/Nuxt projects | Medium |
| `angular` | Angular projects | Medium |
| `backend` | Node.js APIs, servers | Medium |

---

## Profile: minimal

**Use for:** Initial adoption, legacy codebases, exploratory projects.

Only catches critical issues. Minimal friction.

| Condition | Severity | Actions |
|-----------|----------|---------|
| Risk >= 8.0 | Blocker | Review, Test |
| Risk >= 7.0 AND Blast Radius >= 10 | Blocker | Test, Review |

---

## Profile: strict

**Use for:** Production repositories, critical systems.

Stricter thresholds and more warnings.

| Condition | Severity | Actions |
|-----------|----------|---------|
| Risk >= 8.0 | Blocker | Review, Test |
| Risk >= 7.0 AND Blast Radius >= 10 | Blocker | Test, Review |
| Risk >= 6.0 | Warning | Review |
| Blast Radius >= 15 | Warning | Review |
| Side-effects in core modules | Warning | Refactor, Test |
| High complexity + Risk >= 5.0 | Info | Split |

---

## Profile: react

**Use for:** React, Next.js, Remix projects.

Includes React-specific rules.

| Condition | Severity | Actions |
|-----------|----------|---------|
| Risk >= 8.0 | Blocker | Review, Test |
| Risk >= 7.0 AND Blast Radius >= 10 | Blocker | Test, Review |
| Risk >= 6.0 | Warning | Review |
| `react-effect` signals | Blocker | Add deps, Test |
| Side-effects in components | Warning | Extract to hooks |
| Inline patterns | Info | Memoize |

---

## Profile: vue

**Use for:** Vue.js, Nuxt projects.

Includes Vue-specific rules.

| Condition | Severity | Actions |
|-----------|----------|---------|
| Risk >= 8.0 | Blocker | Review, Test |
| Risk >= 7.0 AND Blast Radius >= 10 | Blocker | Test, Review |
| Risk >= 6.0 | Warning | Review |
| `vue-watch-no-cleanup` | Warning | Add cleanup, Test |
| `vue-computed-side-effect` | Blocker | Move side effects |
| `vue-props-mutation` | Blocker | Emit events |
| Many refs / large data | Info | Extract composables |

---

## Profile: angular

**Use for:** Angular projects.

Includes Angular-specific rules with RxJS patterns.

| Condition | Severity | Actions |
|-----------|----------|---------|
| Risk >= 8.0 | Blocker | Review, Test |
| Risk >= 7.0 AND Blast Radius >= 10 | Blocker | Test, Review |
| Risk >= 6.0 | Warning | Review |
| `angular-subscription-leak` | Blocker | Unsubscribe, takeUntil |
| `angular-nested-subscribe` | Blocker | Use operators |
| `angular-http-no-error` | Warning | Add catchError |
| `angular-dom-access` | Warning | Use Renderer2 |
| Performance issues | Info | OnPush, reduce ViewChild |

---

## Profile: backend

**Use for:** Node.js APIs, Express, Fastify, NestJS.

Includes backend-specific patterns.

| Condition | Severity | Actions |
|-----------|----------|---------|
| Risk >= 8.0 | Blocker | Review, Test |
| Risk >= 7.0 AND Blast Radius >= 10 | Blocker | Test, Review |
| Risk >= 6.0 | Warning | Review |
| Sync I/O operations | Warning | Use async |
| Database operations | Warning | Test, Review |
| Environment variable access | Info | Document |

---

## Custom Rules

Add custom rules in `.diffesense.yml`:

```yaml
rules:
  # Block any change to payment module with risk >= 5
  - id: payment-protection
    when:
      pathMatches: ["src/payments/**", "src/billing/**"]
      riskGte: 5.0
    then:
      severity: blocker
      actions:
        - type: review
          text: "Payment module requires security review"
        - type: test
          text: "Add payment flow tests"

  # Warn on changes to public API
  - id: api-surface-warning
    when:
      pathMatches: ["src/api/public/**"]
      evidenceContains: ["export", "signature"]
    then:
      severity: warning
      actions:
        - type: review
          text: "Public API change - ensure backward compatibility"

  # Info for changes to utilities
  - id: utility-info
    when:
      pathMatches: ["src/utils/**"]
      blastRadiusGte: 5
    then:
      severity: info
      actions:
        - type: test
          text: "This utility is widely used - add regression tests"
```

---

## Rule Conditions

| Condition | Description | Example |
|-----------|-------------|---------|
| `riskGte` | Risk score >= value | `riskGte: 7.0` |
| `riskLte` | Risk score <= value | `riskLte: 3.0` |
| `blastRadiusGte` | Blast radius >= value | `blastRadiusGte: 10` |
| `blastRadiusLte` | Blast radius <= value | `blastRadiusLte: 2` |
| `pathMatches` | File path matches glob | `pathMatches: ["src/**"]` |
| `pathExcludes` | File path excludes glob | `pathExcludes: ["**/*.test.ts"]` |
| `evidenceContains` | Evidence message contains | `evidenceContains: ["side-effect"]` |
| `evidenceTags` | Evidence has specific tag | `evidenceTags: ["react-effect"]` |

---

## Rule Actions

| Action Type | Description |
|-------------|-------------|
| `review` | Request code review |
| `test` | Add tests |
| `refactor` | Suggest refactoring |
| `split` | Split into smaller modules |
| `document` | Add documentation |

---

## Severity Levels

| Severity | Exit Code | Description |
|----------|-----------|-------------|
| `blocker` | 1 | Merge should be blocked |
| `warning` | 0 | Attention needed, but can proceed |
| `info` | 0 | Informational, for awareness |

---

## Combining Profiles

Profiles are additive. The evaluation order is:

1. Baseline rules (always applied)
2. Profile rules
3. Custom rules from config

Later rules with the same ID override earlier ones.

