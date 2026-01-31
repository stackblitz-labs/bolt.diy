# Risk Register: [FEATURE_NAME]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Last Updated**: [DATE]

---

## Risk Summary

| Category | Count | Critical | High | Medium | Low |
|----------|-------|----------|------|--------|-----|
| Performance | [N] | [N] | [N] | [N] | [N] |
| Security | [N] | [N] | [N] | [N] | [N] |
| Maintainability | [N] | [N] | [N] | [N] | [N] |
| Correctness | [N] | [N] | [N] | [N] | [N] |
| Operations | [N] | [N] | [N] | [N] | [N] |
| **Total** | **[N]** | **[N]** | **[N]** | **[N]** | **[N]** |

---

## Risk Matrix

| Impact ↓ / Likelihood → | Low | Medium | High |
|-------------------------|-----|--------|------|
| **Critical** | Medium Risk | High Risk | Critical Risk |
| **High** | Low Risk | Medium Risk | High Risk |
| **Medium** | Low Risk | Low Risk | Medium Risk |
| **Low** | Accept | Accept | Low Risk |

---

## Performance Risks

| ID | Risk | Description | Likelihood | Impact | Risk Level | Mitigation | Detection Method | Owner | Status |
|----|------|-------------|------------|--------|------------|------------|------------------|-------|--------|
| PERF-001 | N+1 Query Pattern | [Specific location/operation] | Medium | High | High | Eager loading, query optimization | Slow query logs, load tests | [name] | [Open/Mitigated/Accepted] |
| PERF-002 | Unbounded Data Fetch | [List endpoints without pagination] | High | High | Critical | Cursor pagination, result limits | Performance tests | [name] | [status] |
| PERF-003 | Missing Cache | [Frequently accessed data] | Medium | Medium | Medium | Redis caching with TTL | Response time metrics | [name] | [status] |
| PERF-004 | Expensive Computation | [Sync operation blocking requests] | Low | High | Medium | Async processing, background jobs | Latency P99 alerts | [name] | [status] |
| PERF-005 | Memory Leak | [Large object accumulation] | Low | Critical | High | Streaming, pagination, profiling | Memory metrics | [name] | [status] |

---

## Security Risks

| ID | Risk | Description | Likelihood | Impact | Risk Level | Mitigation | Detection Method | Owner | Status |
|----|------|-------------|------------|--------|------------|------------|------------------|-------|--------|
| SEC-001 | Injection Attack | [SQL/Command/XSS vectors] | Medium | Critical | Critical | Parameterized queries, input sanitization | Security tests, WAF logs | [name] | [status] |
| SEC-002 | Broken Authorization | [IDOR, privilege escalation] | High | Critical | Critical | Ownership checks, RBAC enforcement | AuthZ tests, audit logs | [name] | [status] |
| SEC-003 | Sensitive Data Exposure | [Logs, errors, responses] | Medium | High | High | Redaction, encryption, minimal exposure | Log audits, security scans | [name] | [status] |
| SEC-004 | Authentication Bypass | [Token handling, session] | Low | Critical | High | Secure token handling, session management | Security tests, anomaly detection | [name] | [status] |
| SEC-005 | Denial of Service | [Resource exhaustion] | Medium | High | High | Rate limiting, backpressure | Traffic monitoring, alerts | [name] | [status] |

---

## Maintainability Risks

| ID | Risk | Description | Likelihood | Impact | Risk Level | Mitigation | Detection Method | Owner | Status |
|----|------|-------------|------------|--------|------------|------------|------------------|-------|--------|
| MAINT-001 | Tight Coupling | [Components with high interdependency] | Medium | Medium | Medium | Port interfaces, DI | Architecture tests (import rules) | [name] | [status] |
| MAINT-002 | God Class/Module | [Single component with too many responsibilities] | Medium | High | High | Decompose per SRP | Complexity metrics (cyclomatic) | [name] | [status] |
| MAINT-003 | Missing Abstraction | [Direct infrastructure dependencies] | Medium | Medium | Medium | Introduce ports/adapters | Dependency analysis | [name] | [status] |
| MAINT-004 | Poor Test Coverage | [Untested critical paths] | High | High | High | Test strategy enforcement | Coverage reports | [name] | [status] |
| MAINT-005 | Undocumented Decisions | [Implicit architectural choices] | High | Medium | Medium | ADRs, inline docs | Review checklist | [name] | [status] |

---

## Correctness Risks

| ID | Risk | Description | Likelihood | Impact | Risk Level | Mitigation | Detection Method | Owner | Status |
|----|------|-------------|------------|--------|------------|------------|------------------|-------|--------|
| CORR-001 | Race Condition | [Concurrent access to shared state] | Medium | High | High | Locking, idempotency, atomic operations | Concurrency tests | [name] | [status] |
| CORR-002 | Data Inconsistency | [Transaction boundaries, distributed state] | Medium | Critical | Critical | Saga pattern, eventual consistency, transactions | Integration tests | [name] | [status] |
| CORR-003 | Invalid State Transition | [Business rule violations] | Medium | High | High | State machine validation, invariant checks | Property-based tests | [name] | [status] |
| CORR-004 | Edge Case Handling | [Null, empty, boundary conditions] | High | Medium | Medium | Defensive programming, null checks | Unit tests with edge cases | [name] | [status] |
| CORR-005 | External API Changes | [Third-party breaking changes] | Low | High | Medium | Contract tests, versioned clients | Contract test CI | [name] | [status] |

---

## Operations Risks

| ID | Risk | Description | Likelihood | Impact | Risk Level | Mitigation | Detection Method | Owner | Status |
|----|------|-------------|------------|--------|------------|------------|------------------|-------|--------|
| OPS-001 | Deployment Failure | [Rollback complexity] | Medium | High | High | Blue-green deploy, feature flags | Deployment monitoring | [name] | [status] |
| OPS-002 | Missing Observability | [Blind spots in production] | Medium | High | High | Structured logs, metrics, tracing | Observability audit | [name] | [status] |
| OPS-003 | Dependency Unavailability | [External service outage] | Medium | High | High | Circuit breaker, fallbacks, retries | Health checks, alerts | [name] | [status] |
| OPS-004 | Secret Rotation | [Expired credentials] | Low | Critical | High | Auto-rotation, short TTLs | Expiration monitoring | [name] | [status] |
| OPS-005 | Resource Exhaustion | [DB connections, memory, disk] | Medium | High | High | Resource limits, autoscaling | Resource metrics | [name] | [status] |

---

## Risk Action Items

### Critical/High Priority (Must Address Before Implementation)

| Risk ID | Action | Responsible | Due Date | Status |
|---------|--------|-------------|----------|--------|
| [ID] | [Specific action to take] | [name] | [date] | [TODO/In Progress/Done] |
| ... | ... | ... | ... | ... |

### Medium Priority (Address During Implementation)

| Risk ID | Action | Responsible | Due Date | Status |
|---------|--------|-------------|----------|--------|
| [ID] | [Specific action to take] | [name] | [date] | [status] |
| ... | ... | ... | ... | ... |

### Low Priority / Accepted Risks

| Risk ID | Acceptance Rationale | Accepted By | Date |
|---------|---------------------|-------------|------|
| [ID] | [Why this risk is acceptable] | [name] | [date] |
| ... | ... | ... | ... |

---

## Risk Review Log

| Date | Reviewer | Changes Made | New Risks Added | Risks Closed |
|------|----------|--------------|-----------------|--------------|
| [date] | [name] | [summary of changes] | [IDs] | [IDs] |
| ... | ... | ... | ... | ... |

---

## Verification Matrix

| Risk ID | Verification Method | Test/Monitor Reference | Verified? |
|---------|--------------------|-----------------------|-----------|
| PERF-001 | Load test | `tests/performance/test_queries.py` | [ ] |
| SEC-001 | Security test | `tests/security/test_injection.py` | [ ] |
| SEC-002 | AuthZ test | `tests/security/test_authorization.py` | [ ] |
| MAINT-001 | Architecture test | `tests/architecture/test_imports.py` | [ ] |
| CORR-001 | Concurrency test | `tests/integration/test_concurrent.py` | [ ] |
| ... | ... | ... | [ ] |

---

## Notes

- Risks should be reviewed at each planning phase transition
- Critical/High risks must have mitigations before implementation starts
- Each risk should have at least one verification method (test or monitor)
- Risk owners are responsible for tracking mitigation progress
