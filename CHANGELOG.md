# Changelog

All notable changes to DiffeSense will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.0] - 2026-01-15

### 🎯 Complete Signal Taxonomy - 220+ Signals

This release adds comprehensive signal coverage based on the enterprise signal taxonomy, covering all major risk categories for JavaScript/TypeScript projects.

### Added

#### Security Signals (SEC-001 to SEC-024)
- **sec-eval** - Dynamic code execution (eval/Function)
- **sec-xss-sink** - XSS vulnerabilities (innerHTML, dangerouslySetInnerHTML)
- **sec-command-injection** - Shell command injection risks
- **sec-hardcoded-secret** - Hardcoded credentials detection
- **sec-sql-injection** - SQL injection patterns
- **sec-ssrf** - Server-side request forgery
- **sec-prototype-pollution** - Object.assign with untrusted input
- **sec-weak-crypto** - MD5/SHA1 usage
- **sec-cors-wildcard** - Insecure CORS configuration

#### Correctness Signals (COR-001 to COR-018)
- **cor-unhandled-promise** - Promises without await/then
- **cor-swallowed-error** - Empty catch blocks
- **cor-any-type** - TypeScript any usage
- **cor-race-condition** - Mutable state in async context
- **cor-interval-no-clear** - setInterval without cleanup
- **cor-infinite-loop** - Loops without exit condition
- **cor-complex-regex** - ReDoS-prone regex patterns

#### Maintainability Signals (MAINT-001 to MAINT-016)
- **maint-todo-no-ticket** - TODO without issue reference
- **maint-commented-code** - Dead code in comments
- **maint-magic-numbers** - Unexplained numeric constants
- **maint-duplicate-code** - Repeated code patterns
- **maint-vague-error** - Error messages without context
- **maint-test-disabled** - Skipped tests detection

#### React Extended (12 new signals)
- **react-stale-closure** - Timer capturing stale state
- **react-set-state-unmounted** - Async setState after unmount
- **react-index-key** - Array index as key
- **react-derived-state** - useState from props anti-pattern
- **react-state-mutation** - Direct state mutation
- **react-set-state-render** - setState during render
- **react-context-value-inline** - Inline context value
- **react-listener-no-cleanup** - Event listener leak
- **react-timer-no-cleanup** - Timer leak
- **react-unstable-prop** - Inline object/array props
- **next-router-change** - Next.js navigation
- **next-gss-props** / **next-static-props** - Data fetching

#### Vue Extended (16 new signals)
- **vue-reactive-assign** - Object.assign on reactive
- **vue-props-destructure** - Destructuring without toRefs
- **vue-emit-change** - Component event contract
- **vue-shallow-reactive** - Shallow reactivity usage
- **vue-to-raw** - Escaping reactivity
- **vue-trigger-ref** - Manual reactivity trigger
- **vue-effect-scope** - Effect scope management
- **vue-template-heavy** - Complex template expressions
- **vue-pinia-store** / **vue-pinia-patch** / **vue-pinia-reset** - Pinia patterns
- **vue-vuex-mutation** / **vue-vuex-action** - Vuex patterns
- **vue-store-direct-mutation** - Anti-pattern detection

#### Angular Extended (18 new signals)
- **angular-module-imports/exports/providers** - Module wiring
- **angular-provided-in** - Service scope
- **angular-module-forroot/forchild** - Module configuration
- **angular-route-guard** - Auth guard changes (security)
- **angular-route-path** - URL route changes
- **angular-lazy-load** - Lazy loading configuration
- **angular-route-redirect** - Redirect configuration
- **angular-router-navigate** - Programmatic navigation
- **angular-route-params** - Route parameter access
- **angular-resolver** - Route data resolver
- **angular-zone** - NgZone manipulation
- **angular-change-detection** - CD strategy changes
- **angular-cdr-detectchanges/markforcheck** - Manual CD

### Changed

- Base detector now includes Security, Correctness, and Maintainability detection
- All framework detectors expanded with enterprise-grade coverage
- Signal descriptions expanded to 200+ entries

---

## [1.3.0] - 2026-01-15

### 🚀 Enterprise Edition - Full Ecosystem Coverage

This release transforms DiffeSense into a comprehensive change-risk intelligence platform covering **all major JavaScript/TypeScript ecosystems**.

### Added

#### New Detector Profiles
- **Svelte/SvelteKit** - Reactivity, stores, lifecycle, load functions, form actions
- **SSR/Isomorphic** - Next.js (App/Pages Router), Nuxt, Astro, hydration issues, env leakage
- **React Native/Expo** - Native modules, platform-specific code, navigation, performance
- **Electron/Tauri** - IPC security, context isolation, window management, native APIs

#### Expanded Node.js Detection
- **GraphQL** - Schema changes, resolvers, DataLoader, Apollo Server, directives
- **Realtime** - WebSocket server, Socket.io, SSE, PubSub, backpressure handling
- **BFF patterns** - API routes, middleware chains, database operations

#### Signal Descriptions (150+ signals)
- **New SSR signals**: `ssr-browser-api`, `ssr-hydration-date`, `ssr-env-leakage`, etc.
- **Svelte signals**: `svelte-reactive-side-effect`, `sveltekit-load`, `sveltekit-actions`
- **Mobile signals**: `rn-native-module`, `rn-flatlist-no-key`, `expo-camera`, `expo-location`
- **Desktop signals**: `electron-context-bridge`, `electron-node-integration`, `tauri-command`
- **GraphQL signals**: `graphql-mutation`, `graphql-dataloader`, `graphql-security`
- **Realtime signals**: `realtime-websocket-server`, `realtime-sse`, `realtime-backpressure`

### Changed

#### Auto-Detection (Enhanced)
- Smarter framework detection based on file patterns and imports
- Priority order: Desktop → Mobile → SSR → Framework → Node → Generic
- New `getDetectorProfileName()` for display purposes
- `getAvailableProfiles()` and `getProfileDescription()` helpers

#### CLI
- `--detector` flag now accepts: `svelte`, `ssr`, `react-native`, `electron` (in addition to existing)

### Coverage Matrix

| Ecosystem | Frameworks | Key Signals |
|-----------|-----------|-------------|
| Frontend SPA | React, Vue, Angular, Svelte | hooks, reactivity, lifecycle |
| SSR/Isomorphic | Next.js, Nuxt, SvelteKit, Astro | hydration, env leakage, server components |
| Backend | Express, Nest, Fastify | routes, middleware, auth |
| GraphQL | Apollo, type-graphql | schema, resolvers, N+1 |
| Realtime | WebSocket, Socket.io, SSE | connections, backpressure |
| Mobile | React Native, Expo | native modules, navigation |
| Desktop | Electron, Tauri | IPC, security, context isolation |

---

## [1.2.2] - 2026-01-15

### Added

#### Human-Readable Signal Descriptions (Enterprise-Grade)
- **Signal descriptions map** - 50+ signals now have human-readable titles, summaries, impact descriptions, and recommendations
- **Hybrid output format** - Default shows readable titles, `--details` shows technical IDs with explanations
- **Enriched JSON output** - New `signals[]` array with full metadata for CI/CD integrations

### Changed

#### Console Output
- **Default format** - Now shows human-readable signal names:
  - Before: `→ Behavioral: process-child, fs-sync (+3.0)`
  - After: `→ Behavioral: Spawns child processes  •  Sync file I/O  •  Export signature changed`
- **Details format** - Shows signal ID + explanation:
  - `→ Spawns child processes (process-child) → Code executes external commands or scripts`

#### Markdown Output
- **PR comments** - Human-readable signal titles in summary
- **Action Required section** - Detailed breakdown with full explanations

#### JSON Output
- **New `signals` field** per file with enriched data:
  ```json
  {
    "id": "fs-sync",
    "category": "behavioral",
    "title": "Sync file I/O",
    "summary": "Synchronous file operations block event loop",
    "impact": "Server hangs during I/O, poor performance",
    "recommendation": "Use async fs/promises API instead"
  }
  ```

### Why This Matters
- **Junior developers** can now understand what signals mean without documentation lookup
- **PM/QA** can read PR comments and understand risks
- **Senior developers** still have access to technical IDs in `--details` and JSON
- **CI/CD systems** can use enriched JSON for custom dashboards and alerts

---

## [1.2.1] - 2026-01-15

### Added
- **Clickable file paths** - Absolute paths in console output that can be clicked in most terminals to open files
- **Full risk reasons** - No more truncated "Why" column, all reasons are now displayed
- **Color-coded severity badges** - CRITICAL (red), HIGH (yellow), MED (cyan), LOW (gray) with background colors
- **Colored risk icons** - Red, yellow, blue dots for different risk categories (security, behavioral, style)
- **Improved "What You Should Do" section** - Clear actionable steps when high-risk files are detected

### Improved
- **Console output** - Professional layout with clear sections, dividers, and better visual hierarchy
- **Markdown output** - Enhanced PR comments with "What You Need To Do" section listing all risk reasons per file
- **Monorepo subdirectory detection** - Shows helpful message with git root path when running from subdirectory

### Changed
- **Output format** - Files now show full paths with severity badge, risk score, and all reasons on separate lines
- **Summary section** - Cleaner table-like format with aligned values

---

## [1.2.0] - 2026-01-15

### Added

#### Smart Scope Auto-Detection
- **Auto-detect mode** - Running `dsense` without `--scope` now intelligently detects:
  - If staged changes exist → uses `staged` scope
  - Else if working tree has changes → uses `working` scope  
  - Otherwise → uses `branch` scope (CI/PR mode)
- **`--scope working`** - New scope for analyzing uncommitted changes
- **Friendly fallback messages** - When `--scope branch` finds no commits but working tree is dirty, shows helpful tip

#### Testing
- **11 new E2E tests** - Comprehensive coverage for working/staged scope detection
- **Helper function tests** - `hasStagedChanges()`, `hasWorkingChanges()`, `autoDetectScope()`

### Changed
- **CLI help updated** - `--scope` now shows `(default: auto-detect)`
- **Documentation** - README, QUICK_START, CLI_REFERENCE updated with new scope options

### Developer Experience
- Local development is now seamless: just run `dsense` and it works
- Pre-commit hooks: `dsense --scope staged --quiet`
- CI/PR: `dsense --scope branch --base main`

---

## [1.1.1] - 2026-01-15

### Changed
- **README** - Added logo and centered header
- **Documentation** - Updated all output examples to v1.1.0 format

## [1.1.0] - 2026-01-15

### Added

#### Stable Programmatic API
- **`analyze()` function** - Pure, testable core API with structured result
- **Severity classification** - CRITICAL/HIGH/MED/LOW risk levels
- **Transparent tracking** - `ignoredFiles[]` with reasons, `warnings[]` collection
- **JSON schema v1.0.0** - Versioned contract in `docs/api-schema.json`

#### Professional Output Formats
- **Console** - Clean header, summary table, severity badges, deterministic sorting
- **Markdown** - GitHub/GitLab PR comments with collapsible sections, emoji badges
- **JSON** - Enterprise-grade with `schemaVersion`, `toolVersion`, `status` field

#### Testing & Reliability
- **226 tests** (12 new E2E integration tests)
- **Contract tests** - JSON schema validation, exit code mapping
- **E2E fixtures** - Real git repo scenarios (rename, config filtering, include flags)

#### Version Management
- **Centralized version** - `src/version.ts` as single source of truth
- **Build-time check** - Automated sync verification in `npm run build`
- **npm version hooks** - Auto-test and git push on version bump

### Changed
- **CLI refactored** - Now thin wrapper around `analyze()` (one pipeline, not two)
- **Exit codes clarified** - 0=PASS, 1=FAIL, 2=ERROR (no WARN status)
- **Formatters unified** - All accept `AnalysisResult` directly
- **Docs updated** - QUICK_START, OUTPUT_FORMATS, PUBLIC_CONTRACT synced

### Fixed
- **Duplicate warnings** - Removed double console output in CLI
- **Exit/status mapping** - Markdown now correctly shows FAIL for exit 1
- **Config file filter** - Already precise (regex-based, not substring)
- **Rename parsing** - Already correct (R100/C100 use new path)

### Documentation
- **Programmatic API** - README section with examples and contract table
- **API schema** - Formal JSON schema with severity enum
- **Output examples** - Professional snapshots for all formats

## [1.0.1] - 2026-01-09

### Changed
- **Package name** - Changed from `@diffesense/cli` to `diffesense` (unscoped package)
- Updated all documentation to reflect new package name

### Fixed
- npm publish now works without requiring organization scope

## [1.0.0] - 2026-01-09

### 🎉 Initial Release

First production-ready release of DiffeSense — Change-Risk Intelligence for JavaScript/TypeScript.

### Added

#### Core Features
- **Change-Risk Analysis Engine** - Analyzes Git diffs and calculates risk scores
- **Signal Detection System** - 30+ built-in signals across 3 classes (Critical, Behavioral, Maintainability)
- **Top N Output** - Default top 3 most risky files with rationale
- **Smart Ignore System** - Automatically ignores lockfiles, generated code, build output
- **Blast Radius Calculation** - Dependency graph analysis to identify impact
- **Policy Engine** - Configurable rules with severity levels (blocker/warn/info)

#### Framework Support
- Generic JavaScript/TypeScript detector
- React-specific patterns (hooks, effects, state)
- Vue.js patterns (reactivity, lifecycle)
- Angular patterns (dependency injection, decorators)
- Node.js patterns (async, error handling, security)

#### Profiles
- `minimal` - Baseline rules only
- `strict` - Stricter thresholds
- `react` - React-optimized
- `vue` - Vue-optimized
- `angular` - Angular-optimized
- `backend` - Node.js backend-optimized

#### CLI Commands
- `dsense` - Main analysis command
- `dsense init` - Create config file
- `dsense doctor` - Environment check
- `dsense config check` - Validate config
- `dsense config print` - Show effective config
- `dsense ci github` - Generate GitHub Actions workflow
- `dsense ci gitlab` - Generate GitLab CI job

#### Output Formats
- Console (default) - Human-readable terminal output
- Markdown - PR comment-ready format
- JSON - Machine-readable for CI/CD

#### Trust & Debugging
- `--determinism-check` - Verify reproducible results
- `--explain-ignore` - Show why files are ignored
- Exit code guarantees (0/1/2)
- Cross-platform hash normalization

#### Configuration
- `.diffesense.yml` / `.diffesense.json` support
- Zod schema validation
- Helpful error messages
- Deprecated field warnings
- CLI flag overrides

#### Actions & Ownership
- CODEOWNERS parser for reviewer suggestions
- Test runner detection (jest/vitest/mocha)
- Package manager detection (npm/yarn/pnpm/bun)
- Actionable recommendations per file

#### Plugin System
- Detector Plugin API v1
- API version compatibility checks
- Security warnings for external packs
- Built-in pack registry

### Documentation
- Comprehensive README with examples
- Public Contract document (exit codes, determinism, security)
- Detector reference guide
- Profile configuration guide
- CI integration templates

### Security
- Plugin security model with explicit warnings
- No auto-loading of external code
- API version enforcement

### Testing
- 196 unit and integration tests
- 100% critical path coverage
- Cross-platform compatibility (Windows, Linux, macOS)

---

## Future Releases

See [docs/STATUS.md](docs/STATUS.md) for roadmap.

### Planned for v1.1 (Q2 2026)
- AST-based detectors (higher confidence)
- TypeScript path alias resolution
- Baseline comparison (risk trends)
- Monorepo workspace support
- Blast radius caching

### Planned for v2.0 (Q3 2026)
- GitHub App / GitLab Bot
- Dashboard with historical trends
- ML-based calibration
- Premium profiles (enterprise, compliance)

---

[1.0.0]: https://github.com/djkepa/diffesense/releases/tag/v1.0.0
