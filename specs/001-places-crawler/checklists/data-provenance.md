# Checklist: Data Completeness & PCC UI Requirements

**Purpose**: Validate that crawler + PCC UI requirements describe data provenance, cache/quota behaviors, and operator messaging with enough quality for implementation.  
**Created**: 2025-11-22  
**Scope**: Author self-review (backend + PCC UI)

## Requirement Completeness
- [x] CHK001 Are requirements specifying how each optional source (Maps, legacy site, social) contributes to mandatory sections (identity/contact/menu) for every acceptance scenario? [Completeness, Spec §User Story 1]
- [x] CHK002 Do requirements describe how PCC UI should represent provenance badges and error hints for every crawler outcome (success, partial, `NO_SOURCE_DATA`)? [Completeness, Spec §User Story 1 & FR-008]
- [x] CHK003 Are manual invalidation + force-refresh flows fully documented for both API route and PCC UI (who triggers, what data persists)? [Completeness, Spec §User Story 3 & FR-010]

## Requirement Clarity
- [x] CHK004 Is "structured payload" defined with explicit fields/format (e.g., sections, missing flags, timestamps) so devs can objectively validate outputs? [Clarity, Spec §FR-004]
- [x] CHK005 Are "provenance badges"/"actionable hints" described with measurable UI language (icons, text content, severity levels) rather than vague terms? [Clarity, Spec §User Story 1 & PCC references]
- [x] CHK006 Is the expectation for "any combination of sources" quantified (priority order, conflict resolution) to avoid ambiguous merging logic? [Clarity, Spec §User Story 1]

## Requirement Consistency
- [x] CHK007 Do telemetry requirements in FR-007 and User Story 2 align with success criteria SC-003 (fields, timing) without contradictions? [Consistency, Spec §FR-007 & SC-003]
- [x] CHK008 Are cache TTL expectations (24h default, force-refresh) consistent across assumptions, FR-005, and User Story 3 acceptance scenarios? [Consistency, Spec §Assumptions & FR-005]

## Acceptance Criteria Quality
- [x] CHK009 Can the success criteria for "normalized payload within 8 seconds" be traced to a concrete measurement point (e.g., internal service response + Supabase write), and does the spec state how to measure it? [Acceptance Criteria, Spec §SC-001]
- [x] CHK010 Are cache hit-rate and telemetry alert criteria (SC-002/SC-003) defined with data collection windows and aggregation rules so QA can verify them? [Acceptance Criteria, Spec §SC-002 & SC-003]

## Scenario Coverage
- [x] CHK011 Are PCC requirements documented for alternate flows such as partial data (some sections missing) and mixed-source conflicts, including user guidance? [Coverage, Spec §Edge Cases & User Story 1]
- [x] CHK012 Are quota-warning and quota-exhaustion UX flows described for both SSE stream + PCC UI (what message, what actions), beyond backend behavior? [Coverage, Spec §User Story 2]

## Edge Case Coverage
- [x] CHK013 Do requirements explicitly cover multi-location chains, invalid URLs, cross-tenant cache hits, and "all sources empty" scenarios with expected system + UI responses? [Edge Case, Spec §Edge Cases]

## Non-Functional Requirements
- [x] CHK014 Are performance and telemetry obligations for crawler + PCC UI defined with environmental context (Cloudflare Workers latency, log sink availability) to ensure feasibility? [Non-Functional, Spec §Performance Goals & FR-007]

## Dependencies & Assumptions
- [x] CHK015 Are dependencies on the internal Places Data Service (availability, schema, quota reporting) captured with fallback expectations if the service deviates from contract? [Dependency, Spec §Assumptions & Contracts]
- [x] CHK016 Are assumptions about operator permissions for manual invalidations and resume flows documented so security reviews know who can trigger them? [Assumption, Spec §User Story 3 & FR-010]

## Ambiguities & Conflicts
- [x] CHK017 Is the relationship between crawler error codes and PCC remediation steps fully mapped (one-to-one) to prevent conflicting guidance across sections? [Ambiguity, Spec §FR-008 & User Story narratives]
- [x] CHK018 Does the terminology for "cache hit/miss", "resume", and "refresh" remain consistent between spec, plan, and tasks, or are additional definitions needed? [Ambiguity, Spec §User Story 3 & Plan Summary]
