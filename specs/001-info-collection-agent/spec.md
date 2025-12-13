# Feature Specification: Website Information Collection Agent

**Feature Branch**: `001-info-collection-agent`  
**Created**: 2025-12-09  
**Status**: Draft  
**Input**: User description: "Agent to interact with user to collect website generation information including existing website URL, Google Maps URL, and description, then trigger crawler for data enrichment"

## Clarifications

### Session 2025-12-09

- Q: What type of agent conversation approach? → A: LLM-based agent (AI interprets responses, handles variations naturally)
- Q: How are sessions identified/tied to users? → A: Authenticated users only (session tied to user account)
- Q: How to handle crawler unavailability? → A: Save data and queue crawler async (user gets confirmation, enrichment happens later)
- Q: What is the minimum description requirement? → A: No minimum (accept any non-empty description)
- Q: Data retention for incomplete sessions? → A: Keep indefinitely until user deletes

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Complete Information Collection Flow (Priority: P1)

A user wants to generate a new website for their business. They have an existing website and a Google Maps listing. The agent guides them through providing all relevant information to ensure the generated website accurately represents their business.

**Why this priority**: This is the primary happy-path that delivers the core value - collecting comprehensive business data enables accurate website generation.

**Independent Test**: Can be fully tested by initiating a website generation request with a user who provides website URL, Google Maps URL, and description. Delivers a complete data package ready for crawler processing.

**Acceptance Scenarios**:

1. **Given** a user initiates website generation, **When** the agent starts the conversation, **Then** the agent asks if they have an existing website
2. **Given** the user indicates they have an existing website, **When** they provide the URL, **Then** the agent validates the URL format and confirms receipt
3. **Given** the website URL is collected, **When** the agent proceeds, **Then** it asks for a Google Maps business listing URL
4. **Given** the user provides a Google Maps URL, **When** the agent validates it, **Then** it confirms the URL format is valid
5. **Given** both URLs are collected, **When** the agent proceeds, **Then** it asks for a description of the desired new website
6. **Given** all information is collected, **When** the user confirms completion, **Then** the system has a complete data package ready to trigger the crawler

---

### User Story 2 - Partial Information Collection (Priority: P2)

A user wants to generate a website but doesn't have an existing website or Google Maps listing. The agent gracefully handles missing information and collects whatever is available.

**Why this priority**: Many new businesses or those without online presence still need website generation. Supporting partial data ensures broader user coverage.

**Independent Test**: Can be tested by a user who responds "no" to existing website and Google Maps questions, providing only a description.

**Acceptance Scenarios**:

1. **Given** a user indicates they have no existing website, **When** they respond "no" or equivalent, **Then** the agent skips website URL collection and proceeds to Google Maps question
2. **Given** a user indicates they have no Google Maps listing, **When** they respond "no" or equivalent, **Then** the agent skips Google Maps URL collection and proceeds to description
3. **Given** only a description is provided (no URLs), **When** the collection completes, **Then** the system marks the data package as "description-only" and can still proceed

---

### User Story 3 - Information Correction and Update (Priority: P3)

A user realizes they made a mistake in one of their provided URLs or description and wants to correct it before finalizing.

**Why this priority**: Error correction improves data quality without requiring users to restart the entire flow.

**Independent Test**: Can be tested by providing information, then requesting to change a previously entered value.

**Acceptance Scenarios**:

1. **Given** a user has provided some information, **When** they indicate they want to change a previous answer, **Then** the agent allows them to update that specific field
2. **Given** a user updates a URL, **When** the new URL is validated, **Then** it replaces the previous value in the data package
3. **Given** all information is collected, **When** the agent presents a summary for confirmation, **Then** the user can see all collected data before finalizing

---

### Edge Cases

- What happens when the user provides an invalid URL format? → Agent prompts for correction with clear guidance on expected format
- What happens when the user provides a URL that appears valid but the site doesn't exist? → Accept the URL (crawler will handle verification later)
- How does the system handle users who abandon the conversation mid-flow? → Retain partial data indefinitely for session recovery; user can delete anytime
- What happens when the user provides a Google Maps URL that isn't a business listing? → Agent clarifies and requests correct business listing URL
- What happens when the user provides very minimal description? → Agent may suggest adding more detail but accepts any non-empty description
- What happens if the crawler service is unavailable? → System saves collected data immediately and queues crawler processing asynchronously; user receives confirmation without waiting

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST initiate a conversational flow when user requests website generation
- **FR-002**: System MUST ask if user has an existing website and collect URL if yes
- **FR-003**: System MUST ask if user has a Google Maps business listing and collect URL if yes
- **FR-004**: System MUST validate URL formats before accepting (basic format validation, not existence check)
- **FR-005**: System MUST collect a description of the desired new website from the user (any non-empty text is accepted)
- **FR-006**: System MUST allow users to skip optional information (existing website, Google Maps) gracefully
- **FR-007**: System MUST allow users to review and modify collected information before finalizing
- **FR-008**: System MUST present a summary of all collected information for user confirmation
- **FR-009**: System MUST package collected data in a format compatible with the crawler integration point
- **FR-010**: System MUST retain the user's description separately from crawler-enriched data
- **FR-011**: System MUST provide clear prompts and guidance at each step of the conversation
- **FR-012**: System MUST handle natural language responses (e.g., "no", "I don't have one", "skip") appropriately using LLM-based interpretation
- **FR-013**: System MUST save collected data immediately upon completion and queue crawler processing asynchronously
- **FR-014**: System MUST confirm successful data collection to user without waiting for crawler completion
- **FR-015**: System MUST allow users to delete their incomplete or completed collection sessions

### Key Entities

- **Information Collection Session**: Represents an active conversation with an authenticated user; contains user ID, session state, collected URLs, description, and completion status
- **Website URL**: Optional reference to user's existing website; includes URL string and validation status
- **Google Maps URL**: Optional reference to user's Google Maps business listing; includes URL string and validation status
- **Website Description**: User-provided text describing desired website characteristics, style preferences, and business context
- **Crawler Data Package**: Output structure containing all collected information ready for crawler processing; follows the production_master_map schema for crawler output integration

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can complete the full information collection flow in under 3 minutes
- **SC-002**: 90% of users successfully provide at least a description when completing the flow
- **SC-003**: 95% of provided URLs pass format validation on first attempt (indicates clear guidance)
- **SC-004**: Users who choose to modify information can do so without restarting the flow
- **SC-005**: Information collection sessions persist indefinitely and can be resumed anytime until user explicitly deletes them
- **SC-006**: All collected data is structured in a format ready for crawler integration without manual transformation

## Assumptions

- User authentication is required; sessions are tied to authenticated user accounts
- URL format validation is sufficient (actual URL existence verification is deferred to crawler)
- Google Maps URLs follow the standard `google.com/maps` or `goo.gl/maps` patterns
- Users understand what a "Google Maps business listing" means (no extensive explanation needed)
- The crawler integration will handle the actual data enrichment; this agent only collects inputs
- Session persistence mechanism exists or will be implemented separately
- The agent operates within the existing chat/conversation UI of the application
