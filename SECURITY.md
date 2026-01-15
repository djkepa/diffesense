# Security Policy

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability in DiffeSense, please report it responsibly.

### How to Report

**DO NOT** open a public GitHub issue for security vulnerabilities.

Instead:

1. **Preferred:** Use [GitHub Security Advisories](https://github.com/djkepa/diffesense/security/advisories/new)
2. **Alternative:** Email banegrozdanovic@gmail.com with subject "DiffeSense Security"

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fixes (optional)

### Response Timeline

- **Acknowledgment:** Within 48 hours
- **Initial assessment:** Within 1 week
- **Fix:** Depends on severity, typically 1-2 weeks

---

## Supported Versions

We support the **latest minor release line**. Please update to the latest version before reporting issues.

---

## Security Best Practices

When using DiffeSense:

1. **Keep updated** — Run the latest version
2. **Review outputs** — DiffeSense output may contain file paths and code snippets
3. **CI secrets** — Be mindful of what paths are exposed in CI logs
4. **Config files** — Store `.diffesense.yml` in version control (no secrets needed)

---

## Disclosure Policy

- We follow coordinated disclosure
- We will credit reporters (unless you prefer anonymity)
- We will not take legal action against good-faith security research

---

*Last updated: January 2026*
