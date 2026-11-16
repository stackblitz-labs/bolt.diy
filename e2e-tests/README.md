# End-to-end tests

`pnpm run test:e2e:ci` runs the Chromium browser tests in the Playwright `ci` project, which can run without provider credentials. The shared fixture sets a completed onboarding state, supplies a test-only OpenRouter cookie and model catalog, and stubs chat or prompt-enhancement responses where those requests are under test.

The `Tool Calls & Workbench` and `Multi-turn Conversations` suites exercise model behavior through the live provider path. Run them separately with a configured provider key; they are excluded from CI to keep pull request checks deterministic and credential-free. The additional `tests/e2e/hello-website.spec.ts` remains an existing live acceptance test in the `existing-e2e` Playwright project and is not included in the CI browser job.

The browser suite checks app startup and key UI controls, prompt entry, the streamed chat request/reply path, code block rendering, attachment menu options, and prompt enhancement. It does not yet verify the full agent tool-calling and generated-workbench lifecycle in a mocked environment.
