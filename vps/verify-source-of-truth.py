#!/usr/bin/env python3
"""Fail fast when DaveAI deploy sources drift from verified production truth."""

from __future__ import annotations

import hashlib
import json
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parent
UI = ROOT / "daveai-ui-v6.html"
CSS = ROOT / "assets" / "daveai-v6.css"
RUNTIME_UI = (
    ROOT
    / "patches"
    / "agent-runtime-completion-20260724-src"
    / "daveai-ui-v6.html"
)
SITES = ROOT / "daveai-sites-config.json"
PROJECTS = ROOT / "daveai-project-catalog.json"

EXPECTED_SOON: set[str] = set()
EXPECTED_AUTH = {
    "diy.daveai.tech",
    "dev.daveai.tech",
    "staging.daveai.tech",
    "git.daveai.tech",
    "db.daveai.tech",
    "monitor.daveai.tech",
    "fleet.daveai.tech",
    "game.daveai.tech",
}
EXPECTED_NEW_HOST_STATUS = {
    "diy.daveai.tech": "auth",
    "dev.daveai.tech": "auth",
    "staging.daveai.tech": "auth",
    "git.daveai.tech": "auth",
    "db.daveai.tech": "auth",
    "monitor.daveai.tech": "auth",
    "fleet.daveai.tech": "auth",
    "ws.daveai.tech": "live",
    "hermes3d.daveai.tech": "live",
}
EXPECTED_PROJECT_STATUS = {
    "srv-daveai-dev": "auth",
    "srv-daveai-staging": "auth",
    "srv-daveai-diy": "auth",
    "srv-hermes": "auth",
    "srv-hermes3d": "live",
    "srv-fleet": "auth",
    "srv-auth": "live",
    "srv-bolt": "auth",
    "srv-hermestv": "live",
    "srv-tv": "live",
    "srv-games-portal": "auth",
    "srv-game-gangster-wars": "auth",
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(f"source-of-truth verification failed: {message}")


def main() -> None:
    for path in (UI, CSS, RUNTIME_UI, SITES, PROJECTS):
        require(path.is_file(), f"missing {path}")

    ui_hash = sha256(UI)
    css_hash = sha256(CSS)
    runtime_ui_hash = sha256(RUNTIME_UI)
    require(ui_hash == runtime_ui_hash, "top-level UI differs from runtime bundle")

    ui_text = UI.read_text(encoding="utf-8")
    css_text = CSS.read_text(encoding="utf-8")
    require(
        '/assets/daveai-v6.css?v=20260725-accessibility-1' in ui_text,
        "UI does not reference the canonical responsive workspace stylesheet",
    )
    for selector in (
        'body[data-device-mode="tablet"] #bframe',
        'body.workspace-rp-hidden #rp-tb',
        'body[data-device-mode="tablet"].workspace-chat-expanded #chat',
        'body:is([data-device-mode="android"], [data-device-mode="mobile"]).workspace-chat-compact #chat',
    ):
        require(selector in css_text, f"responsive stylesheet contract missing: {selector}")
    for stale in ("Tools (113)", "Search 113 tools", "113 catalog / 116 runtime"):
        require(stale not in ui_text, f"stale UI count remains: {stale}")
    require(
        "document.body.setAttribute('data-mode', 'code')" not in ui_text,
        "canvas Code tab must not overwrite the selected global mode",
    )
    require(
        "document.body.setAttribute('data-mode', selectedMode)" in ui_text,
        "Preview must restore the selected global mode after leaving Code",
    )
    require(
        'aria-disabled="true" title="Admin role required"' in ui_text,
        "locked Admin mode must expose disabled semantics",
    )
    require(
        '#fp-sites .site-badge[style*="#b2bec3"]' in ui_text
        and "color:#FCD34D!important" in ui_text,
        "soon status badges must remain readable",
    )
    require(
        '#fp-sites .site-badge[style*="#7C3AED"]' in ui_text
        and "color:#EDE9FE!important" in ui_text,
        "auth status badge must remain readable",
    )
    require(
        ">soon</span>" not in ui_text,
        "static Sites panel still contains a soon label",
    )
    for domain, expected_status in EXPECTED_NEW_HOST_STATUS.items():
        require(
            f"'{domain}': '{expected_status}'" in ui_text,
            f"project hostname truth missing {domain}={expected_status}",
        )

    sites_doc = json.loads(SITES.read_text(encoding="utf-8"))
    sites = sites_doc.get("sites") or []
    require(len(sites) == 22, f"expected 22 sites, found {len(sites)}")
    by_domain = {site["domain"]: site for site in sites}
    require(len(by_domain) == 22, "duplicate site domains")
    counts = Counter(site.get("status") for site in sites)
    require(counts == Counter({"live": 14, "auth": 8}), f"bad site counts: {dict(counts)}")
    require(
        {domain for domain, site in by_domain.items() if site["status"] == "soon"}
        == EXPECTED_SOON,
        "soon-domain set drifted",
    )
    require(
        {domain for domain, site in by_domain.items() if site["status"] == "auth"}
        == EXPECTED_AUTH,
        "auth-domain set drifted",
    )
    require(
        by_domain["api.daveai.tech"]["url"] == "https://api.daveai.tech/health",
        "API site must target its health route",
    )
    require(
        by_domain["monitor.daveai.tech"]["port"] == 3030,
        "monitor site must target the non-conflicting Grafana port",
    )

    project_doc = json.loads(PROJECTS.read_text(encoding="utf-8"))
    projects = project_doc.get("projects") or []
    require(len(projects) == 55, f"expected 55 catalog projects, found {len(projects)}")
    project_by_id = {project["id"]: project for project in projects}
    require(len(project_by_id) == 55, "duplicate project ids")
    for project_id, expected_status in EXPECTED_PROJECT_STATUS.items():
        actual = project_by_id.get(project_id, {}).get("status")
        require(
            actual == expected_status,
            f"{project_id} expected {expected_status}, found {actual}",
        )

    print(
        json.dumps(
            {
                "status": "pass",
                "ui_sha256": ui_hash,
                "css_sha256": css_hash,
                "sites": dict(sorted(counts.items())),
                "projects": len(projects),
                "critical_project_statuses": EXPECTED_PROJECT_STATUS,
            },
            indent=2,
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
