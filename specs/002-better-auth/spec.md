# Feature Specification: Better Auth Authentication System

**Feature Branch**: `002-better-auth`  
**Created**: 2025-11-24  
**Status**: Draft  
**Input**: User description: "i want to add better auth for authentication, use Nio to: query https://better-auth.com/docs docs for better context and implement a complete auth system with Google OAuth, session management, and protected routes"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Google onboarding in one click (Priority: P1)

Prospective workspace users need to sign up or sign in with their Google account via Better Auth and land inside the Huskit workspace with an active session.

**Why this priority**: Without a frictionless OAuth onboarding flow there is no way to access the product, so this is the critical path for activation.

**Independent Test**: Trigger the Google OAuth button from a clean browser profile, complete consent, and confirm the user record plus session are created and redirected to the post-login destination without developer assistance.

**Acceptance Scenarios**:

1. **Given** an unauthenticated visitor on the landing page, **When** they click “Continue with Google” and approve scopes, **Then** a Huskit account is created/updated, a session cookie is issued, and the user is redirected to the default dashboard.
2. **Given** an existing user attempting Google sign-in, **When** the provider returns the existing email, **Then** the system links to the prior account instead of creating a duplicate and resumes the session.

---

### User Story 2 - Session continuity & recovery (Priority: P2)

Returning members expect their session to persist across tabs/devices, automatically refresh within the configured lifetime, and allow explicit sign-out from any device.

**Why this priority**: Stable session management protects security while avoiding repeated OAuth prompts that would hurt engagement.

**Independent Test**: Use automated tests (or manual QA) to verify session creation, renewal, expiration, and revocation states by inspecting session tables and cookies without exercising the full app.

**Acceptance Scenarios**:

1. **Given** an authenticated user actively working, **When** the session nears expiration, **Then** the system refreshes it (per Better Auth sliding window) without interrupting work.
2. **Given** a user clicking “Sign out” on any device, **When** the request is processed, **Then** all corresponding sessions become invalid and protected requests return to the login screen.

---

### User Story 3 - Protected workspace navigation (Priority: P3)

Any page or API under `/app/**` must block unauthenticated requests and gracefully redirect users to start the OAuth flow.

**Why this priority**: Huskit handles sensitive workspace assets; protecting server-side routes prevents accidental leakage and supports compliance.

**Independent Test**: Use route guard tests (Remix loaders/actions + API handlers) to assert responses: authorized requests succeed, unauthorized ones redirect or error as defined.

**Acceptance Scenarios**:

1. **Given** an unauthenticated request to `/app/projects`, **When** Better Auth middleware detects no valid session, **Then** the user is redirected to the login entry with the original URL as the post-login callback.
2. **Given** a background API call with an expired/invalid session token, **When** the guard runs, **Then** the API returns a 401 JSON error plus instructions to re-authenticate.

---

### Edge Cases

- Google denies requested scopes or the user cancels consent mid-flow → show a retry screen and log the provider error.
- A user signs in with a different Google account than the one previously linked → prompt to confirm account switch and prevent silent takeover.
- Session store becomes unavailable (e.g., Supabase outage) → fall back to read-only mode that blocks sign-in and surfaces status messaging.
- Multiple tabs share an old session cookie while a background tab logs out → ensure the remaining tabs detect revocation and redirect to login without stale data.

## Assumptions

- Better Auth’s Google provider (per [docs](https://www.better-auth.com/docs/authentication/google)) will be used, requesting profile and email scopes plus any future scopes through `linkSocial`.
- Sessions follow Better Auth defaults (7-day lifetime with server-side storage per [security reference](https://www.better-auth.com/docs/reference/security)) unless configuration updates are recorded here later.
- Huskit continues using Supabase/Postgres as the primary data store; Better Auth tables live in the same database schema for observability.
- All protected Remix routes live under `/app/**`; marketing pages remain public.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The UI MUST present a “Continue with Google” action that initiates the Better Auth Google OAuth flow with the configured callback URLs.
- **FR-002**: The system MUST create or update a Huskit user record using the Google profile, merging by email and preventing duplicate accounts.
- **FR-003**: The platform MUST store OAuth account metadata (provider ID, scopes, latest access/refresh tokens) using Better Auth’s managed tables so future Google API calls can reuse tokens.
- **FR-004**: A server-managed session MUST be created after OAuth success, persisted in Postgres (or Better Auth’s supported storage), and mirrored to the browser via HTTP-only cookies.
- **FR-005**: Sessions MUST refresh automatically on activity and expire after the configured idle/absolute limits, returning users to login once invalid.
- **FR-006**: Users MUST be able to sign out explicitly, clearing client cookies and marking all related server sessions inactive.
- **FR-007**: Every server-side handler that serves workspace routes under `/app/**` MUST verify the Better Auth session before executing business logic and redirect/401 on failure.
- **FR-008**: The system MUST expose a lightweight session-status endpoint that returns the authenticated user profile plus session state for client-side guards.
- **FR-009**: Auth flows MUST log security events (sign-in, sign-out, token errors, scope upgrades) to the existing telemetry pipeline so incidents can be audited.
- **FR-010**: Administrative tooling MUST provide visibility into active sessions per user, including the ability to revoke individual sessions if compromise is suspected.

### Key Entities *(include if feature involves data)*

- **AuthenticatedUser**: Canonical Huskit user record storing email, display name, tenant membership, MFA flags, and linkage to OAuth accounts.
- **OAuthAccount**: Provider linkage (providerId, providerUserId, scopes granted, last token refresh, error state) referencing `AuthenticatedUser`.
- **SessionEnvelope**: Server-side session object storing sessionId, userId, issuedAt, expiresAt, device metadata, and revocation reason.
- **RouteAccessPolicy**: Mapping of protected routes (patterns) to minimum authentication requirements, used by guards to determine redirect vs. JSON 401 behavior.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: ≥95% of first-time Google sign-ins complete in under 30 seconds without manual support intervention.
- **SC-002**: Session-related support tickets drop below 2 per week within 30 days of launch.
- **SC-003**: ≥99% of requests to `/app/**` originate from authenticated sessions (measured via telemetry), with unauthorized attempts redirected/blocked.
- **SC-004**: Security team can revoke compromised sessions within 2 minutes using the provided tooling, confirmed in quarterly exercises.
