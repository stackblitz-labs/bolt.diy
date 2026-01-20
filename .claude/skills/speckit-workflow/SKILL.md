---
name: speckit-workflow
description: Use when working with feature specifications, implementation planning, or task management. Covers the speckit workflow commands (specify, plan, tasks, implement, clarify, analyze), spec templates, plan templates, constitution checks, and feature branch creation. Triggers include "speckit", "spec", "specification", "feature spec", "/speckit.specify", "/speckit.plan", "/speckit.tasks", "/speckit.implement", "plan.md", "tasks.md", "constitution", "feature branch", ".specify".
---

# Speckit Workflow Skill

## Goal

Use the speckit workflow to create feature specifications, implementation plans, and task breakdowns following the established governance patterns.

## Workflow Commands

| Command | Purpose | Output |
|---------|---------|--------|
| `/speckit.specify` | Create feature specification | `specs/{N}-{name}/spec.md` |
| `/speckit.plan` | Generate implementation plan | `specs/{N}-{name}/plan.md` |
| `/speckit.tasks` | Break plan into tasks | `specs/{N}-{name}/tasks.md` |
| `/speckit.implement` | Execute implementation | Code changes |
| `/speckit.clarify` | Clarify spec requirements | Updated spec.md |
| `/speckit.analyze` | Analyze existing code | Analysis report |
| `/speckit.checklist` | Create validation checklist | Checklist file |
| `/speckit.constitution` | Review constitution rules | Constitution summary |

## Directory Structure

```
specs/
└── {N}-{feature-name}/
    ├── spec.md              # Feature specification
    ├── plan.md              # Implementation plan
    ├── tasks.md             # Task breakdown
    ├── research.md          # Research findings
    ├── data-model.md        # Entity definitions
    ├── contracts/           # API contracts (OpenAPI/GraphQL)
    │   └── *.yaml
    └── checklists/          # Validation checklists
        └── requirements.md

.specify/
├── templates/
│   ├── spec-template.md     # Spec template
│   └── plan-template.md     # Plan template
├── scripts/
│   └── bash/
│       ├── create-new-feature.sh
│       ├── setup-plan.sh
│       └── update-agent-context.sh
└── memory/
    └── constitution.md      # Quality gates and standards
```

## Specification Workflow

### Step 1: Create Specification

```bash
# Run speckit.specify with feature description
# Example: "Add user authentication with JWT"
```

The workflow:
1. **Generate short name** (2-4 words): "user-auth"
2. **Check existing branches**: Find highest N across remotes, locals, specs dirs
3. **Create feature branch**: `git checkout -b {N+1}-{short-name}`
4. **Initialize spec file**: Run `create-new-feature.sh`
5. **Fill spec template**: User stories, requirements, success criteria
6. **Validate spec**: Check against quality criteria
7. **Handle clarifications**: Max 3 [NEEDS CLARIFICATION] markers

### Spec Template Structure

```markdown
# Feature: {Feature Name}

## Overview
Brief description of the feature and its value.

## User Stories
- As a {role}, I want to {action} so that {benefit}

## Functional Requirements
### FR-1: {Requirement Name}
- Description: ...
- Acceptance Criteria: ...

## Non-Functional Requirements
- Performance: ...
- Security: ...
- Accessibility: ...

## Success Criteria
- Measurable outcome 1
- Measurable outcome 2

## Assumptions
- Assumption 1
- Assumption 2

## Dependencies
- Dependency 1
- Dependency 2
```

### Spec Quality Guidelines

**DO**:
- Focus on **WHAT** users need and **WHY**
- Write for business stakeholders
- Make requirements testable and unambiguous
- Use measurable success criteria

**DON'T**:
- Include implementation details (languages, frameworks, APIs)
- Use technical jargon
- Leave more than 3 [NEEDS CLARIFICATION] markers
- Embed checklists in the spec

## Planning Workflow

### Step 2: Create Implementation Plan

```bash
# Run after spec is complete
# Reads spec.md and creates plan.md
```

The workflow:
1. **Setup**: Run `setup-plan.sh --json` to get paths
2. **Load context**: Read spec.md and constitution.md
3. **Phase 0**: Research - resolve unknowns, create research.md
4. **Phase 1**: Design - data-model.md, contracts/, quickstart.md
5. **Update agent context**: Run `update-agent-context.sh claude`
6. **Constitution check**: Validate against quality gates

### Plan Template Sections

```markdown
# Implementation Plan: {Feature Name}

## Technical Context
- Stack: ...
- Dependencies: ...
- Unknowns: [NEEDS CLARIFICATION] markers

## Constitution Check
### Quality Gates
- [ ] Lint passes
- [ ] Types check
- [ ] Tests pass
- [ ] Coverage meets threshold

## Phase 0: Research
### Research Tasks
1. Research {unknown} for {context}

### Findings
| Decision | Rationale | Alternatives |
|----------|-----------|--------------|

## Phase 1: Design
### Data Model
Reference: data-model.md

### API Contracts
Reference: contracts/*.yaml

### Architecture
Diagram or description

## Phase 2: Implementation
### Task Breakdown
Reference: tasks.md
```

## Task Breakdown

### Step 3: Create Tasks

```bash
# Run after plan is complete
# Breaks plan into actionable tasks
```

Task format:
```markdown
# Tasks: {Feature Name}

## Task 1: {Task Name}
- **Estimate**: Xh
- **Dependencies**: None | Task N
- **Files**: 
  - `path/to/file.ts`
- **Acceptance Criteria**:
  - [ ] Criterion 1
  - [ ] Criterion 2

## Task 2: {Task Name}
...
```

## Constitution Gates

From `.specify/memory/constitution.md`:

### Quality Gates (Must Pass)
- `pnpm run lint` - ESLint + Prettier
- `pnpm run typecheck` - TypeScript strict mode
- `pnpm run test` - Vitest suite

### Coverage Requirements
- ≥90% for critical runtimes (message-parser, action-runner)
- ≥80% for touched files

### UX Standards
- Design tokens from `app/styles/tokens.css`
- shadcn/ui components with toasts
- ARIA live regions for accessibility
- Responsive breakpoints: 320/768/1280px

### Performance Budgets
- Instrumented with `performance.mark`
- API acknowledgements <400ms
- SSE heartbeats every 5s

## Helper Scripts

### create-new-feature.sh

```bash
.specify/scripts/bash/create-new-feature.sh --json "$ARGUMENTS" \
  --number 5 \
  --short-name "user-auth" \
  "Add user authentication"
```

Output (JSON):
```json
{
  "BRANCH_NAME": "5-user-auth",
  "SPEC_FILE": "specs/5-user-auth/spec.md"
}
```

### setup-plan.sh

```bash
.specify/scripts/bash/setup-plan.sh --json
```

Output (JSON):
```json
{
  "FEATURE_SPEC": "specs/5-user-auth/spec.md",
  "IMPL_PLAN": "specs/5-user-auth/plan.md",
  "SPECS_DIR": "specs/5-user-auth",
  "BRANCH": "5-user-auth"
}
```

### update-agent-context.sh

```bash
.specify/scripts/bash/update-agent-context.sh claude
```

Updates `.claude/` context files with new technology from the plan.

## Clarification Format

When specs need clarification:

```markdown
## Question 1: [Topic]

**Context**: [Quote relevant spec section]

**What we need to know**: [Specific question]

**Suggested Answers**:

| Option | Answer | Implications |
|--------|--------|--------------|
| A      | First answer | What this means |
| B      | Second answer | What this means |
| C      | Third answer | What this means |
| Custom | Your answer | Provide details |

**Your choice**: _[Wait for response]_
```

## Handoffs Between Commands

```
/speckit.specify → /speckit.clarify → /speckit.plan
                         ↑                 ↓
                         └─────────────────┘
                                           ↓
                                 /speckit.tasks
                                           ↓
                                /speckit.implement
```

## Command Files Location

All speckit commands are defined in `.claude/commands/`:

| File | Command |
|------|---------|
| `speckit.specify.md` | Create specification |
| `speckit.plan.md` | Generate plan |
| `speckit.tasks.md` | Break into tasks |
| `speckit.implement.md` | Execute implementation |
| `speckit.clarify.md` | Clarify requirements |
| `speckit.analyze.md` | Analyze codebase |
| `speckit.checklist.md` | Create checklist |
| `speckit.constitution.md` | Review constitution |
| `speckit.taskstoissues.md` | Convert tasks to issues |

## Checklist

- [ ] Start with `/speckit.specify` for new features
- [ ] Generate short name (2-4 words, kebab-case)
- [ ] Check all sources for highest feature number
- [ ] Limit [NEEDS CLARIFICATION] to max 3 markers
- [ ] Focus spec on WHAT/WHY, not HOW
- [ ] Make requirements testable
- [ ] Run constitution check during planning
- [ ] Create data-model.md for entities
- [ ] Create contracts/ for APIs
- [ ] Update agent context after planning
- [ ] Break plan into estimable tasks

## References

- `.claude/commands/speckit.specify.md` - Specify command
- `.claude/commands/speckit.plan.md` - Plan command
- `.specify/templates/` - Templates
- `.specify/memory/constitution.md` - Quality gates
- `.specify/scripts/bash/` - Helper scripts
