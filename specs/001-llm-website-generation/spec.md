# Feature Specification: LLM Website Generation

**Feature Branch**: `001-llm-website-generation`  
**Created**: 2026-01-09  
**Status**: Draft  
**Input**: User description: "In 'Building your website' phase, send project business_profile + system prompt to LLM to generate website for user"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Automatic Website Generation (Priority: P1)

A business owner completes the project setup wizard (entering business details, providing Google Maps URL, reviewing crawled data). When they confirm their business information and reach the "Building your website" phase, the system automatically generates a complete website based on their business profile without requiring any additional input.

**Why this priority**: This is the core value proposition - users should get a working website immediately after providing their business information. This transforms a manual coding task into an automatic generation experience.

**Independent Test**: Can be fully tested by completing the create project wizard with valid business data and verifying that a functional website is generated and displayed in the preview panel within reasonable time.

**Acceptance Scenarios**:

1. **Given** a user has completed the project wizard with valid business_profile (including crawled data from Google Maps), **When** they confirm their business information, **Then** the system generates website code using the LLM and displays "Building your website" progress

2. **Given** the LLM generation is in progress, **When** the user views the "Building your website" step, **Then** they see real-time progress indicators showing generation status

3. **Given** the LLM successfully generates website code, **When** generation completes, **Then** the generated code is injected into the workbench and the preview shows the functional website

---

### User Story 2 - Template Selection Based on Business Type (Priority: P2)

The system analyzes the business_profile (category, cuisine type, style) and selects the most appropriate template/theme from the available restaurant themes before generating content. This ensures the generated website matches the business's brand and industry.

**Why this priority**: Automatic template selection eliminates decision fatigue for users and ensures professional results without manual theme browsing.

**Independent Test**: Can be tested by creating projects for different business types (e.g., fine dining vs street food) and verifying appropriate themes are selected.

**Acceptance Scenarios**:

1. **Given** a business profile with category "fine-dining" and French cuisine, **When** website generation starts, **Then** the system selects an elegant theme like "Noir Luxe v3" or "Classic Minimalist v2"

2. **Given** a business profile with category "street-food" and Asian cuisine, **When** website generation starts, **Then** the system selects a vibrant theme like "Chromatic Street" or "Bamboo Bistro"

---

### User Story 3 - Content Personalization (Priority: P3)

The generated website includes personalized content derived from the business_profile: business name, address, phone, hours, menu items, photos, reviews, and brand messaging. Users see their actual business information, not placeholder text.

**Why this priority**: Personalization makes the generated website immediately useful without requiring manual content editing.

**Independent Test**: Can be tested by verifying generated website contains actual business data from the profile (name, address, phone) rather than lorem ipsum or template placeholders.

**Acceptance Scenarios**:

1. **Given** a business profile with name "Bloom & Grow Studio" and address "123 Main St", **When** the website is generated, **Then** the website displays "Bloom & Grow Studio" and "123 Main St" in appropriate sections

2. **Given** a business profile with operating hours data, **When** the website is generated, **Then** the hours section displays the actual operating hours

---

### Edge Cases

- What happens when business_profile is incomplete or missing critical data?
  - System should generate website with available data and use sensible defaults for missing fields
  
- What happens when LLM generation fails or times out?
  - System should display error message with retry option and fallback to manual project creation

- What happens when the selected template cannot be loaded?
  - System should fallback to a default template and log the error

- What happens when Phase 1 (template selection) LLM call fails?
  - System should fallback to a default template (Classic Minimalist v2) and proceed with Phase 2 content generation

- What happens when user has no Google Maps URL (manual fallback mode)?
  - System should generate a basic website using only the manually entered business name and address

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST generate website code automatically when user confirms business information in the "Building your website" phase

- **FR-002**: System MUST compose a system prompt that includes:
  - Base Bolt system prompt with WebContainer constraints
  - Selected theme-specific design instructions (from restaurant themes)
  - Business profile data formatted for content injection
  
- **FR-003**: System MUST execute a two-phase LLM generation:
  - **Phase 1 (Template Selection)**: Send business_profile to a fast/cheaper LLM model to analyze and select the best-matching template from available themes
  - **Phase 2 (Content Generation)**: Send business_profile + selected template's design guidelines to user's configured LLM model to generate website code, streaming the response

- **FR-004**: System MUST display real-time progress indicators during generation showing:
  - "Analyzing business details" (completed)
  - "Generating layout & copy" (in progress)
  - "Final polish & SEO check" (pending)
  - "Taking longer than usual..." (shown after 60 seconds, no hard timeout - let LLM complete)

- **FR-005**: System MUST inject generated code artifacts into the workbench file system when generation completes

- **FR-005a**: System MUST automatically save generated code as the initial project snapshot immediately after successful generation (no user action required)

- **FR-006**: System MUST use LLM (Phase 1) to intelligently select the most appropriate template/theme from the 12 available restaurant themes based on business category, cuisine type, and brand style

- **FR-007**: System MUST handle generation errors gracefully with:
  - Clear error message to user
  - Retry option
  - Fallback to manual project creation if retry fails

- **FR-008**: System MUST support fallback mode where users with incomplete business_profile still receive a generated website with available data

### Key Entities

- **Business Profile**: Collection of business data including name, address, phone, hours, photos, reviews, menu items, rating, and category. Used as input for content personalization.

- **System Prompt**: Composed prompt sent to LLM containing WebContainer constraints, theme-specific design instructions, and business content injection instructions.

- **Theme/Template**: One of 12 restaurant themes with specific design guidelines, color palettes, and style tags. Selected based on business profile characteristics.

- **Generation Result**: Output of the LLM generation including template files, content files, and setup commands to create the website.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can go from business information entry to viewing a generated website preview in under 60 seconds (target; longer generations allowed with progress feedback)

- **SC-002**: Generated websites display correct business information (name, address, phone) with 100% accuracy when data is provided

- **SC-003**: 90% of generation attempts complete successfully on first try

- **SC-004**: Users require zero additional input after confirming business information to see their generated website

- **SC-005**: Generated websites are mobile-responsive and pass basic accessibility checks

## Clarifications

### Session 2026-01-09

- Q: What is the generation flow order - template selection vs content generation? → A: Two-phase LLM approach: First LLM call selects best template, second LLM call generates content with selected template guidelines
- Q: When/how is generated code persisted? → A: Auto-save on generation - system automatically saves as initial project snapshot immediately after successful generation
- Q: What is the generation timeout threshold? → A: No hard timeout; let LLM complete regardless of time, show "taking longer than usual" message after 60 seconds
- Q: Which LLM provider for each phase? → A: Fast/cheaper model for Phase 1 (template selection), user's configured model for Phase 2 (content generation)
- Q: What happens if Phase 1 (template selection) fails? → A: Fallback to default template (e.g., Classic Minimalist v2) and proceed to Phase 2

## Assumptions

- LLM provider is configured and accessible at generation time
- Business profile data follows the existing `BusinessProfile` type structure
- At least one restaurant theme template is available and loadable
- WebContainer can accept and execute the generated code artifacts
- Network connectivity is available for LLM API calls

## Out of Scope

- Custom theme creation or editing
- Non-restaurant business types (future expansion)
- Multi-page website generation (single-page MVP)
- SEO optimization beyond basic meta tags
- E-commerce or booking functionality integration
