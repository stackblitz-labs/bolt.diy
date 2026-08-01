# DaveAI.tech Production E2E Audit and Roadmap — 2026-07-31

This document records the production truth from the July 31, 2026 DaveAI.tech audit. It separates proven-working behavior from accepted/auth-gated behavior and unresolved platform debt.

Proof artifact root:

`G:\Github\Bolt.DIY\proofs\daveai-prod-audit-20260731`

## Current production status

| Area | Status | Proof / fact |
| --- | --- | --- |
| Main DaveAI chat unauthenticated state | Working as gated | No-token and malformed-token browser proofs show auth modal, no `/api/stream` call, and no protected API storm: `09-final-no-token-auth-gate.png`, `10-final-malformed-token-auth-gate.png`. |
| Main DaveAI authenticated chat | Working | Signed-in browser proof completed with AI reply, status `Ready`, no bad API responses, no page errors: `13-final-browser-auth-chat-no429.json`, `13-final-browser-auth-chat-no429.png`. |
| Main health endpoint | Working | `https://daveai.tech/api/health` returned HTTP 200 in `29-health-endpoints.json`. |
| Catalog HTTP inventory | Working at URL level | 55 catalog entries returned HTTP 200 after login-page rate-limit fix: `15-catalog-http-audit-after-login-guard.json`. |
| Game carousel card activation | Working | Carousel cards launch selected iframe targets for Siege TD, TD2, and Asteroids: `20-carousel-iframe-proof.json`, `20-carousel-iframe-0.png`, `20-carousel-iframe-1.png`, `20-carousel-iframe-2.png`. |
| DaveAI Asteroids gameplay smoke | Working | Start/gameplay proof changed score and had no bad responses or page errors: `22-gameplay-core-proof.json`, `22-gameplay-2.png`. |
| Dave's Siege TD smoke | Working to menu | Browser proof reaches saved-name menu / campaign controls with no bad responses or page errors: `22-gameplay-core-proof.json`, `22-gameplay-0.png`. |
| DaveAI TD2 | Working after repair | Missing VFX/audio assets were repaired, stale cached asset references were cache-busted, and the final browser proof had no 404/502 responses, no request failures, no page errors, no actionable console errors, and a canvas: `24-td2-cachebust-gameplay.json`, `24-td2-cachebust-gameplay.png`. |
| Checkers Crowning | Corrected at HTTP/title level | Catalog audit shows title/H1 `Checkers Crowning`; it no longer resolves to Wheel of Fortune in the HTTP audit. |
| DaveAI Studio | Working at page-smoke level | Correct catalog URL `https://daveai.tech/studio/index.html` renders with no bad responses or console/page errors: `26-catalog-non-game-pages-smoke.json`, `26-catalog-page-studio.png`. |
| DaveAI Web Pages | Working at page-smoke level | `https://daveai.tech/web-pages.html` renders cleanly: `26-catalog-non-game-pages-smoke.json`, `26-catalog-page-web-pages.png`. |
| DaveAI Voice / Voice Landing | Working at page-smoke level | `https://voice.daveai.tech/` and `https://daveai.tech/voice-landing.html` render cleanly: `26-catalog-non-game-pages-smoke.json`, `26-catalog-page-voice.png`, `26-catalog-page-voice-landing.png`. |
| StreamHub IPTV public page | Working after repair | Public StreamHub now renders with no bad responses, no request failures, no page errors, no console errors, and a video element: `28-streamhub-after-provider-empty.json`, `28-streamhub-after-provider-empty.png`. Final combined non-game proof: `34-final-non-game-pages-smoke.json`, `34-page-streamhub.png`. |
| Windsurf / Ops page | Working as auth-gated | Catalog marks it `auth`. Public browser proof now shows an explicit auth gate and makes no protected admin API calls: `33-windsurf-auth-gate.json`, `33-windsurf-auth-gate.png`. Final combined non-game proof: `34-final-non-game-pages-smoke.json`, `34-page-windsurf.png`. |
| Provider/IPTV private provider vault | Auth-gated | Public StreamHub now gets `{"providers":[]}` at `/api/provider-vault/providers`; protected provider catalog/stream APIs still require auth. |
| `brain.daveai.tech/health` | Working after repair | Added the missing `brain.daveai.tech` Nginx vhost with the Cloudflare Origin wildcard certificate; public health now returns HTTP 200: `32-health-endpoints-after-api-fix.json`. |
| `api.daveai.tech/health` | Working after repair | Added a narrow public `/health` response while leaving the rest of the API protected; public health now returns HTTP 200: `32-health-endpoints-after-api-fix.json`. |
| `voice.daveai.tech/health` | Working after repair | Added exact `/health` proxy to the Edge TTS backend; public health now returns HTTP 200: `32-health-endpoints-after-api-fix.json`. |
| LiteLLM router | Functional; bare `/health` probe is bad | `127.0.0.1:4000/health` and model-scoped `/health?model=...` hang, but `/health/readiness`, `/health/liveliness`, `/v1/models`, and real `/v1/chat/completions` probes for `fast-agent`, `local-fallback`, and `heavy-coder` return HTTP 200. Use `vps/patches/daveai-production-runtime-20260731/check-litellm-health.sh` for functional health until the bare LiteLLM `/health` route is fixed upstream/configured differently. Proof: `36-litellm-endpoints.txt`, `37-litellm-model-health.txt`, `38-litellm-chat-probe.txt`. |
| VPS system health | Needs maintenance | SSH banner reported high swap use, 32 zombie processes, pending updates, and restart required in `30-vps-process-health.txt`. |

## Repeatable E2E coverage added

Source-controlled runner:

`vps/production-e2e-runner.cjs`

NPM entry:

`npm run test:daveai:prod`

GitHub Actions workflow:

`.github/workflows/daveai-production-e2e.yml`

The runner covers:

- public health endpoints,
- unauthenticated chat auth gate,
- authenticated chat reply when `DAVEAI_E2E_EMAIL` and `DAVEAI_E2E_PASSWORD` are supplied,
- carousel card launch,
- TD2/Asteroids/Siege runtime smoke,
- Studio/Web Pages/Windsurf/Voice/Voice Landing/StreamHub smoke,
- StreamHub no-error render.

Latest public run without auth credentials: 6 passed, 0 failed, 1 skipped (`authenticated chat reply` skipped because no credentials were supplied). Proof root:

`G:\Github\Bolt.DIY\proofs\daveai-prod-e2e-runner-20260731-rerun`

## Repairs completed during this audit

1. Fixed frontend auth gating and stale `Thinking...` state for unauthenticated / malformed-token chat attempts.
2. Fixed signed-in chat browser behavior by:
   - using a direct native Ollama chat path in the backend,
   - streaming token chunks into the existing SSE queue,
   - preserving token spacing in the frontend SSE parser,
   - disabling automatic chat TTS narration by default to avoid post-reply 429s.
3. Raised API and login-page rate limits enough for real browser/catalog audits without weakening credential POST throttles.
4. Fixed production game/card activation by aligning local source with production card-as-button launcher behavior.
5. Repaired DaveAI TD2 missing assets:
   - 140 VFX PNG placeholders,
   - 10 silent MP3 placeholders,
   - cache-busted unversioned TD2 JS asset references to bypass stale CDN/origin cache.
6. Fixed StreamHub public-page provider-vault behavior by making unauthenticated `/api/provider-vault/providers` return `200 {"providers":[]}` instead of redirecting an XHR to the login domain.
7. Added public health coverage for `brain.daveai.tech`, `voice.daveai.tech`, and `api.daveai.tech`.
8. Added Windsurf/Ops auth gating so public users see a sign-in/launcher message and the page does not poll protected admin APIs until auth is present.

## Remaining work to finish DaveAI.tech E2E

### P0 — must finish before calling the whole platform complete

1. Make the production changes durable in source control.
   - Current VPS-only changes include backend `brain_llm.py`, Nginx configs, generated TD2 assets, TD2 built JS cache-bust, and the StreamHub Nginx provider-vault rule.
   - Local repo currently includes DaveAI UI source edits and this proof/doc set, but not all VPS-only runtime changes.
2. Add repeatable E2E tests to CI or a production smoke runner.
   - Chat unauthenticated gate.
   - Authenticated chat reply and `Ready` status.
   - Carousel card launches.
   - TD2/Asteroids/Siege canvas or menu state.
   - Catalog URL sweep.
   - StreamHub public no-error render.

### P1 — product quality / proof expansion

1. Add gameplay-specific assertions for all 17 public games. Current coverage is a mix of direct smoke and deeper checks for the main three carousel games.
2. Replace TD2 placeholder VFX/audio assets with real intended assets if brand polish matters.
3. Clean up Nginx `listen 443 ssl http2` protocol-option warnings across vhosts.
4. Track LiteLLM bare `/health` separately from functional health. The router and completion path work, but bare `/health` hangs and should not be used as the production liveness check.
5. Reduce VPS operational pressure: updates, reboot window, swap pressure, zombie processes.
   - Safe diagnostic script added: `vps/vps-maintenance-check.sh`.
   - Do not run apt upgrades or reboot outside an explicit maintenance window.

### P2 — catalog/status polish

1. Define catalog status meanings:
   - `live`: public route should render with no auth, no console/request failures.
   - `auth`: route may require login but should not throw noisy unauthenticated browser errors.
   - `historical`: retained route, not active product surface.
2. Add stale-route redirects for common wrong paths if users have already seen them:
   - `/studio.html` -> `/studio/index.html`
   - `/voice.html` -> `/voice-landing.html` or `https://voice.daveai.tech/`
   - `/streamhub.html` -> `https://iptv.daveai.tech/`
3. Keep screenshots and JSON proofs versioned or archived with each production revision.

## Next execution order

1. Persist VPS-only runtime fixes into the deploy/source-of-truth repository or an explicit deployment patch directory.
2. Add the repeatable E2E smoke runner to CI or a production-proof script.
3. Run the full proof pack again from the durable source deployment path.
4. Commit, push, and open/update the PR only after the durable source matches production behavior.
