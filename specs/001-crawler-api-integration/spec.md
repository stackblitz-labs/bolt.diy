# Feature Specification: Crawler API Integration for Project Creation

**Feature Branch**: `001-crawler-api-integration`  
**Created**: 2026-01-04  
**Status**: Draft  
**Input**: User description: "Integrate create project flow with HuskIT/crawler API for business data extraction and AI content generation"

## Overview

Integrate the existing "Create Project" dialog flow with the HuskIT/crawler API (deployed at localhost:4999) to automatically extract business information from Google Maps URLs, crawl the business website, and generate AI-powered website content. This enriches project creation with real business data instead of relying solely on user-provided input.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Extract Business Data from Google Maps (Priority: P1)

A business owner creates a new project by providing their Google Maps URL. The system automatically extracts business information (name, address, hours, photos, reviews) and discovers the business website URL from Google Maps data.

**Why this priority**: This is the core value proposition - automating business data extraction eliminates manual data entry and ensures accuracy.

**Independent Test**: Can be tested by providing a Google Maps URL in the create project dialog and verifying business data is extracted and displayed before confirmation.

**Acceptance Scenarios**:

1. **Given** user is on the "Google Maps Link" step, **When** they paste a valid Google Maps URL and submit, **Then** the system calls the crawler API to extract business data and displays the extracted information for confirmation.
2. **Given** a valid Google Maps URL is submitted, **When** the crawler API returns business data including a website URL, **Then** the website URL is stored for subsequent crawling.
3. **Given** user submits a Google Maps URL, **When** the crawler API fails or times out, **Then** the user sees an error message and can retry or continue with manual entry.

---

### User Story 2 - Crawl Business Website for Additional Content (Priority: P2)

After extracting the website URL from Google Maps data, the system crawls the business website to gather additional content such as menu items, services, about page text, and imagery.

**Why this priority**: Website crawling enriches the project with detailed business content that goes beyond what Google Maps provides.

**Independent Test**: Can be tested by providing a Google Maps URL that includes a website link and verifying website content is extracted and stored.

**Acceptance Scenarios**:

1. **Given** the crawler has extracted a website URL from Google Maps data, **When** processing continues, **Then** the system crawls the website to extract page content.
2. **Given** the website crawl completes successfully, **When** content is extracted, **Then** the extracted data is associated with the project for AI content generation.
3. **Given** the website URL is unreachable or invalid, **When** the crawl fails, **Then** the system continues with available Google Maps data and logs the failure.

---

### User Story 3 - Generate AI-Powered Website Content (Priority: P1)

Using the extracted business data (from Google Maps and website crawl), the system generates AI-powered website content tailored to the business, including sections, copy, and layout suggestions.

**Why this priority**: AI content generation is the ultimate value delivery - transforming raw data into a ready-to-use website.

**Independent Test**: Can be tested by completing the data extraction steps and verifying the system generates website content and stores it in the project.

**Acceptance Scenarios**:

1. **Given** business data has been extracted, **When** user confirms project creation, **Then** the system calls the `/generate-website-content` endpoint with collected data.
2. **Given** AI content generation completes, **When** the response is received, **Then** the generated content is saved to the project information.
3. **Given** AI content generation fails, **When** an error occurs, **Then** the user sees an error message and can retry.

---

### User Story 4 - Fallback to Manual Entry (Priority: P3)

If the crawler API is unavailable or the user's Google Maps link doesn't yield results, the user can continue with manual project creation using only the information they provide.

**Why this priority**: Ensures the system degrades gracefully and users are never blocked from creating projects.

**Independent Test**: Can be tested by simulating crawler API failure and verifying manual project creation still works.

**Acceptance Scenarios**:

1. **Given** the crawler API is unavailable, **When** user submits a Google Maps URL, **Then** the system shows an appropriate message and allows proceeding with manual data.
2. **Given** crawler returns no business data, **When** user is on confirmation step, **Then** they can proceed with their manually entered business name and address.

---

### Edge Cases

- **No website URL**: When the Google Maps URL is for a business without a website, the system proceeds with Google Maps data only and skips website crawling.
- **Closed/moved business**: System displays whatever data the crawler returns; user can edit or correct before confirmation.
- **Partial data**: System proceeds with any available data from the crawler. No minimum fields required — AI generation uses whatever is available.
- **Rate limiting**: System displays an error message and allows retry or manual entry fallback.
- **Slow crawl**: Website crawls exceeding 60 seconds timeout; system continues with available Google Maps data.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST call the crawler API `/crawl` endpoint when a valid Google Maps URL is submitted during project creation.
- **FR-002**: System MUST generate a unique session ID once per project creation flow. This same session ID is reused for all crawler API calls (`/crawl`, `/generate-website-content`) during that project's creation, establishing a 1:1 relationship between project and session.
- **FR-003**: System MUST display extracted business data (name, address, phone, hours, website) for user confirmation before proceeding.
- **FR-004**: System MUST crawl the business website URL (if available) to extract additional content.
- **FR-005**: System MUST call the `/generate-website-content` endpoint with all collected business data to generate AI-powered content.
- **FR-006**: System MUST save the generated website content to the project's information/profile.
- **FR-007**: System MUST provide visual feedback (loading states, progress indicators) during API calls.
- **FR-008**: System MUST handle API errors gracefully with user-friendly error messages and retry options.
- **FR-008a**: When website crawl fails but Google Maps data succeeded, system MUST display a subtle indicator informing user that website data was unavailable, then continue with available data.
- **FR-009**: System MUST allow users to edit/correct extracted business data before final confirmation.
- **FR-010**: System MUST timeout crawler API calls after 60 seconds and allow the user to continue with available data or manual entry.

### API Integration Requirements

- **FR-011**: System MUST send POST requests to `http://localhost:4999/crawl` with JSON body containing `session_id` and `google_maps_url`.
- **FR-012**: System MUST parse the synchronous crawler API response to extract business data and website URL (no polling required).
- **FR-013**: System MUST call `/generate-website-content` endpoint with extracted data as the final step.
- **FR-014**: System MUST configure the crawler API base URL via environment variable for deployment flexibility.
- **FR-015**: System MUST NOT require authentication headers for crawler API calls (open internal API).

### Key Entities

- **CrawlSession**: Represents all crawl operations for a single project creation. One session_id per project (1:1 relationship). The session ID is generated at the start of project creation and used for all subsequent crawler API calls.
- **BusinessData**: Extracted business information including name, address, phone, hours, website URL, photos, and reviews summary.
- **WebsiteContent**: Crawled website content including page text, menu/services, and media.
- **GeneratedContent**: AI-generated website content including sections, copy, meta information, and layout suggestions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can complete project creation with automatic data extraction in under 60 seconds (excluding AI generation time).
- **SC-002**: 80% of valid Google Maps URLs successfully return business data on first attempt.
- **SC-003**: Users see extracted business data for confirmation before project creation completes.
- **SC-004**: System handles crawler API failures gracefully without blocking project creation.
- **SC-005**: Generated website content is saved to project and accessible for website building.
- **SC-006**: Error messages clearly indicate what went wrong and provide actionable next steps.

## Clarifications

### Session 2026-01-04

- Q: What is the timeout duration for crawler API calls? → A: 60 seconds (1 minute)
- Q: What is the minimum required data from crawler to proceed? → A: Any data sufficient; proceed with whatever is returned
- Q: Should crawler API calls require authentication? → A: No authentication; API is open/internal only
- Q: How does the /crawl API respond? → A: Synchronous; single request returns all data directly
- Q: How to handle website crawl failure? → A: Continue with subtle notice that website couldn't be crawled
- Q: Session ID relationship to project? → A: One project = one session_id; same ID used for all crawler calls during project creation

## Assumptions

1. The HuskIT/crawler API is deployed and accessible at a configurable URL (default: `localhost:4999`).
2. The crawler API endpoints follow the documented interface: `/crawl`, `/generate-website-content`.
3. The crawler API returns JSON responses with consistent structure.
4. The create project dialog flow can be extended to include additional steps for data confirmation.
5. Session IDs can be generated client-side using UUID or similar unique identifier generation.
6. The existing project creation infrastructure supports storing enriched business profile data.
7. The crawler API is open/internal and requires no authentication (trusted network environment).

## Out of Scope

- Deploying or managing the HuskIT/crawler service (assumed to be running)
- Modifying the crawler API itself
- Real-time updates or webhooks from the crawler
- Batch processing multiple Google Maps URLs
- User accounts or authentication with the crawler service
