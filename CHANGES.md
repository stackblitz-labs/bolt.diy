# Recent Changes

Highlights since the 1.0.0 release (May 2025), through the current 1.0.3 codebase. These entries summarize changes across that period and are not grouped by release.

## Building and editing

- Added an agent activity feed and approval tray, Agent and Discuss modes, and improvements to multi-step builds, tool-call recovery, and completion feedback.
- Added visual editing in the preview, along with controls to pause and resume the preview. Projects can also be imported from ZIP archives.
- Improved starter project setup and automatic startup, template handling, terminal reliability, and WebContainer development-server lifecycle.
- Added URL content fetching for chat context and improved model prompts, response parsing, and streaming recovery.

## Models and integrations

- Expanded and refreshed model support, including Cerebras, Fireworks AI, Moonshot AI, and updated xAI models. Local providers can be enabled from environment configuration.
- Added GitLab integration and GitHub deployment, improved repository cloning and template Git configuration, and reorganized service integrations into a unified connectors interface.
- Added MCP-backed project and web tools, prompt-level tool access controls, connector permissions, and a Browser Use Cloud connector.

## Experience and reliability

- Restored first-run onboarding and added appearance settings, color themes, profile avatars, an in-app documentation panel, and a redesigned settings interface.
- Improved startup and navigation performance, streaming rendering, chat persistence, and switching between chats. Fixed several workbench action and project restoration races.
- Improved request validation and error handling, including bounded provider requests and sanitized stream errors.

## Platform and development

- Updated the AI SDK and major application dependencies, and expanded unit, integration, performance, and Playwright end-to-end test coverage.
- Improved Docker configuration and startup, desktop packaging and release workflows, and deployment handling for services including Netlify.
