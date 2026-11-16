# End-to-end tests

`pnpm run test:e2e:ci` runs the Chromium browser tests in the Playwright `ci` project, which can run without provider credentials. The shared fixture sets a completed onboarding state, supplies a test-only OpenRouter cookie and model catalog, and stubs chat or prompt-enhancement responses where those requests are under test.

The `Tool Calls & Workbench` and `Multi-turn Conversations` suites exercise model behavior through the live provider path. Run them separately with a configured provider key; they are excluded from CI to keep pull request checks deterministic and credential-free. The additional `tests/e2e/hello-website.spec.ts` remains an existing live acceptance test in the `existing-e2e` Playwright project and is not included in the CI browser job.

The browser suite checks app startup and key UI controls, prompt entry, the streamed chat request/reply path, code block rendering, attachment menu options, and prompt enhancement. The `07-build-smoke.e2e.ts` case also exercises the generated-workbench lifecycle with a mocked landing page and skips onboarding through `?smokeTest=true`.

The build smoke case uses the `replay-test` provider, `model-test` model, and `smokeTest` test key. Playwright stubs the chat stream, so the test does not contact an LLM provider. Run just this case with `pnpm run test:e2e:ci -- e2e-tests/07-build-smoke.e2e.ts`.
