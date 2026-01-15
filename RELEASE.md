# Release Process

This document describes the release process for DiffeSense.

## Release Checklist

Before releasing a new version:

- [ ] All tests pass (`npm test`)
- [ ] Build succeeds (`npm run build`)
- [ ] Version synced in `package.json` and `src/version.ts`
- [ ] CHANGELOG.md updated
- [ ] Documentation updated if needed

---

## Version Bumping

Following [Semantic Versioning](https://semver.org/):

- **Patch** (x.y.0 → x.y.1): Bug fixes
- **Minor** (x.y.z → x.Y.0): New features, backward compatible
- **Major** (x.y.z → X.0.0): Breaking changes

```bash
# Update version in both files:
# - package.json
# - src/version.ts

# Build verifies sync automatically
npm run build
```

---

## Release Steps

```bash
# 1. Ensure clean state
git status
npm test
npm run build

# 2. Commit and tag
git add -A
git commit -m "Release: vX.Y.Z"
git tag -a vX.Y.Z -m "vX.Y.Z - Brief description"

# 3. Push and publish
git push origin main
git push origin vX.Y.Z
npm publish
```

---

## What Counts as Breaking?

- Removing CLI flags or commands
- Changing exit code semantics
- Changing JSON output structure
- Removing signals or changing their IDs
- Changing config file format

---

## Maintainers

- @djkepa (Branislav Grozdanovic)

---

*Last updated: January 2026*
