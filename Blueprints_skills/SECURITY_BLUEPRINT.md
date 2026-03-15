# Security Blueprint and Hardening Guide
Audience: engineers of all levels (especially beginners) building web, mobile, and API backends. This file is a living blueprint you can copy to new projects and adapt per risk.

Core idea: security as layered building blocks (“defense in depth”) that you can enable progressively. Each control below explains What, Why, When, and How.

---

## 0) 80/20 Quick Start Hardening (do this first)
- Authentication and sessions
  - Short-lived access tokens (5–15 min) + refresh tokens (rotation + reuse detection)
  - HTTP-only, SameSite cookies (web) or secure storage (mobile)
- Input and output
  - Validate all inputs (Zod/DTOs), reject by default
  - Escape output, use parameterized queries only
- Network and edges
  - Rate limit on IP and user, per-route; apply burst + sustained windows
  - Strict CORS allowlist; no wildcards with credentials
  - Security headers: CSP (report-only → enforced), HSTS, X-Frame-Options: DENY, etc.
- Sensitive operations
  - Enforce Idempotency-Key on all writes; HMAC timestamped signatures for money-moving endpoints
- Secrets and config
  - Centralized secrets manager; no secrets in code or logs; rotate regularly
- Logging and monitoring
  - Structured logs (no PII/keys), 4xx/5xx alerting, velocity anomaly alerts
- Dependency and CI/CD
  - Automated SCA (npm audit, Snyk), SAST (Semgrep), DAST (ZAP), signed builds, SBOM
- Data protection
  - Encrypt in transit (TLS 1.2+), encrypt sensitive data at rest, least-privilege DB user
- Files
  - Size/type limits, content sniffing disabled, antivirus scan, store outside web root
- Backups & DR
  - Daily encrypted backups with restore tests; retention policy

---

## 1) Core Principles (carry everywhere)
- Least privilege and default deny: users, services, DB roles, firewall rules
- Trust but verify: authenticate everything, authorize every operation
- Secure by default: strong defaults; opt-in to risky features
- Assume breach: logs, audit, detection, and response matter as much as prevention
- Small blast radius: network segmentation, per-service tokens, feature flags with kill-switches

---

## 2) Controls by Layer

### A) Client (Web + Mobile)
- Token storage
  - Web: httpOnly + Secure + SameSite cookies; avoid localStorage for tokens
  - Mobile: platform secure storage (Keychain/Keystore); never logs
- Transport and origin
  - Enforce HTTPS; SSL pinning on mobile
  - Strict CORS; preflight checks; no wildcard origins with credentials
- UX defenses
  - Respect prefers-reduced-motion (reduce animation-based CPU spikes)
  - CSRF tokens if cookie auth (or use Authorization header + strict CORS)
- Sensitive UI
  - Mask secrets/PII fields; clipboard controls; disable autofill for PIN/OTP
- File handling
  - Preview safely; client-side type/size checks; avoid embedding untrusted HTML

### B) API / Server
- Authentication
  - JWT with aud/iss/sub; rotation on refresh; revoke on compromise
  - Device/session management; 2FA for financial operations; step-up auth for risky actions
- Authorization
  - Role- and resource-based checks (RBAC/ABAC)
  - Object-level permissions and row-level checks (e.g., Postgres RLS)
- Request hygiene
  - Validate all inputs (schema); clamp sizes; enforce pagination caps; deny unknown fields
  - Rate limiting: IP + user + route with sliding window (burst + sustained)
  - Idempotency: Idempotency-Key for POST/PUT/PATCH/DELETE (prevents double-charges)
  - Replay protection: HMAC(body + timestamp + nonce), short time windows (±2–5 min)
- Response hygiene
  - Consistent error envelopes, no stack traces to clients
  - ETag + cache headers for GET; no cache for sensitive data
- Security headers (web)
  - CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy
- Logging
  - Redact secrets; hash IP/phones if privacy required; link request-id across services
- Webhooks
  - Verify provider signature + timestamp; reject replays; static allowlist of IPs/domains

### C) Database
- Accounts and roles
  - Separate read/write users; no superuser in apps
  - Enable Row Level Security (RLS) and policies for per-tenant or per-user data
- Query safety
  - Parameterized queries only; ORM prepared statements; query timeouts and statement_timeout
- Sensitive data
  - Encrypt fields (at application layer) that require secrecy (PII, tokens); don’t log
- Backups and restores
  - Automatic encrypted backups; periodic restore drills; PITR if possible
- Auditing
  - Immutable audit tables or append-only logs; track who did what and when

### D) Infrastructure / Network
- Edge
  - CDN/WAF (Cloudflare): DDoS, bot management, geo/rule blocking
  - NGINX/Ingress: connection, header, and body size limits; per-IP rate limits
- Network
  - Private subnets; service-to-service mTLS; firewall deny-all+allowlist only needed ports
- Secrets and keys
  - Cloud KMS; rotate; audit key usage; least-privilege IAM per service
- Observability
  - Central log aggregation; metrics and traces; anomaly alerts; on-call
- Containers/K8s
  - Scan images (Trivy), minimal base images, run as non-root, drop Linux capabilities
  - NetworkPolicies; read-only root FS; resource limits; secrets via CSI/KMS
- Supply chain
  - Lockfiles, provenance (SLSA), signed artifacts, SBOM (CycloneDX), Dependabot

---

## 3) Critical Controls (What, Why, When, How)

### 3.1 Rate Limiting and Abuse Prevention
- What: Limit how often a client/user/route can be called; add burst and sustained windows.
- Why: Prevent brute force, spam refresh, resource exhaustion, business logic abuse.
- When: All public APIs; stricter on auth, OTP, and money-moving endpoints.
- How:
  - Enforce per-IP and per-user keys (e.g., Redis sliding window)
  - Global defaults (e.g., 100 req/min) + route overrides (login 5/min; send money 10/min)
  - Exponential backoff on 429; include Retry-After header
  - Edge throttling (WAF/NGINX) + app-level limits for context-aware rules

### 3.2 Idempotency for Unsafe Methods
- What: Deduplicate repeated write operations.
- Why: Retries and refreshes shouldn’t duplicate payments or writes.
- When: All POST/PUT/PATCH/DELETE, especially financial transactions.
- How:
  - Require Idempotency-Key header (UUID) and stable “scope” (route or resource)
  - Cache normalized response for the key; return cached result on duplicates
  - TTL ~15–30 minutes; ensure atomic first-write semantics

### 3.3 Replay Protection for Sensitive Operations
- What: Prevent attackers from reusing a valid request.
- Why: Stolen payloads shouldn’t be reusable for fraudulent operations.
- When: Payments, withdrawals, account changes, API webhooks.
- How:
  - HMAC signature over body + timestamp + userId/nonce; short acceptance window
  - Reject stale timestamps; one-time nonce per operation; constant-time comparisons

### 3.4 CSRF vs CORS
- Cookie-based auth (web): Use CSRF tokens and SameSite=Lax/Strict
- Header-based auth (Bearer): Use strict CORS allowlist; disable credentials unless needed
- Never mix wildcard CORS with credentials; preflight must pass only for known origins

### 3.5 Security Headers and CSP
- Start CSP in report-only, monitor violations, then enforce
- Deny framing: X-Frame-Options: DENY; lock referrer and permissions
- HSTS in production (after confirming HTTPS is stable): preload if appropriate

### 3.6 Secrets and Config
- Managed secrets (Doppler, 1Password, AWS Secrets Manager)
- No secrets in code, commits, CI logs, or client bundles
- Rotate regularly; differentiated scopes per environment; short-lived credentials when possible

### 3.7 Input Validation and Output Encoding
- Define schemas (Zod) per endpoint; reject unknown fields; clamp sizes and ranges
- Sanitize filenames, MIME types, image parsing; never trust client-provided types
- Encode outputs (HTML contexts) and avoid dangerouslySetInnerHTML

### 3.8 File Upload Safety
- Pre-validate type/size; server-side sniffer and AV scanning (e.g., ClamAV)
- Store outside web root; randomize names; signed URLs; image processing in sandbox
- Strip EXIF; limit dimensions; recompress to safe formats

### 3.9 Logging, Monitoring, and Alerts
- Structured logs; request-id; user-id when authenticated
- Redact tokens/PII; segregate debug logs from prod; retention policy
- Alerts on auth failures, 5xx spikes, rate-limit breaches, velocity anomalies (send/withdraw)

### 3.10 Dependency and Supply Chain
- Automated scans (npm audit, Snyk), Semgrep rules; pin versions; update cadence
- Provenance: signed artifacts; SBOM in CI; review transitive risks for critical paths

---

## 4) Financial App Additions (Money Transmitter Context)
- Strong customer authentication
  - 2FA for login and transactions; step-up for risk (new device, high amount, geo-risk)
  - Transaction PIN separate from login; biometric on mobile
- Velocity and risk rules
  - Per-user/day and per-month caps by KYC level; geo-fencing; device fingerprinting
  - Behavior analytics: sudden spikes, structuring, rapid in/out patterns → flag/manual review
- Compliance hooks
  - Sanctions screening (OFAC/EU), PEP, adverse media checks; auto-hold suspicious transfers
  - SAR generation and audit trails; immutable logs
- Reconciliation and ledger integrity
  - Double-entry ledger; idempotent postings; reversal flows; consistent end-of-day checks
- Customer notifications
  - Real-time push/SMS/email for credits/debits; anti-phishing guidance in templates

---

## 5) Environment Strategy
- Separate dev/stage/prod; unique keys and secrets per env; limited prod access
- Feature flags for risky changes; kill-switches
- Config as code; secure defaults; runtime toggles via server-controlled flags

---

## 6) Testing and Verification (shift-left + continuous)
- SAST: Semgrep/CodeQL on PRs (block critical)
- SCA: Dependabot/Snyk on every merge
- DAST: OWASP ZAP in staging (scheduled); results triaged
- e2e security tests: auth flows, rate limits, idempotency, replay rejection
- Chaos/fault injection for auth/db/cache; ensure graceful degradation
- Red team / pentest before major launch; periodic retests
- Bug bounty or private disclosure policy

---

## 7) Incident Response (IR) Mini-Runbook
- Prepare
  - Contacts, on-call rota, comms templates; access to logs/dashboards; backup restore playbook
- Identify
  - Triage alerts; gather evidence (logs, metrics, timeline); assign severity
- Contain
  - Rotate keys; block tokens/sessions; rate limit/disable impacted features via flags
- Eradicate/Recover
  - Patch; restore from known good; backfill; increase logging temporarily
- Post-incident
  - Blameless RCA; concrete action items with owners/dates; update runbooks and tests

Template (fill during incidents):
- What happened:
- When detected:
- Impacted systems/users:
- Indicators (logs/alerts):
- Containment steps:
- Root cause:
- Fix/patch:
- Follow-ups:

---

## 8) “Gotchas” Beginners Often Miss
- JWT pitfalls
  - Missing aud/iss checks; overly long expiry; storing tokens in localStorage (XSS risk)
  - Not rotating refresh tokens; no reuse detection; not revoking on device logout
- CORS misconfig
  - Using “*” with credentials; allowing arbitrary origins from request header
- Error messages
  - Revealing if “user exists” at signup or exact reason on login (enumeration)
- Open redirects
  - Trusting next= URL params; must restrict to known domains/paths
- Path traversal
  - Using user-provided paths for file access; must normalize and restrict to whitelisted dirs
- Mass assignment
  - Blindly spreading request bodies into models; whitelist fields server-side
- SSRF
  - Fetching user-provided URLs; restrict to allowlist; block internal IP ranges
- Cryptography
  - Rolling your own crypto; prefer libs; use proper salts/peppers; constant-time comparisons
- Pagination
  - No caps -> heavy queries; enforce max limit and index-friendly order

---

## 9) Practical Snippets (pseudocode-level)

```ts
// Rate limit policy example (app-level + edge)
limits = {
  global: { windowMs: 60_000, max: 100, blockForMs: 5 * 60_000 },
  login:  { windowMs: 60_000, max: 5,   blockForMs: 15 * 60_000 },
  otpSend:{ windowMs: 10 * 60_000, max: 3 },
  otpVerify:{ windowMs: 10 * 60_000, max: 5 },
  sendMoney:{ windowMs: 60_000, max: 10 }, // plus 60/hour per user
}
```

```ts
// Idempotency headers
// Client must send: Idempotency-Key: <uuid>, X-Idempotency-Scope: /api/transfer
// Server stores normalized response against (scope, key) for 15–30 mins
```

```ts
// Replay guard headers for money-moving endpoints
X-Timestamp: 1699999999999
X-User-Id: <uuid>
X-Signature: HMAC_SHA256(userId + "." + timestamp + "." + rawBody, userSecret)
```

```bash
# CI examples
npm ci
npm audit --audit-level=high
semgrep ci
# Build SBOM
npx @cyclonedx/cyclonedx-npm --output-file sbom.xml
# DAST in staging (nightly)
zap-baseline.py -t https://staging.example.com -r zap_report.html
```

---

## 10) Security Maturity Roadmap (phased)
- MVP (Week 1–2)
  - Auth basics, input validation, rate limiting on auth + writes, secrets manager, logging, backups
- Hardening (Week 3–6)
  - CSP → enforce, idempotency + replay guard, WAF/NGINX limits, 2FA, RBAC, RLS, file safeguards
- Advanced (Week 6+)
  - Device fingerprinting, anomaly detection, token binding, mTLS mesh, signed releases + provenance, bug bounty

---

## 11) Checklists

### Launch Checklist
- [ ] HTTPS only, HSTS enabled
- [ ] CORS allowlist enforced; CSRF covered
- [ ] Rate limits on all endpoints; stricter on sensitive flows
- [ ] Idempotency + replay guards on all writes
- [ ] JWT access short-lived; refresh rotation with reuse detection
- [ ] Secrets in manager; no secrets in repo/logs
- [ ] SAST/SCA/DAST passing; dependencies updated
- [ ] Backups + restore tested; DR plan documented
- [ ] Audit logs working; alerts wired; runbooks accessible
- [ ] File uploads constrained + scanned
- [ ] Feature flags and kill-switches ready

### Ongoing Operations
- [ ] Weekly dep updates; address highs/criticals
- [ ] Review alerts; tune thresholds; test paging
- [ ] Rotate keys on schedule; audit access logs
- [ ] Run restore drills quarterly
- [ ] CSP reports reviewed; reduce unsafe-inline/eval
- [ ] Pentest/Red team at least annually or pre-major release

---

## 12) How to Apply This Blueprint
- Treat this file as your “security contract”
  - Copy to new repos as SECURITY_BLUEPRINT.md
  - Turn each section into actionable tasks/issues
  - Implement per layer, starting with the 80/20 quick start
- Keep it living
  - Update after incidents, pentests, and dependencies
  - Version it; review quarterly

Pro tip: create a “Security Pack” folder with ready-to-use middlewares (rate limit, idempotency, replay guard), header configs, Semgrep rules, and CI templates. Enable from day 1.

---
Appendix: Glossary
- SAST: Static Application Security Testing (code scanning)
- SCA: Software Composition Analysis (dependency risks)
- DAST: Dynamic Application Security Testing (runtime scanning)
- RLS: Row-Level Security (DB policies)
- SBOM: Software Bill of Materials (dependency inventory)
- HSTS: HTTP Strict Transport Security
- CSP: Content Security Policy