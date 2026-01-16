<div align="center">

<img src="https://i.ibb.co/gMvbdQNm/diffesense-logo-text.png" alt="DiffeSense Logo" width="180"/>

# DiffeSense

**Know your risk before you merge.**

Change-risk intelligence for JavaScript/TypeScript pull requests.

[![npm version](https://img.shields.io/npm/v/diffesense.svg)](https://www.npmjs.com/package/diffesense)
[![npm downloads](https://img.shields.io/npm/dm/diffesense.svg)](https://www.npmjs.com/package/diffesense)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

[Quick Start](#quick-start) · [Documentation](docs/) · [Policy Packs](#policy-packs)

</div>

---

## What is DiffeSense?

DiffeSense analyzes your code changes and tells you **which files are risky** and **what to do about them**.

It's not a linter. It's a **risk engine** that helps you make better merge decisions.

```
$ dsense

DiffeSense  •  risk gate for code changes

Top 3 risky files
Risk  Sev       Blast  File                      Why
8.9   CRITICAL  12     src/auth/middleware.ts    auth-boundary; async patterns
7.2   HIGH      6      src/api/client.ts         error handling weak
6.8   HIGH      3      src/components/Cart.tsx   heavy component

Exit code: 1 (FAIL)
```

**Traditional tools:** "Missing semicolon on line 42"  
**DiffeSense:** "This auth file has 12 dependents and 4 side-effects. Run `npm test -- auth`"

---

## Quick Start

### GitHub Actions (60 seconds)

```yaml
# .github/workflows/diffesense.yml
name: DiffeSense
on:
  pull_request:
    branches: [main]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - run: npx diffesense@latest --policy-pack enterprise --format markdown
```

### Local Development

```bash
npm install -g diffesense
dsense                           # auto-detect changes
dsense --policy-pack enterprise  # strict CI mode
dsense --format markdown         # PR comment format
```

---

## Policy Packs

Pre-configured policies for different use cases. Start in 60 seconds.

| Pack | Fail Threshold | Best For |
|------|----------------|----------|
| **startup** (default) | Risk ≥ 8.8 | Fast-moving teams |
| **enterprise** | Risk ≥ 7.5, 2+ HIGH | Strict CI gates |
| **oss** | Risk ≥ 9.2 | Open-source projects |

```bash
dsense --policy-pack enterprise
dsense init --pack enterprise
dsense packs --verbose
```

---

## Key Features

- **220+ Risk Signals** — Security, correctness, performance, framework-specific
- **Blast Radius** — See how many files depend on your changes
- **Smart Ignore** — Lockfiles and generated code filtered automatically
- **Actionable Output** — Not "add tests", but `npm test -- auth`
- **CI Ready** — GitHub Actions, GitLab CI templates included
- **Zero Config** — Works out of the box with sensible defaults

---

## Supported Frameworks

| Frontend | Backend | Mobile/Desktop |
|----------|---------|----------------|
| React, Next.js | Node.js, Express | React Native, Expo |
| Vue, Nuxt | NestJS, Fastify | Electron, Tauri |
| Angular | GraphQL, REST | |
| Svelte, SvelteKit | WebSocket, SSE | |

---

## Documentation

| Guide | Description |
|-------|-------------|
| [Quick Start](docs/QUICK_START.md) | Get started in 5 minutes |
| [CLI Reference](docs/CLI_REFERENCE.md) | All commands and options |
| [Policy Packs](docs/POLICY_PACKS.md) | Enterprise/Startup/OSS configs |
| [Detectors](docs/DETECTORS.md) | 220+ signal reference |
| [Output Formats](docs/OUTPUT_FORMATS.md) | Console, Markdown, JSON |

---

## Programmatic API

```typescript
import { analyze } from 'diffesense';

const result = await analyze({
  cwd: '/path/to/repo',
  scope: 'branch',
  base: 'main',
});

console.log(`Exit: ${result.exitCode}`);
console.log(`Blockers: ${result.summary.blockerCount}`);
```

---

## License & Brand

**License:** [Apache-2.0](LICENSE) — Free for commercial use, modification, and distribution.

**Brand:** See [BRAND_GUIDELINES.md](BRAND_GUIDELINES.md) for name and logo usage.

**Security:** See [SECURITY.md](SECURITY.md) for reporting vulnerabilities.

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Support

- [Documentation](docs/)
- [Report Issues](https://github.com/djkepa/diffesense/issues)
- [Discussions](https://github.com/djkepa/diffesense/discussions)
- Email: banegrozdanovic@gmail.com

---

<p align="center">
  <sub>If DiffeSense helps you ship better code, consider giving it a ⭐</sub>
</p>
