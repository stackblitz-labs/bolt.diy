#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_DIR="/opt/daveai/backups/${STAMP}-source-controlled-runtime-restore"

AGENT_BRAIN_DIR="/opt/agent-brain"
SITE_ROOT="/var/www/agentic-website"
TD2_ROOT="${SITE_ROOT}/games/daveai-td2"

mkdir -p "${BACKUP_DIR}/nginx" "${BACKUP_DIR}/td2"

backup_if_exists() {
  local src="$1"
  local dest="$2"
  if [ -e "$src" ]; then
    mkdir -p "$(dirname "$dest")"
    cp -a "$src" "$dest"
  fi
}

install_file() {
  local src="$1"
  local dest="$2"
  local mode="${3:-0644}"
  mkdir -p "$(dirname "$dest")"
  cp -a "$src" "$dest"
  chmod "$mode" "$dest"
}

echo "Backing up current production files to ${BACKUP_DIR}"
backup_if_exists "${AGENT_BRAIN_DIR}/brain_llm.py" "${BACKUP_DIR}/brain_llm.py"
backup_if_exists "${SITE_ROOT}/windsurf.html" "${BACKUP_DIR}/windsurf.html"
backup_if_exists "${TD2_ROOT}/assets/index-BEGIhVuy.js" "${BACKUP_DIR}/td2/index-BEGIhVuy.js"

for name in daveai.tech iptv.daveai.tech voice.daveai.tech brain.daveai.tech stories.daveai.tech; do
  backup_if_exists "/etc/nginx/sites-enabled/${name}" "${BACKUP_DIR}/nginx/${name}"
done
backup_if_exists "/etc/nginx/conf.d/00-kilo-bot-protection.conf" "${BACKUP_DIR}/nginx/00-kilo-bot-protection.conf"

echo "Installing backend brain and production HTML"
install_file "${SCRIPT_DIR}/brain_llm.py" "${AGENT_BRAIN_DIR}/brain_llm.py"
install_file "${SCRIPT_DIR}/windsurf.html" "${SITE_ROOT}/windsurf.html"
install_file "${SCRIPT_DIR}/td2/index-BEGIhVuy.js" "${TD2_ROOT}/assets/index-BEGIhVuy.js"

echo "Installing Nginx configuration"
for name in daveai.tech iptv.daveai.tech voice.daveai.tech brain.daveai.tech stories.daveai.tech; do
  install_file "${SCRIPT_DIR}/nginx/${name}" "/etc/nginx/sites-enabled/${name}"
done
install_file "${SCRIPT_DIR}/nginx/00-kilo-bot-protection.conf" "/etc/nginx/conf.d/00-kilo-bot-protection.conf"

echo "Recreating TD2 generated assets from manifest"
python3 - <<'PY' "${SCRIPT_DIR}/td2/generated-assets-manifest.txt" "${TD2_ROOT}"
from pathlib import Path
import base64
import sys

manifest = Path(sys.argv[1])
td2_root = Path(sys.argv[2])

png_payload = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFElEQVR42mP4TyJgGNUwqmH4agAAr639H23ooMoAAAAASUVORK5CYII="
)
mp3_payload = base64.b64decode(
    "SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjYwLjE2LjEwMAAAAAAAAAAAAAAA//tAwAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAFAAACvgBoaGhoaGhoaGhoaGhoaGhoaGhojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo60tLS0tLS0tLS0tLS0tLS0tLS0tNra2tra2tra2tra2tra2tra2tra//////////////////////////8AAAAATGF2YzYwLjMxAAAAAAAAAAAAAAAAJAMGAAAAAAAAAr4QurGFAAAAAAD/+xDEAAPAAAGkAAAAIAAANIAAAARMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/7EMQpg8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//sQxFMDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/+xDEfIPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/7EMSmA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
)

written = {"png": 0, "mp3": 0}
for raw in manifest.read_text(encoding="utf-8-sig").splitlines():
    rel = raw.strip()
    if not rel:
        continue
    target = td2_root / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    if rel.endswith(".png"):
        target.write_bytes(png_payload)
        written["png"] += 1
    elif rel.endswith(".mp3"):
        target.write_bytes(mp3_payload)
        written["mp3"] += 1
    else:
        raise SystemExit(f"Unsupported generated TD2 asset: {rel}")

print(written)
PY

echo "Validating Python and Nginx syntax"
python3 -m py_compile "${AGENT_BRAIN_DIR}/brain_llm.py"
nginx -t

echo "Reloading Nginx and restarting agent-brain"
systemctl reload nginx
if command -v pm2 >/dev/null 2>&1; then
  pm2 restart agent-brain --update-env
fi

echo "Done. Backup: ${BACKUP_DIR}"
