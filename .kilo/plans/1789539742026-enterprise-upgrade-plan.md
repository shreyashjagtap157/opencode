# Enterprise-Grade Implementation Plan for OpenCode

## Overview

This plan transforms OpenCode from its current solid foundation into an enterprise-grade, space-grade development platform through systematic improvements across testing, CI/CD, observability, security, performance, and developer experience.

## Phase 1: CI/CD Infrastructure (Foundational)

### 1.1 GitHub Actions Pipeline Setup
**File:** `.github/workflows/ci.yml`
**Steps:**
1. Create `.github/workflows/` directory
2. Add TypeScript type checking workflow:
   - Trigger on `push` and `pull_request`
   - Checkout code, setup Bun 1.3+
   - Install dependencies with `bun install`
   - Run `bunx turbo typecheck` per package
   - Upload type errors as annotations
3. Add lint workflow:
   - Run `bunx oxlint` across all packages
   - Fail on any lint errors
4. Add test workflow:
   - Run tests per package using `bun test`
   - Generate coverage reports with `--coverage` flag
   - Upload coverage to Codecov or Coveralls
   - Enforce minimum 80% coverage threshold

### 1.2 Release Pipeline
**File:** `.github/workflows/release.yml`
**Steps:**
1. Create release workflow triggered on tag push
2. Build all packages with `bun run build` in affected packages
3. Generate changelog from commits using `script/changelog.ts`
4. Publish npm packages with provenance
5. Create GitHub release with changelog
6. Deploy to staging/production environments using SST

### 1.3 Branch Protection Rules
**Steps:**
1. Require CI checks to pass before merge
2. Require minimum 1 review approval
3. Require conversation resolution
4. Block force pushes
5. Enable auto-merge for dependabot PRs after CI passes

## Phase 2: Testing Infrastructure (Quality Assurance)

### 2.1 Test Framework Standardization
**Files:** Modify test files across all packages
**Steps:**
1. Audit existing test files in `packages/*/test/` and `packages/*/src/**/*.test.ts`
2. Ensure all tests use Bun's native test runner with consistent patterns
3. Add test template file for new tests
4. Configure test timeouts consistently (default: 30s, E2E: 60s)
5. Add test naming conventions to AGENTS.md

### 2.2 Test Coverage Requirements
**File:** `bunfig.toml` (add test configuration)
**Steps:**
1. Add coverage thresholds to `bunfig.toml`:
```toml
[test]
coverage = { enabled = true, threshold = 80, reports = ["text", "lcov"] }
```
2. Create coverage exclusions file for test files, mocks, and type definitions
3. Add `script/check-coverage.ts` to validate minimum coverage

### 2.3 E2E Test Infrastructure
**Files:** `packages/app/e2e/`
**Steps:**
1. Audit existing Playwright test suite
2. Add test fixtures for session creation, model selection, and tool execution
3. Create test database isolation using temp directories
4. Add parallel test execution configuration
5. Configure retry on failure (max 2 retries)

### 2.4 Property-Based Testing
**Files:** New test files in `packages/core/test/`
**Steps:**
1. Add `fast-check` dependency to core package
2. Create property tests for:
   - Session ID generation (uniqueness, prefix validation)
   - Event sequence validation (monotonicity, uniqueness)
   - Prompt admission conflict detection
3. Add property tests for model resolution edge cases
4. Configure property test runner with sufficient iterations (1000+)

### 2.5 Mutation Testing
**Files:** `packages/core/package.json` (add dev dependency)
**Steps:**
1. Add `stryker` as dev dependency in core package
2. Configure mutation testing for critical modules:
   - `event.ts`
   - `session/input.ts`
   - `session/projector.ts`
3. Add `test:mutation` script
4. Integrate mutation score into quality gate

## Phase 3: Observability & Monitoring

### 3.1 Structured Logging Implementation
**Files:** `packages/core/src/effect/`, `packages/opencode/src/`
**Steps:**
1. Add `@effect/logging` and `@effect/opentelemetry` dependencies
2. Create `Logger` service in core package:
```ts
// packages/core/src/effect/logger.ts
export const Logger = Layer.use(Logger.defaultLogFormat)
```
3. Replace all `console.log`/`console.error` with Effect logging calls
4. Add structured log context (request ID, session ID, user ID)
5. Configure log levels per environment (debug in dev, warn in prod)
6. Add log filtering for sensitive data (API keys, tokens)

### 3.2 OpenTelemetry Integration
**File:** `packages/core/src/observability/`
**Steps:**
1. Create `observability.ts` with tracing and metrics setup
2. Add spans to critical operations:
   - Session creation and prompt admission
   - Model resolution and API calls
   - File system operations
   - Tool execution
   - Git operations
3. Add metrics for:
   - Request latency histograms
   - Request count counters
   - Error rate counters
   - Token usage gauges
4. Configure exporter for development (console) and production (OTLP)

### 3.3 Health Check Endpoints
**Files:** `packages/protocol/src/groups/health.ts`
**Steps:**
1. Extend health check endpoint to include dependency checks:
   - Database connectivity
   - LLM provider API status
   - Git repository access
   - File system access
2. Add liveness and readiness probes
3. Include version and build information
4. Add dependency detail (latency, last check time)

### 3.4 Metrics Dashboard
**Steps:**
1. Create Grafana dashboard JSON for import
2. Dashboard panels:
   - Request latency (p50, p90, p99)
   - Error rates by endpoint
   - Token usage by model/provider
   - Session lifecycle metrics
   - Database query performance
   - Cache hit rates

## Phase 4: Security Hardening

### 4.1 Security Scanning Pipeline
**Files:** `.github/workflows/security-audit.yml`
**Steps:**
1. Add `npm audit` for dependency vulnerability scanning
2. Add `gitleaks` for secret scanning in code
3. Add `codeql-action` for static code analysis:
   - JavaScript/TypeScript analysis
   - Configure queries for common vulnerabilities
   - Upload SARIF results to GitHub Security tab
4. Add `snyk` for SCA (Software Composition Analysis)

### 4.2 Input Validation & Sanitization
**Files:** `packages/function/src/api.ts`, `packages/opencode/src/server/`
**Steps:**
1. Replace raw `c.req.json()` parsing with validated schemas
2. Add input length validation for all endpoints
3. Sanitize file paths to prevent path traversal attacks
4. Add request body size limits
5. Implement rate limiting middleware using `@upstash/ratelimit` or in-memory implementation

### 4.3 Security Headers
**Files:** `packages/opencode/src/server/index.ts`
**Steps:**
1. Add `helmet` middleware to Hono app
2. Configure security headers:
   - Content-Security-Policy
   - X-Content-Type-Options: nosniff
   - X-Frame-Options: DENY
   - Strict-Transport-Security
   - Referrer-Policy
3. Add CORS configuration with explicit allow-list

### 4.4 Secrets Management
**Files:** `packages/core/src/credential/`
**Steps:**
1. Audit credential storage mechanisms
2. Add encryption at rest for credential values
3. Implement secret rotation workflow
4. Add secret versioning with audit trail
5. Create secret scanning for credential patterns

### 4.5 OAuth Security Hardening
**Files:** `packages/core/src/oauth/`
**Steps:**
1. Add PKCE (Proof Key for Code Exchange) for OAuth flows
2. Implement state parameter validation
3. Add token expiration handling with refresh logic
4. Store OAuth state securely with expiration

## Phase 5: Performance Optimization

### 5.1 Caching Strategy
**Files:** New files in `packages/core/src/cache/`
**Steps:**
1. Create Redis-based caching layer:
```ts
// packages/core/src/cache/redis.ts
export const RedisCache = Layer.make(RedisClient, ...)
```
2. Cache layers:
   - Model catalog (5 min TTL)
   - Tool definitions (10 min TTL)
   - Git repository metadata (1 min TTL)
   - File system operations (5 min TTL)
3. Add cache warming for frequently accessed data
4. Implement cache invalidation on writes
5. Add fallback to memory cache when Redis unavailable

### 5.2 Database Performance
**Files:** `packages/core/src/session/sql.ts`, `packages/core/src/event/sql.ts`
**Steps:**
1. Audit existing SQL queries for N+1 problems
2. Add database indexes:
   - Session table: `time_created`, `project_id`, `workspace_id`
   - SessionMessage table: `session_id`, `seq`, `type`
   - Event table: `aggregate_id`, `seq`, `type`
3. Add query result caching for read-heavy operations
4. Implement batch operations for bulk inserts
5. Add connection pool monitoring

### 5.3 LLM Provider Optimization
**Files:** `packages/core/src/llm/`, `packages/core/src/plugin/provider/`
**Steps:**
1. Add token usage tracking per request
2. Implement request caching for non-mutating operations
3. Add timeout handling per provider
4. Implement retry logic with exponential backoff
5. Add health checks for each provider API

### 5.4 TUI Performance
**Files:** `packages/opencode/src/cli/cmd/tui/`
**Steps:**
1. Optimize render cycle to minimize redraws
2. Add virtual scrolling for message lists
3. Implement message buffering for batched updates
4. Add lazy loading for file attachments
5. Optimize keyboard input handling latency

## Phase 6: Documentation & Knowledge Management

### 6.1 API Documentation Generation
**Files:** `specs/project.md`, `packages/protocol/`
**Steps:**
1. Generate OpenAPI spec from protocol definitions
2. Add Swagger UI integration for API explorer
3. Create API reference documentation site
4. Add request/response examples for all endpoints
5. Implement API versioning strategy

### 6.2 System Architecture Documentation
**File:** `docs/architecture/`
**Steps:**
1. Create architecture overview document with component diagrams
2. Document data flow through Session V2 lifecycle
3. Add database schema documentation with entity relationships
4. Document provider/plugin integration architecture
5. Create deployment architecture diagrams

### 6.3 Deployment Guides
**File:** `docs/deployment/`
**Steps:**
1. Create deployment guide for self-hosted SST deployment
2. Add production checklist (security, monitoring, backups)
3. Document environment variable configuration
4. Add troubleshooting guide for common deployment issues
5. Create disaster recovery procedures

## Phase 7: Enterprise Features

### 7.1 Multi-Tenancy Support
**Files:** `packages/core/src/`, `packages/schema/src/`
**Steps:**
1. Add tenant ID to session schema
2. Implement tenant isolation in database queries
3. Add tenant-based access control
4. Create tenant management APIs
5. Add tenant-specific resource limits

### 7.2 Admin Console
**Files:** `packages/enterprise/`
**Steps:**
1. Create admin dashboard with:
   - User management
   - Session monitoring
   - Provider status
   - System health
   - Audit logs
2. Add role-based access control (RBAC)
3. Implement session management (interrupt, revoke)
4. Add configuration management UI
5. Create billing/usage dashboard

### 7.3 Audit Trail
**Files:** `packages/core/src/audit/`
**Steps:**
1. Create audit event schema
2. Log all security-sensitive operations:
   - Session creation/deletion
   - Provider configuration changes
   - Model selection changes
   - File access operations
3. Add audit log querying API
4. Implement audit log retention policies
5. Add audit log export functionality

## Phase 8: Operational Excellence

### 8.1 Backup & Disaster Recovery
**Files:** `infra/`
**Steps:**
1. Implement database backup strategy:
   - Daily full backups
   - Hourly incremental backups
   - Backup encryption at rest
2. Create restore procedures documentation
3. Add backup verification tests
4. Implement cross-region replication for critical data

### 8.2 Deployment Automation
**Files:** `.github/workflows/deploy.yml`
**Steps:**
1. Add blue-green deployment strategy
2. Implement canary deployments for major changes
3. Add automated rollback on failure
4. Create deployment health checks
5. Add deployment status notifications

### 8.3 Incident Response
**Files:** `docs/incident-response/`
**Steps:**
1. Create incident response runbook
2. Define on-call rotation schedule
3. Add alerting rules for critical issues:
   - High error rates (>1%)
   - High latency (>95th percentile)
   - Provider API failures
   - Database connection failures
4. Create post-mortem template
5. Add incident simulation exercises

## Implementation Order

1. **Phase 1 (CI/CD)** - Establishes foundation for all other improvements
2. **Phase 2 (Testing)** - Ensures quality before scaling features
3. **Phase 4 (Security)** - Protects the platform from day one
4. **Phase 3 (Observability)** - Provides visibility into system health
5. **Phase 5 (Performance)** - Optimizes based on observed metrics
6. **Phase 6 (Documentation)** - Guides future development and operations
7. **Phase 7 (Enterprise Features)** - Adds business value
8. **Phase 8 (Operational Excellence)** - Ensures production readiness

## Success Metrics

- **Code Quality**: 95%+ TypeScript type coverage, zero lint errors, 80%+ test coverage
- **Reliability**: <0.1% error rate, <100ms p95 latency for API requests
- **Security**: Zero critical/high vulnerabilities in dependencies, monthly security scans
- **Performance**: <2s cold start for serverless functions, <500ms API response time
- **Developer Experience**: <5min local setup time, <1hr onboarding time for new contributors
- **Operational**: Automated deployments, zero-downtime releases, <15min MTTR for incidents