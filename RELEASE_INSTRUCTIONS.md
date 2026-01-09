# Release Instructions for v1.0.0

## 🚀 Fresh Start - Clean Git History

Follow these steps to create a clean git history and release v1.0.0:

---

## Step 1: Backup Current State

```bash
cd /c/Users/Kepa/Desktop/diffesense

# Create backup branch (optional, just in case)
git branch backup-old-history
```

---

## Step 2: Remove Git History

```bash
# Remove .git folder (this deletes all history)
rm -rf .git

# Initialize fresh git repo
git init

# Set main as default branch
git branch -M main
```

---

## Step 3: Create Initial Commit

```bash
# Add all files
git add .

# Create initial commit
git commit -m "Release: v1.0.0

DiffeSense - Framework-agnostic JavaScript/TypeScript change-risk engine

Features:
- Signal-based risk detection (critical, behavioral, maintainability)
- Top N issue prioritization
- Blast radius calculation
- Framework-specific profiles (React, Vue, Angular, Node.js)
- Multiple output formats (console, markdown, JSON)
- CI/CD integration (GitHub Actions, GitLab CI)
- Deterministic analysis
- Plugin system
- CODEOWNERS integration
- Test runner detection

Built with ❤️ by Branislav Grozdanovic"
```

---

## Step 4: Create Git Tag

```bash
# Create annotated tag for v1.0.0
git tag -a v1.0.0 -m "Release v1.0.0

First public release of DiffeSense CLI.

Features:
- Complete signal detection system
- Multi-format output (console, markdown, JSON)
- CI/CD templates
- Comprehensive documentation
- 196 passing tests
- Production-ready

Package size: 141.4 kB
Total files: 183"
```

---

## Step 5: Add Remote and Push

```bash
# Add GitHub remote (replace with your repo URL)
git remote add origin https://github.com/djkepa/diffesense.git

# Push main branch
git push -u origin main

# Push tags
git push origin --tags
```

---

## Step 6: Publish to npm

```bash
# Make sure you're logged in to npm
npm whoami

# If not logged in:
npm login

# Publish to npm (public)
npm publish --access public
```

---

## Step 7: Create GitHub Release

1. Go to https://github.com/djkepa/diffesense/releases
2. Click "Create a new release"
3. Select tag: `v1.0.0`
4. Release title: `v1.0.0 - Initial Public Release`
5. Description:

```markdown
# DiffeSense v1.0.0 🎉

**First public release!**

DiffeSense is a framework-agnostic JavaScript/TypeScript change-risk engine that analyzes your PR changes and tells you which files are risky and what to do about them.

## 🚀 Features

- **Signal-based risk detection** - Critical, behavioral, and maintainability signals
- **Top N prioritization** - Focus on what matters
- **Blast radius calculation** - Understand impact
- **Framework-specific profiles** - React, Vue, Angular, Node.js
- **Multiple output formats** - Console, Markdown, JSON
- **CI/CD ready** - GitHub Actions, GitLab CI templates
- **Deterministic** - Same input → same output
- **Plugin system** - Extend with custom detectors
- **100% Free & Open Source** - MIT License

## 📦 Installation

```bash
npm install -g @diffesense/cli
```

## 📖 Documentation

- [Quick Start Guide](https://github.com/djkepa/diffesense/blob/main/docs/QUICK_START.md)
- [CLI Reference](https://github.com/djkepa/diffesense/blob/main/docs/CLI_REFERENCE.md)
- [Full Documentation](https://github.com/djkepa/diffesense#documentation)

## 📊 Stats

- **Package size:** 141.4 kB
- **Total files:** 183
- **Tests:** 196 passing
- **TypeScript:** 100% coverage

## 🙏 Thank You

Thank you for using DiffeSense! If it helps you ship better code, consider giving it a ⭐ on GitHub.

---

**Full Changelog:** https://github.com/djkepa/diffesense/blob/main/CHANGELOG.md
```

6. Attach `diffesense-cli-1.0.0.tgz` (create with `npm pack`)
7. Click "Publish release"

---

## Step 8: Verify Everything

```bash
# Test npm package
npm install -g @diffesense/cli
dsense --version
# Should show: 1.0.0

# Test on a project
cd /path/to/some/project
dsense --commit HEAD

# Uninstall test version
npm uninstall -g @diffesense/cli
```

---

## Step 9: Announce 🎉

Share on:
- Twitter/X
- Reddit (r/javascript, r/typescript, r/node)
- Dev.to
- Hacker News
- LinkedIn

Example post:

```
🎉 Launching DiffeSense v1.0.0!

A framework-agnostic risk engine for JavaScript/TypeScript PRs.

Instead of "Missing semicolon on line 42", it tells you:
- "This auth file has 23 dependents"
- "Run: npm test -- auth"
- "Review: @security-team"

100% free & open-source (MIT)

npm install -g @diffesense/cli

https://github.com/djkepa/diffesense

#JavaScript #TypeScript #DevTools #OpenSource
```

---

## 🎯 Checklist

Before releasing, make sure:

- [ ] All tests pass (`npm test`)
- [ ] Build succeeds (`npm run build`)
- [ ] README is up-to-date
- [ ] CHANGELOG is up-to-date
- [ ] package.json version is 1.0.0
- [ ] LICENSE file exists
- [ ] Documentation is complete
- [ ] `.npmignore` is correct
- [ ] Git history is clean
- [ ] GitHub repo is public
- [ ] npm account is ready

---

## 🐛 If Something Goes Wrong

### Unpublish from npm (within 72 hours)

```bash
npm unpublish @diffesense/cli@1.0.0
```

### Delete Git tag

```bash
# Local
git tag -d v1.0.0

# Remote
git push origin :refs/tags/v1.0.0
```

### Delete GitHub release

Go to https://github.com/djkepa/diffesense/releases and delete manually.

---

## 📞 Support

If you need help:
- GitHub Issues: https://github.com/djkepa/diffesense/issues
- Email: contact@diffesense.dev

---

**Good luck with the launch!** 🚀

