# Changelog

All notable changes to DiffeSense will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
