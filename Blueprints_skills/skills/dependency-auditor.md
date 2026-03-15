# Dependency Auditor Skill

Implements automated vulnerability scanning, dependency updates, and security monitoring for Node.js projects.

## Usage

Say: "Audit my dependencies" or "Check for vulnerabilities" or "Update outdated packages"

## What This Skill Does

### 1. Manual Audit Commands

Run these periodically (recommended: weekly or before releases):

```bash
# npm projects
npm audit
npm audit --production  # Only production dependencies
npm audit fix           # Auto-fix where possible
npm audit fix --force   # Force major updates (review changes!)

# pnpm projects
pnpm audit
pnpm audit --fix

# yarn projects
yarn audit
yarn npm audit
```

### 2. Outdated Package Check

```bash
# Check what's outdated
npm outdated           # npm
pnpm outdated          # pnpm
yarn outdated          # yarn

# Interactive update tool
npx npm-check-updates -i  # Interactive mode
npx npm-check-updates -u  # Update package.json (then run install)
```

### 3. GitHub Dependabot Configuration

Create `.github/dependabot.yml`:

```yaml
version: 2
updates:
  # npm dependencies
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "09:00"
      timezone: "America/Mexico_City"
    open-pull-requests-limit: 10
    commit-message:
      prefix: "chore(deps):"
    labels:
      - "dependencies"
      - "automated"
    # Group minor and patch updates
    groups:
      minor-and-patch:
        patterns:
          - "*"
        update-types:
          - "minor"
          - "patch"
    # Ignore specific packages (optional)
    ignore:
      - dependency-name: "aws-sdk"
        update-types: ["version-update:semver-major"]

  # GitHub Actions
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
    commit-message:
      prefix: "chore(ci):"

  # Docker (if applicable)
  - package-ecosystem: "docker"
    directory: "/"
    schedule:
      interval: "weekly"
    commit-message:
      prefix: "chore(docker):"
```

### 4. GitHub Actions Security Workflow

Create `.github/workflows/security-audit.yml`:

```yaml
name: Security Audit

on:
  schedule:
    # Run every Monday at 9 AM UTC
    - cron: '0 9 * * 1'
  push:
    branches: [main]
    paths:
      - 'package.json'
      - 'pnpm-lock.yaml'
      - 'package-lock.json'
      - 'yarn.lock'
  pull_request:
    branches: [main]
  workflow_dispatch:  # Allow manual trigger

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run security audit
        run: pnpm audit --audit-level=high
        continue-on-error: true

      - name: Check for critical vulnerabilities
        run: |
          CRITICAL=$(pnpm audit --json 2>/dev/null | jq '.metadata.vulnerabilities.critical // 0')
          HIGH=$(pnpm audit --json 2>/dev/null | jq '.metadata.vulnerabilities.high // 0')
          if [ "$CRITICAL" -gt 0 ] || [ "$HIGH" -gt 0 ]; then
            echo "::error::Found $CRITICAL critical and $HIGH high vulnerabilities"
            exit 1
          fi

  outdated-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Check outdated packages
        run: pnpm outdated || true

      - name: Check for major updates available
        run: |
          echo "## Outdated Packages Report" >> $GITHUB_STEP_SUMMARY
          echo '```' >> $GITHUB_STEP_SUMMARY
          pnpm outdated 2>/dev/null >> $GITHUB_STEP_SUMMARY || echo "All packages up to date" >> $GITHUB_STEP_SUMMARY
          echo '```' >> $GITHUB_STEP_SUMMARY
```

### 5. Pre-commit Hook for Audits

Add to `package.json`:

```json
{
  "scripts": {
    "preinstall": "npx npm-force-resolutions",
    "prepare": "husky install",
    "audit:ci": "pnpm audit --audit-level=high"
  },
  "husky": {
    "hooks": {
      "pre-push": "pnpm audit:ci"
    }
  }
}
```

Or with simple-git-hooks:

```json
{
  "simple-git-hooks": {
    "pre-push": "pnpm audit --audit-level=high"
  }
}
```

### 6. Snyk Integration (Optional - More Comprehensive)

```bash
# Install Snyk CLI
npm install -g snyk

# Authenticate
snyk auth

# Test for vulnerabilities
snyk test

# Monitor project (sends alerts)
snyk monitor
```

GitHub Action with Snyk:

```yaml
- name: Run Snyk to check for vulnerabilities
  uses: snyk/actions/node@master
  env:
    SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
  with:
    args: --severity-threshold=high
```

### 7. License Compliance Check

```bash
# Install license checker
npm install -g license-checker

# Check all licenses
license-checker --summary

# Fail on problematic licenses
license-checker --failOn "GPL;AGPL"

# Export to CSV
license-checker --csv --out licenses.csv
```

### 8. SBOM Generation (Software Bill of Materials)

```bash
# Using CycloneDX
npx @cyclonedx/cyclonedx-npm --output-file sbom.json

# Using Syft
syft . -o cyclonedx-json > sbom.json
```

### 9. Resolution Overrides (Force Specific Versions)

For npm (package.json):
```json
{
  "overrides": {
    "vulnerable-package": "^2.0.0",
    "lodash": "^4.17.21"
  }
}
```

For pnpm (package.json):
```json
{
  "pnpm": {
    "overrides": {
      "vulnerable-package": "^2.0.0"
    }
  }
}
```

For yarn (package.json):
```json
{
  "resolutions": {
    "vulnerable-package": "^2.0.0"
  }
}
```

## Recommended Schedule

| Task | Frequency | Automation |
|------|-----------|------------|
| `npm audit` | Every build | CI/CD |
| Dependabot PRs review | Weekly | GitHub |
| Major version updates | Monthly | Manual review |
| License audit | Quarterly | CI/CD |
| SBOM generation | Per release | CI/CD |
| Full security review | Before major releases | Manual |

## Severity Levels

| Level | Action Required |
|-------|----------------|
| **Critical** | Fix immediately, block deployment |
| **High** | Fix within 24-48 hours |
| **Moderate** | Fix within 1 week |
| **Low** | Fix in next scheduled maintenance |

## Update Strategy

### Safe Updates (Auto-merge OK)
- Patch versions (1.0.0 → 1.0.1)
- Minor versions with good test coverage (1.0.0 → 1.1.0)

### Review Required
- Minor versions of critical packages (React, Next.js, database drivers)
- Any security-related packages

### Manual Only
- Major versions (1.0.0 → 2.0.0)
- Breaking change announcements
- Packages with no test coverage

## Troubleshooting Common Issues

### Nested Dependency Vulnerabilities
When the vulnerability is in a sub-dependency:

```bash
# Find what depends on the vulnerable package
npm ls vulnerable-package

# Force resolution
# Add to package.json overrides/resolutions
```

### False Positives
Document in `.nsprc` or `audit-ci.json`:

```json
{
  "allowlist": [
    "GHSA-xxxx-xxxx-xxxx"
  ]
}
```

### Conflicting Peer Dependencies
```bash
# npm 7+
npm install --legacy-peer-deps

# Or fix in package.json
{
  "overrides": {
    "package": {
      "peer-dep": "^correct-version"
    }
  }
}
```

## Files to Create

| File | Purpose |
|------|---------|
| `.github/dependabot.yml` | Automated dependency updates |
| `.github/workflows/security-audit.yml` | CI security checks |
| `.snyk` | Snyk configuration (optional) |
| `.nsprc` | Audit allowlist for false positives |

## Verification

```bash
# Full security check
pnpm audit && pnpm outdated && license-checker --summary

# Quick CI check
pnpm audit --audit-level=high
```
