DaveAI production runtime patch bundle - 2026-07-31

Purpose
-------
This bundle persists the production-only fixes made during the DaveAI.tech E2E repair audit so they are no longer trapped as manual VPS edits.

Contents
--------
- brain_llm.py
  Production backend brain file containing the native Ollama direct-chat/streaming repair used by the main chat path.

- nginx/
  Production Nginx files after the API/login rate-limit, health endpoint, brain vhost, voice health, API health, and StreamHub provider-vault fixes.

- windsurf.html
  Production Windsurf/Ops page after adding the unauthenticated auth gate that prevents protected admin API polling.

- td2/index-BEGIhVuy.js
  Production TD2 bundle after adding the asset cache-bust query string.

- td2/generated-assets-manifest.txt
  List of generated TD2 placeholder VFX PNG and silent MP3 assets that were added to stop missing-resource failures.

- apply-production-runtime-fixes.sh
  Idempotent deployment helper. It backs up current production files, installs the persisted files, recreates the TD2 generated assets, validates Nginx, and reloads Nginx.

Notes
-----
This bundle intentionally does not reboot the VPS, run apt upgrades, or restart unrelated processes. Those are maintenance-window operations.
