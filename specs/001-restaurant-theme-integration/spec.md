# Feature Specification: Restaurant Theme Integration

**Feature Branch**: `001-restaurant-theme-integration`  
**Created**: 2025-12-02  
**Status**: Draft  
**Input**: User description: "Implement restaurant theme integration for website generator - includes theme registry, template selection enhancement, client state management, API integration, and system prompt layering"

## Clarifications

### Session 2025-12-02

- Q: Should users be able to override the automatic theme selection? → A: No override - system auto-selects, user influences selection via prompt wording

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Restaurant Website Generation with Theme-Specific Guidance (Priority: P1)

A user wants to create a restaurant website and expects the AI to generate contextually appropriate design and content based on the cuisine/style they describe. The system automatically detects restaurant-related requests, selects an appropriate theme template, and injects theme-specific design guidelines into the AI's generation process.

**Why this priority**: This is the core value proposition - enabling domain-specific, high-quality restaurant website generation that surpasses generic templates. Without this, the 12 existing theme prompts remain unused.

**Independent Test**: Can be fully tested by entering "create a Chinese restaurant website" and verifying that the generated site follows Asian casual dining aesthetics (dark backgrounds, red/gold accents, etc.) rather than generic styling.

**Acceptance Scenarios**:

1. **Given** a user enters "create a chinese restaurant website", **When** the template selection runs, **Then** the system selects "Bamboo Bistro" template and applies the corresponding theme guidelines
2. **Given** a user enters "build a luxury Vietnamese pho restaurant site", **When** the template selection runs, **Then** the system selects "Indochine Luxe" template with heritage/elegant styling guidelines
3. **Given** a user enters "make a steakhouse website", **When** the template selection runs, **Then** the system selects either "Noir Luxe" or "Bold Feast" based on context clues

---

### User Story 2 - Theme-Aware Template Selection (Priority: P1)

When a user describes a restaurant concept, the template selection system must intelligently match cuisine types, dining styles, and ambiance to the most appropriate restaurant theme from the 12 available options.

**Why this priority**: Without accurate template selection, the wrong theme would be applied, resulting in mismatched aesthetics (e.g., street food styling for a fine-dining concept).

**Independent Test**: Can be tested by submitting various restaurant descriptions and verifying the correct template is selected based on cuisine/style matching.

**Acceptance Scenarios**:

1. **Given** a user mentions "noodles", "ramen", or "asian street food", **When** template selection occurs, **Then** themes like "Bamboo Bistro", "The Red Noodle", or "Chromatic Street" are selected based on best match
2. **Given** a user mentions "fine dining", "tasting menu", or "upscale", **When** template selection occurs, **Then** themes like "Gastro Botanical", "Noir Luxe", or "Indochine Luxe" are selected
3. **Given** a user mentions "tacos" or "street food", **When** template selection occurs, **Then** "Chromatic Street" or "The Red Noodle" is selected

---

### User Story 3 - Graceful Fallback for Non-Restaurant Requests (Priority: P2)

When a user requests a non-restaurant website (e.g., "todo app", "portfolio site"), the system must continue working with generic templates without attempting to apply restaurant themes.

**Why this priority**: Ensures backward compatibility and doesn't break existing functionality for non-restaurant projects.

**Independent Test**: Can be tested by entering "create a todo app" and verifying that generic templates are selected and no restaurant theme injection occurs.

**Acceptance Scenarios**:

1. **Given** a user enters "build a todo app", **When** template selection runs, **Then** a generic template (e.g., Vite React) is selected with no restaurant theme applied
2. **Given** a user enters "create a portfolio website", **When** template selection runs, **Then** appropriate generic templates are offered without restaurant theme injection
3. **Given** a user enters a trivial request like "write a script to generate numbers", **When** template selection runs, **Then** the blank template is selected

---

### User Story 4 - Template Loading from GitHub (Priority: P2)

When a restaurant theme is selected, the system must successfully fetch the corresponding template files from the `neweb-learn` GitHub organization repositories.

**Why this priority**: The generated website needs the actual template files as a starting point. Without this, theme selection is meaningless.

**Independent Test**: Can be tested by selecting any restaurant template and verifying that files are successfully fetched from the corresponding GitHub repo.

**Acceptance Scenarios**:

1. **Given** "Bamboo Bistro" is selected, **When** template loading occurs, **Then** files are fetched from `neweb-learn/Bamboobistro` repository
2. **Given** GitHub rate limiting occurs, **When** template loading fails, **Then** user sees a warning toast and the system falls back to a blank template
3. **Given** a repository is unavailable (404), **When** template loading fails, **Then** user sees an appropriate error message and can continue with alternative options

---

### User Story 5 - Persistent Theme Context Across Conversation (Priority: P3)

Once a restaurant theme is selected, the theme guidelines must persist throughout the entire conversation, including when the AI continues generating after hitting token limits.

**Why this priority**: Without persistent context, the AI might lose the theme styling mid-generation, resulting in inconsistent output.

**Independent Test**: Can be tested by generating a long restaurant website that triggers continuation and verifying styling remains consistent.

**Acceptance Scenarios**:

1. **Given** a restaurant theme is active and the AI hits max token limit, **When** the conversation continues, **Then** the same theme guidelines are applied to the continuation
2. **Given** a user starts a new conversation, **When** they describe a restaurant, **Then** the theme selection process runs fresh without inheriting previous session state

---

### Edge Cases

- What happens when a user's request matches multiple cuisine types equally well (e.g., "Asian fusion restaurant")?
  - System selects the best match based on secondary context clues, defaulting to "Dynamic Fusion" for explicit fusion concepts
- How does the system handle GitHub template fetch failures?
  - Shows warning toast, clears restaurant theme, continues with blank template
- What happens if a theme prompt file is missing or corrupted?
  - System logs a warning and continues without theme injection, using base system prompt only
- How does the system handle ambiguous requests like "food website"?
  - Uses template selection intelligence to pick the most neutral restaurant theme or asks for clarification based on context

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST detect restaurant-related requests by analyzing keywords (restaurant, cafe, bistro, cuisine types, food concepts)
- **FR-002**: System MUST support 12 distinct restaurant themes mapped to specific cuisine/style combinations
- **FR-003**: System MUST automatically select the most appropriate restaurant template based on user's description (no manual override; users influence selection through prompt content)
- **FR-004**: System MUST fetch restaurant template files from designated GitHub repositories
- **FR-005**: System MUST inject theme-specific design guidelines into the AI's system prompt when a restaurant theme is selected
- **FR-006**: System MUST maintain restaurant theme context across conversation continuations (when max tokens trigger continuation)
- **FR-007**: System MUST gracefully fall back to generic templates when:
  - User requests non-restaurant content
  - GitHub template loading fails
  - Theme prompt file is unavailable
- **FR-008**: System MUST NOT inject restaurant themes when operating in "discuss" mode (only in "build" mode)
- **FR-009**: System MUST preserve all existing generic template functionality unchanged
- **FR-010**: System MUST display appropriate user feedback (toasts) when template loading fails

### Key Entities

- **Restaurant Theme**: Represents a design theme with unique ID, display label, description, applicable cuisines, style tags, and associated design guidelines
- **Template**: Extended to include optional restaurant category and theme association alongside existing framework template properties
- **Theme Registry**: Central mapping of all 12 restaurant themes with their metadata and raw prompt content
- **Theme Prompt**: Markdown content containing design tokens, component specifications, and content strategy for a specific theme

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users requesting restaurant websites receive theme-appropriate generated content on first generation attempt (measured by theme guidelines being applied)
- **SC-002**: Template selection correctly matches user intent to theme at least 90% of the time for clear restaurant descriptions (e.g., "chinese restaurant" → Asian theme)
- **SC-003**: Non-restaurant requests continue to work identically to before implementation (zero regression)
- **SC-004**: Theme context persists through 100% of conversation continuations without loss
- **SC-005**: Failed GitHub template fetches result in graceful degradation with user notification within 5 seconds
- **SC-006**: All 12 restaurant themes are fully integrated and selectable based on appropriate user prompts

## Scope & Boundaries

### In Scope

- Integration of 12 existing theme prompt markdown files into the generation flow
- Enhanced template selection logic for restaurant detection
- Addition of 12 restaurant templates to the existing template registry
- Client-side state management for tracking selected restaurant theme
- API layer updates to pass theme context to the generation engine
- System prompt layering to inject theme guidelines

### Out of Scope

- Creating new theme prompt content (existing 12 themes are used as-is)
- Manual theme override UI (users influence selection via prompt wording only)
- Theme customization UI (future consideration)
- Theme preview functionality (future consideration)
- Multi-theme support within a single site (future consideration)
- Theme analytics or A/B testing (future consideration)

## Assumptions

- All 12 theme prompt markdown files exist in `app/theme-prompts/` directory
- All 12 GitHub repositories exist and are publicly accessible under the `neweb-learn` organization
- Vite's `?raw` import syntax is available and working for loading markdown files as strings
- The existing template selection infrastructure can be extended without breaking changes
- Theme prompts are designed to complement (not conflict with) base system prompts

## Dependencies

- 12 theme prompt markdown files must be present and properly formatted
- 12 GitHub template repositories must be accessible from the `neweb-learn` organization
- Existing template selection, chat API, and stream-text infrastructure must be modifiable
