#!/usr/bin/env bash
set -euo pipefail

echo "=== time ==="
date -u

echo
echo "=== uptime/load ==="
uptime

echo
echo "=== memory/swap ==="
free -h

echo
echo "=== disk ==="
df -h /

echo
echo "=== zombie processes ==="
ps -eo stat,ppid,pid,comm,args | awk '$1 ~ /Z/ {print}'

echo
echo "=== reboot required ==="
if [ -f /var/run/reboot-required ]; then
  cat /var/run/reboot-required
  [ -f /var/run/reboot-required.pkgs ] && cat /var/run/reboot-required.pkgs
else
  echo "No reboot-required marker found."
fi

echo
echo "=== pending apt updates count ==="
apt list --upgradable 2>/dev/null | sed '1d' | wc -l

echo
echo "=== unattended-upgrades recent failures ==="
grep -RIn "ERROR\\|WARNING\\|could not" /var/log/unattended-upgrades 2>/dev/null | tail -40 || true

echo
echo "=== PM2 status ==="
pm2 status --no-color || true

echo
echo "=== Docker status ==="
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' || true

cat <<'EOF'

Maintenance-window actions not performed by this diagnostic script:
1. Snapshot/backup VPS.
2. Announce maintenance window.
3. Run apt update && apt upgrade.
4. Reboot if /var/run/reboot-required exists.
5. After reboot, verify:
   - nginx -t
   - systemctl is-active nginx litellm
   - pm2 status
   - vps/patches/daveai-production-runtime-20260731/check-litellm-health.sh
   - node vps/production-e2e-runner.cjs
EOF
