# DaveAI Deployment Source of Truth

The authoritative deployment inputs are:

- `daveai-ui-v6.html` for both the production root page and V6 page.
- `assets/daveai-v6.css` for the production workspace, responsive device
  layouts, and structural layout-preset styling.
- `patches/agent-runtime-completion-20260724-src/` for the Agent Brain runtime,
  Nginx route, and LiteLLM configuration.
- `daveai-sites-config.json` for the 22-site route inventory.
- `daveai-project-catalog.json` for the 55-entry project catalog.
- `services/daveai-subdomain-suite/` for DIY, Dev, Staging, Fleet, WebSocket,
  and Hermes3D.
- `services/gitea/`, `services/adminer/`, and `services/monitoring/` for the
  three containerized production services.

`daveai-ui-v6.html` must remain byte-for-byte identical to the copy in the
Agent Brain runtime bundle. Its stylesheet reference must match the canonical
asset under `assets/`. Run this before any deployment:

```powershell
python vps/verify-source-of-truth.py
node vps/verify-daveai-ui-contracts.cjs vps/daveai-ui-v6.html
node vps/verify-feature-completion-state-actions.cjs vps/daveai-ui-v6.html
```

The UI contract distinguishes static IDs from IDs explicitly assigned to
runtime-created nodes. It fails on unresolved references and on clickable
`div`/`span` controls that lack a role, keyboard focus, or a keyboard handler.
Dialog backdrops are exempt only when their click handler dismisses on the
backdrop itself; every dialog retains a keyboard-operable close control.

The verified route truth is:

- 14 `live` routes returning HTTP 200.
- 8 `auth` routes whose protected root returns the Authelia redirect.
- 0 `soon` routes.

Do not infer `live` from the existence of a hostname or a configured port.
Update the JSON source only after an HTTP route sweep and product-specific
proof.

The nine services completed on 2026-07-25 were accepted individually before
their labels changed. Their product evidence is recorded under task
`daveai-nine-services-completion-20260725`; the final per-service entry is
`ev_1b374693551fbcd1`.

The canvas Code/Preview switch is a workspace-surface control. It must not
overwrite the selected global DaveAI mode. Sites `live` and `auth` labels must
also remain visibly distinct, not only present in the DOM.

Production copies:

- `/var/www/agentic-website/index.html`
- `/var/www/agentic-website/daveai-ui-v6.html`
- `/var/www/agentic-website/assets/daveai-v6.css`
- `/var/www/agentic-website/daveai-project-catalog.json`
- `/opt/daveai/daveai-sites-config.json`
- `/opt/daveai-subdomain-suite/`
- `/opt/daveai/services/{gitea,adminer,monitoring}/`

Agent runtime files are installed under `/opt/agent-brain/`.
