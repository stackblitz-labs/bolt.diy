# Senior Architecture Review: [FEATURE_NAME]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Phase**: [0: Preflight | 1: Alignment] | **Gate Status**: [Pass | Conditional | Fail]

---

## 0. Scope & Critical Paths

### Primary User Journeys
1. [User action → system response → outcome]
2. [...]

### Critical Path Operations (Latency/Throughput Sensitive)
| Operation | Expected Load | Latency Target | Throughput Target |
|-----------|---------------|----------------|-------------------|
| [name] | [N req/s] | [< Xms] | [X/s] |

### Data Sensitivity Classification
- [ ] Public
- [ ] Internal
- [ ] Confidential (secrets, API keys)
- [ ] PII (user data, personal info)
- [ ] Regulated (GDPR, HIPAA, PCI-DSS)

---

## 1. Architecture Design

### 1.1 Components and Responsibilities (SRP Analysis)

| Component/Module | Single Responsibility | Non-Responsibilities | Change Vectors |
|------------------|----------------------|----------------------|----------------|
| [name] | [one sentence: what it does] | [what it explicitly does NOT do] | [what external changes force edits] |
| ... | ... | ... | ... |

### 1.2 Clean Architecture Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│ INFRASTRUCTURE                                              │
│ [List: frameworks, DB clients, HTTP servers, UI components] │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ INTERFACE ADAPTERS                                   │   │
│  │ [List: controllers, presenters, serializers, repos]  │   │
│  │  ┌─────────────────────────────────────────────┐     │   │
│  │  │ USE CASES (Application Services)             │    │   │
│  │  │ [List: feature handlers, orchestrators]      │    │   │
│  │  │  ┌─────────────────────────────────────┐     │    │   │
│  │  │  │ ENTITIES (Domain Models)             │    │    │   │
│  │  │  │ [List: core business objects/rules]  │    │    │   │
│  │  │  └─────────────────────────────────────┘     │    │   │
│  │  └─────────────────────────────────────────────┘     │   │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

**Layer Contents**:
- **Entities**: [e.g., User, Order, Transaction - pure domain logic, no frameworks]
- **Use Cases**: [e.g., CreateOrderUseCase, ProcessPaymentHandler - application orchestration]
- **Adapters**: [e.g., UserController, OrderRepository, PaymentGateway - interface implementations]
- **Infrastructure**: [e.g., FastAPI, PostgreSQL, Redis, React - frameworks and drivers]

### 1.3 Dependency Rule Verification

| Source Layer | Target Layer | Allowed? | Status |
|--------------|--------------|----------|--------|
| Entities → Use Cases | ❌ | Should not exist | [✓ Clean / ⚠️ Violation: reason] |
| Entities → Adapters | ❌ | Should not exist | [✓ Clean / ⚠️ Violation: reason] |
| Entities → Infrastructure | ❌ | Should not exist | [✓ Clean / ⚠️ Violation: reason] |
| Use Cases → Adapters | ❌ | Should not exist | [✓ Clean / ⚠️ Violation: reason] |
| Use Cases → Infrastructure | ❌ | Should not exist | [✓ Clean / ⚠️ Violation: reason] |
| Use Cases → Entities | ✓ | Allowed | [✓ OK] |
| Adapters → Use Cases | ✓ | Allowed (via ports) | [✓ OK] |
| Adapters → Entities | ✓ | Allowed (for mapping) | [✓ OK] |
| Infrastructure → Adapters | ✓ | Allowed | [✓ OK] |

### 1.4 Ports and Adapters (Abstractions)

| Port (Interface) | Owned By | Implemented By | Purpose |
|------------------|----------|----------------|---------|
| [e.g., UserRepository] | Use Case Layer | [e.g., PostgresUserRepository] | [Abstract persistence] |
| [e.g., PaymentGateway] | Use Case Layer | [e.g., StripeGateway] | [Abstract payment processing] |
| ... | ... | ... | ... |

---

## 2. SOLID Principles Evaluation

### Single Responsibility Principle (SRP)
**Status**: [✓ Pass | ⚠️ Conditional | ❌ Fail]

| Component | Responsibility | Violation Risk | Evidence |
|-----------|----------------|----------------|----------|
| [name] | [single focus] | [None / Low / Medium / High] | [why it passes or fails] |

**Change Vector Analysis**:
- What changes might force edits to multiple components? [List]
- Are business logic and infrastructure concerns separated? [Yes/No + evidence]

### Open/Closed Principle (OCP)
**Status**: [✓ Pass | ⚠️ Conditional | ❌ Fail]

| Extension Point | Mechanism | What Stays Stable |
|-----------------|-----------|-------------------|
| [e.g., new payment providers] | [Strategy pattern] | [PaymentUseCase] |
| [e.g., new export formats] | [Plugin registry] | [ExportService core] |

**Evidence**: [How can new variants be added without modifying existing code?]

### Liskov Substitution Principle (LSP)
**Status**: [✓ Pass | ⚠️ Conditional | ❌ Fail]

| Base Type | Subtypes | Invariants Maintained? | Contract Tests Planned? |
|-----------|----------|------------------------|------------------------|
| [e.g., Repository] | [PostgresRepo, RedisRepo] | [Yes/No + why] | [Yes/No] |

**Evidence**: [Can all implementations be used interchangeably?]

### Interface Segregation Principle (ISP)
**Status**: [✓ Pass | ⚠️ Conditional | ❌ Fail]

| Interface | Methods | Callers Use All? | Split Needed? |
|-----------|---------|------------------|---------------|
| [name] | [count] | [Yes/No] | [Yes/No + how] |

**Evidence**: [Are interfaces designed from callers' perspective?]

### Dependency Inversion Principle (DIP)
**Status**: [✓ Pass | ⚠️ Conditional | ❌ Fail]

| High-Level Module | Depends On | Abstraction? | DI Mechanism |
|-------------------|------------|--------------|--------------|
| [e.g., OrderService] | [e.g., PaymentPort] | [Yes: interface] | [Constructor injection] |

**Evidence**: [Do high-level modules depend on abstractions, not concretions?]

---

## 3. Performance Engineering

### 3.1 Time & Space Complexity Analysis

| Critical Operation | Input Size (typical) | Time Complexity | Space Complexity | Acceptable? |
|--------------------|---------------------|-----------------|------------------|-------------|
| [e.g., search users] | N = 10,000 | O(log N) | O(1) | ✓ |
| [e.g., generate report] | N = 1,000,000 | O(N) | O(N) | ⚠️ Consider streaming |

### 3.2 Performance Budget

| Metric | Target | Current Estimate | Measurement |
|--------|--------|------------------|-------------|
| P50 Latency | < [X]ms | [estimate] | [APM/load test] |
| P95 Latency | < [X]ms | [estimate] | [APM/load test] |
| P99 Latency | < [X]ms | [estimate] | [APM/load test] |
| Throughput | [X] req/s | [estimate] | [load test] |
| Memory/request | < [X] MB | [estimate] | [profiling] |
| DB queries/request | < [X] | [estimate] | [query logging] |

### 3.3 Database Strategy

| Query Pattern | Indexes | N+1 Prevention | Pagination |
|---------------|---------|----------------|------------|
| [e.g., list orders by user] | [user_id, created_at] | [JOIN / eager load] | [cursor-based] |

### 3.4 Caching Strategy

| Data | Cache Location | TTL | Invalidation | Key Pattern |
|------|----------------|-----|--------------|-------------|
| [what] | [Redis/memory/CDN] | [duration] | [event/time-based] | [format] |

### 3.5 Scalability Considerations

- [ ] Services are stateless (session externalized)
- [ ] Horizontal scaling possible
- [ ] Load balancing strategy: [round-robin/least-conn/consistent-hash]
- [ ] Async processing for: [list expensive operations]
- [ ] Rate limiting: [algorithm, limits]

---

## 4. Security by Design

### 4.1 Threat Model (Top 5)

| # | Threat | Attack Vector | Impact | Likelihood | Mitigation |
|---|--------|---------------|--------|------------|------------|
| 1 | [e.g., SQL Injection] | [malicious input] | [data breach] | [Medium] | [parameterized queries] |
| 2 | [e.g., Broken AuthZ] | [IDOR] | [data access] | [High] | [ownership checks] |
| 3 | ... | ... | ... | ... | ... |
| 4 | ... | ... | ... | ... | ... |
| 5 | ... | ... | ... | ... | ... |

### 4.2 Input Validation

| Input Source | Validation Location | Method | Rejection Handling |
|--------------|---------------------|--------|-------------------|
| [API payload] | [Adapter boundary] | [Pydantic/Zod schema] | [400 + structured error] |
| [File upload] | [Adapter] | [type + size + content check] | [413/415 + error] |

### 4.3 Authentication & Authorization

- **AuthN Mechanism**: [JWT / Session / OAuth2 / etc.]
- **AuthZ Model**: [RBAC / ABAC / Permissions]
- **Token Storage**: [httpOnly cookie / secure storage]
- **Session Management**: [timeout: X, invalidation: how]
- **Least Privilege**: [how enforced]

### 4.4 Data Protection

- [ ] Secrets in environment variables (never in code)
- [ ] Encryption at rest: [what data, how]
- [ ] Encryption in transit: [TLS everywhere]
- [ ] PII handling: [what data, compliance requirements]
- [ ] Audit logging: [who did what, retention]

### 4.5 API Security

- [ ] Rate limiting: [X req/min per user/IP]
- [ ] Idempotency keys: [for which endpoints]
- [ ] CORS policy: [allowed origins]
- [ ] API versioning: [strategy]

---

## 5. Technical Debt Prevention

### 5.1 Coupling Analysis

| Component | Afferent (Ca) | Efferent (Ce) | Instability | Risk Level |
|-----------|---------------|---------------|-------------|------------|
| [core module] | [high: many depend on it] | [low: few deps] | [low: stable] | [Low] |
| [util module] | [low] | [high] | [high: unstable] | [Medium - monitor] |

### 5.2 Error Handling Strategy

- **Domain Errors**: [typed errors, e.g., OrderNotFoundError]
- **Infrastructure Errors**: [wrapped, retried, or surfaced]
- **Error Mapping**: [at adapter boundary]
- **Retry Policy**: [exponential backoff for transient failures]
- **Circuit Breaker**: [for external dependencies]

### 5.3 Observability Design

| Aspect | Implementation | Details |
|--------|----------------|---------|
| Logging | [structured JSON / loguru] | [correlation IDs, PII redaction] |
| Metrics | [Prometheus / StatsD] | [SLI: latency, errors, saturation] |
| Tracing | [OpenTelemetry / Jaeger] | [cross-service correlation] |
| Health Checks | [/health endpoint] | [dependency status] |

### 5.4 Test Strategy by Layer

| Layer | Test Type | Coverage Target | Tools | Focus |
|-------|-----------|-----------------|-------|-------|
| Entities | Unit | >90% | [pytest/vitest] | Business rule correctness |
| Use Cases | Unit + Mock | >80% | [pytest/vitest] | Flow correctness, port contracts |
| Adapters | Integration | >60% | [testcontainers] | Infrastructure mapping |
| System | E2E | ~40% | [Cypress/Playwright] | User journeys |

---

## 6. Architecture Decisions (ADRs)

### ADR-001: [Decision Title]
- **Status**: [Proposed | Accepted | Deprecated]
- **Context**: [Why this decision is needed]
- **Decision**: [What we decided]
- **Rationale**: [Why this option over alternatives]
- **Alternatives Considered**: [What else was evaluated]
- **Consequences**: [Positive and negative outcomes]

### ADR-002: [Decision Title]
- **Status**: ...
- **Context**: ...
- **Decision**: ...
- **Rationale**: ...
- **Alternatives Considered**: ...
- **Consequences**: ...

---

## 7. Gate Summary

### Phase 0 Preflight Checklist
- [ ] Clean architecture layers defined
- [ ] Dependency rule verified (no inward→outward deps)
- [ ] SOLID evaluation complete with evidence
- [ ] Top 5 security threats documented
- [ ] Input validation strategy defined
- [ ] Performance budget stated
- [ ] Test strategy by layer documented

### Phase 1 Alignment Checklist
- [ ] Entities in data-model.md match domain layer definition
- [ ] Contracts don't expose internal/infrastructure types
- [ ] Each API endpoint maps to a use case
- [ ] Security controls placed at correct boundaries
- [ ] Performance optimizations aligned with budget
- [ ] Risk mitigations have corresponding tests planned

**Overall Gate Status**: [Pass | Conditional Pass | Fail]

**Required Actions Before Implementation**:
1. [Action item if any]
2. [...]
