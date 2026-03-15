# Blueprint Analyzer Skill

Analyzes React/Next.js projects against enterprise blueprints to identify gaps, calculate compliance scores, and generate implementation roadmaps.

## Usage

Say: "Analyze my project against blueprints" or "Check blueprint compliance"

## What This Skill Does

### 1. Project Analysis
Scans your entire codebase to assess:

- **Security posture** (authentication, authorization, vulnerabilities)
- **Architecture quality** (component structure, patterns, best practices)
- **Performance optimization** (bundle size, lazy loading, caching)
- **Code quality** (TypeScript usage, testing, documentation)
- **Infrastructure** (CI/CD, monitoring, error handling)

### 2. Blueprint Compliance Scoring

Generates scores across key dimensions:

```
SECURITY COMPLIANCE: 15% → 90%
├── Authentication & Authorization: ✅
├── Input Validation: ✅
├── Rate Limiting: ✅
├── Security Headers: ✅
├── Audit Logging: ✅
└── Session Management: ✅

ARCHITECTURE COMPLIANCE: 20% → 85%
├── Component Structure: ✅
├── State Management: ✅
├── Error Boundaries: ✅
├── TypeScript: ⚠️ (partial)
├── Testing: ⚠️ (45% coverage)
└── Documentation: ❌

PERFORMANCE COMPLIANCE: 10% → 95%
├── Code Splitting: ✅
├── Lazy Loading: ✅
├── Bundle Optimization: ✅
├── Caching Strategy: ⚠️
└── Image Optimization: ✅
```

### 3. Gap Analysis Report

Identifies critical issues with severity ratings:

```markdown
## 🔴 CRITICAL (Security Risk 8/10)

1. **Authentication Bypass Vulnerability**
   - Location: src/contexts/AuthContext.jsx:47-134
   - Impact: Anyone can bypass login in production
   - Fix: Remove VITE_ENABLE_AUTH_BYPASS code

2. **No Rate Limiting**
   - Impact: Vulnerable to brute force attacks
   - Fix: Implement client & server rate limiting

## 🟡 HIGH PRIORITY

3. **No Input Validation**
   - Impact: XSS and SQL injection risks
   - Fix: Add yup schemas, DOMPurify sanitization

## 🟢 MEDIUM PRIORITY

4. **No TypeScript**
   - Impact: Higher bug probability
   - Fix: Gradual migration starting with critical files
```

### 4. Implementation Roadmap

Creates phased implementation plan:

```markdown
## Phase 1: Critical Security (Week 1-2)
- [ ] Remove auth bypass vulnerability
- [ ] Implement security headers
- [ ] Add rate limiting
- [ ] Input validation framework
- [ ] Error boundaries

## Phase 2: Data Protection (Week 3-4)
- [ ] Audit logging
- [ ] Session management
- [ ] RBAC implementation
- [ ] Encryption at rest

## Phase 3: Architecture (Week 5-6)
- [ ] TypeScript migration
- [ ] Testing framework (Vitest)
- [ ] Performance optimization
- [ ] Monitoring integration
```

## Analysis Process

### Step 1: Read Blueprint Files
```javascript
const blueprints = [
  'SECURITY_BLUEPRINT.md',
  'PROJECT_BLUEPRINT_Version3.md',
  'PROJECT_BLUEPRINT_ADVANCED_Version3.md'
];
```

### Step 2: Scan Project Structure
```javascript
const projectAnalysis = {
  framework: detectFramework(), // React, Next.js, Vue
  buildTool: detectBuildTool(), // Vite, Webpack, Turbopack
  authentication: detectAuth(), // Supabase, Auth0, Firebase
  stateManagement: detectState(), // Redux, Zustand, Context
  styling: detectStyling(), // Tailwind, CSS Modules, styled-components
  testing: detectTesting(), // Jest, Vitest, Cypress
  typescript: checkTypeScript()
};
```

### Step 3: Security Audit
```javascript
const securityIssues = [
  checkAuthBypass(),
  checkRateLimiting(),
  checkInputValidation(),
  checkSecurityHeaders(),
  checkSessionManagement(),
  checkAuditLogging(),
  checkEncryption(),
  checkDependencyVulnerabilities()
];
```

### Step 4: Generate Report
```javascript
const report = {
  overallScore: calculateScore(),
  criticalIssues: issues.filter(i => i.severity === 'critical'),
  recommendations: generateRecommendations(),
  implementationPlan: createRoadmap(),
  estimatedEffort: calculateEffortHours()
};
```

## Output Files

### Generated Reports:
1. **BLUEPRINT_ANALYSIS.md** - Full compliance report
2. **SECURITY_AUDIT.md** - Security-focused analysis
3. **IMPLEMENTATION_ROADMAP.md** - Step-by-step plan
4. **QUICK_WINS.md** - Easy improvements for immediate impact

## Scoring Methodology

### Security (40% weight)
- Authentication/Authorization: 15%
- Input Validation: 10%
- Rate Limiting: 5%
- Security Headers: 5%
- Audit Logging: 5%

### Architecture (30% weight)
- Component Structure: 10%
- State Management: 10%
- Error Handling: 5%
- Patterns & Practices: 5%

### Quality (20% weight)
- TypeScript Usage: 10%
- Test Coverage: 5%
- Documentation: 5%

### Performance (10% weight)
- Bundle Size: 5%
- Loading Strategy: 5%

## Usage Example

```bash
# Run blueprint analysis
claude: "Analyze my project against blueprints"

# Output:
📊 Blueprint Analysis Complete

Overall Compliance: 42% (NEEDS IMPROVEMENT)

Critical Issues Found: 10
- 4 Security vulnerabilities
- 3 Architecture gaps
- 3 Quality issues

Estimated effort to reach 90% compliance: 160 hours

Generated reports:
✅ BLUEPRINT_ANALYSIS.md (full report)
✅ SECURITY_AUDIT.md (security focus)
✅ IMPLEMENTATION_ROADMAP.md (action plan)
✅ QUICK_WINS.md (easy fixes)

Would you like me to start implementing Phase 1?
```

## Integration with Other Skills

Works seamlessly with:
- **Security Hardener** - Implements security fixes
- **Performance Optimizer** - Implements performance improvements
- **Architecture Modernizer** - Updates patterns and structure
- **Test Coverage Booster** - Adds missing tests

## Benefits

- **Objective Assessment:** Data-driven compliance scoring
- **Prioritized Actions:** Focus on critical issues first
- **Clear Roadmap:** Step-by-step implementation plan
- **Time Estimates:** Realistic effort calculations
- **Progress Tracking:** Measure improvements over time