# Feature Specification: Hybrid Context Selection

**Feature Branch**: `001-hybrid-context-selection`
**Created**: January 19, 2026
**Status**: Draft
**Input**: User description: "Implement Hybrid Core Bundle + Keyword Matching for context selection as described in docs/context-selection-improvement-plan.md"

## Clarifications

### Session 2026-01-19

- Q: What is the default maximum file selection limit? → A: 10-15 files (moderate, covers most edit scenarios)
- Q: What is the scope for "recently edited" file tracking? → A: Per-chat session (persists for duration of chat conversation)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Basic Website Editing with Accurate File Selection (Priority: P1)

A restaurant website operator asks the AI to make changes to their website. The system automatically selects the correct files based on the user's request, without requiring an additional LLM call.

**Why this priority**: This is the core functionality. Without accurate file selection, all edits fail or target wrong files, causing user frustration and wasted tokens.

**Independent Test**: Can be fully tested by sending an edit request (e.g., "change the header color") and verifying the correct files (Hero.tsx, index.css) are selected and passed to the main LLM.

**Acceptance Scenarios**:

1. **Given** a user with a restaurant website, **When** they request "change the header color to blue", **Then** the system selects Hero.tsx, Layout.tsx, and index.css without making an LLM call
2. **Given** a user's website with standard structure, **When** they request "update menu prices", **Then** the system selects Menu.tsx, MenuPreview.tsx, and data files
3. **Given** any edit request, **When** context selection runs, **Then** it completes in under 100ms (vs 2-5 seconds with LLM)

---

### User Story 2 - Iterative Editing with Recently Edited File Boost (Priority: P2)

During a session, a user makes multiple related edits. The system prioritizes files they recently edited, making follow-up changes more accurate.

**Why this priority**: Iterative editing is the primary use case after initial generation. Users often say "now change X a bit more" referring to files just edited.

**Independent Test**: Can be tested by making an edit, then a follow-up request, and verifying the previously edited file is prioritized even if keywords don't match perfectly.

**Acceptance Scenarios**:

1. **Given** a user just edited Hero.tsx, **When** they say "make it bolder", **Then** Hero.tsx is prioritized in file selection
2. **Given** multiple files edited in session, **When** selecting context, **Then** recently edited files receive +8 boost score
3. **Given** a vague request like "adjust the spacing", **When** context is selected, **Then** recently edited files appear before others

---

### User Story 3 - Specific Text Search via Grep Fallback (Priority: P3)

A user wants to change a specific value (price, color code, text string) and mentions it explicitly. The system finds the exact file containing that value.

**Why this priority**: While less common than section-based edits, precise value changes require grep to locate the exact file containing the text.

**Independent Test**: Can be tested by requesting "change $14 to $16" and verifying the system greps for "$14" and returns the file containing it.

**Acceptance Scenarios**:

1. **Given** user says "change '$14' to '$16'", **When** selecting context, **Then** system greps for "$14" and includes matching files
2. **Given** user mentions hex color "#21C6FF", **When** selecting context, **Then** system finds files containing that color
3. **Given** user quotes specific text, **When** grep fallback runs, **Then** matching files receive +5 boost score

---

### User Story 4 - Chat History Context Awareness (Priority: P3)

During conversation, the user mentions file names or components. The system remembers these mentions and boosts those files in subsequent selections.

**Why this priority**: Conversation context helps disambiguate vague requests. If user discussed "the Hero section" earlier, subsequent "change that" requests should prioritize Hero.tsx.

**Independent Test**: Can be tested by mentioning "Hero component" in chat, then asking "make it taller", and verifying Hero.tsx is selected.

**Acceptance Scenarios**:

1. **Given** user mentioned "Hero" in previous messages, **When** they request a change, **Then** Hero.tsx receives +3 boost
2. **Given** multiple components discussed in chat, **When** context is selected, **Then** mentioned files are prioritized
3. **Given** no specific file mentions in chat, **When** context is selected, **Then** only core bundle and keyword matches apply

---

### Edge Cases

- What happens when user's query contains no recognizable keywords? Core bundle files are still included.
- How does system handle a query matching many keywords (15+ files)? Top N files by score are selected (configurable limit).
- What happens when grep finds too many matches? Limit grep results and combine with keyword scores.
- How does system handle unconventional file naming (XYZ.tsx instead of Hero.tsx)? Grep fallback and chat mentions can still find it.
- What if the restaurant template has a different structure? Core patterns are configurable per template.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST select context files without making an LLM call
- **FR-002**: System MUST always include core bundle files (pages, layout, styles, data) for every request
- **FR-003**: System MUST map common keywords to relevant files (e.g., "header" → Hero.tsx, Layout.tsx)
- **FR-004**: System MUST boost recently edited files (within current chat session) by a configurable score (+8 default)
- **FR-005**: System MUST boost files matching user query keywords by +5
- **FR-006**: System MUST boost files mentioned in chat history by +3
- **FR-007**: System MUST support grep fallback for quoted strings, prices, and hex colors
- **FR-008**: System MUST complete file selection in under 100ms
- **FR-009**: System MUST limit selected files to 10-15 maximum by default (configurable) to prevent context overflow
- **FR-010**: System MUST sort selected files by total boost score in descending order
- **FR-011**: System MUST preserve the existing API interface for selectContext function

### Key Entities

- **Core Bundle**: Set of file patterns always included (pages/*, Layout.tsx, index.css, data/*)
- **Keyword Map**: Mapping of section keywords to file patterns (header → Hero, menu → Menu, MenuPreview)
- **Boost Scores**: Numeric weights for different selection signals (core: +10, recent: +8, keyword: +5, mentioned: +3, grep: +5)
- **Context Options**: Configuration object with recentlyEdited files and chat history

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: File selection accuracy improves from ~60% to >90% (correct files selected for user requests)
- **SC-002**: Context selection latency drops from 2-5 seconds to under 100ms
- **SC-003**: Token usage per message reduces by ~50% (from 60-120K to 30-60K)
- **SC-004**: LLM calls per message reduce from 3 to 2 (33% reduction)
- **SC-005**: User retry rate decreases (fewer repeated similar queries due to wrong file edits)
- **SC-006**: Monthly LLM costs reduce by 30-40%

## Assumptions

- Restaurant websites have predictable, small structure (20-30 files)
- File naming follows conventions (Hero.tsx, Menu.tsx, Footer.tsx)
- All pages, layout, styles, and data files should be available for most edits
- Recently edited files are tracked within the chat session (reset when starting a new chat)
- Chat history is available for mention detection
