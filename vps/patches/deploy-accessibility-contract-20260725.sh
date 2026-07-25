#!/usr/bin/env bash
set -Eeuo pipefail

candidate_dir="${DAVEAI_CANDIDATE_DIR:-/tmp/daveai-accessibility-20260725}"
candidate_html="$candidate_dir/daveai-ui-v6.html"
candidate_css="$candidate_dir/daveai-v6.css"
expected_html="a9dc0ebfb1e6e87f62329e642892e674a573bdddd70f8a0d5fd3408b826e3cff"
expected_css="bca841c9633c7ef3420865fbdf41872ef4cd4130f71004842aa084b4f2246392"
expected_cache_key="20260725-accessibility-1"

test "$(sha256sum "$candidate_html" | awk '{print $1}')" = "$expected_html"
test "$(sha256sum "$candidate_css" | awk '{print $1}')" = "$expected_css"
grep -q "/assets/daveai-v6.css?v=$expected_cache_key" "$candidate_html"
grep -q 'id="fp-tool-count"' "$candidate_html"
grep -q 'function activateOnKeyboard(event)' "$candidate_html"

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup="/opt/daveai/backups/${stamp}-accessibility-contract"
mkdir -p "$backup"
cp -a /var/www/agentic-website/index.html "$backup/index.html"
cp -a /var/www/agentic-website/daveai-ui-v6.html "$backup/daveai-ui-v6.html"
cp -a /var/www/agentic-website/assets/daveai-v6.css "$backup/daveai-v6.css"

installed=0
rollback() {
  if [ "$installed" -eq 1 ]; then
    cp -a "$backup/index.html" /var/www/agentic-website/index.html
    cp -a "$backup/daveai-ui-v6.html" /var/www/agentic-website/daveai-ui-v6.html
    cp -a "$backup/daveai-v6.css" /var/www/agentic-website/assets/daveai-v6.css
  fi
}
trap rollback ERR

install -o root -g root -m 0644 "$candidate_html" /var/www/agentic-website/daveai-ui-v6.html
install -o www-data -g www-data -m 0644 "$candidate_html" /var/www/agentic-website/index.html
install -o www-data -g www-data -m 0644 "$candidate_css" /var/www/agentic-website/assets/daveai-v6.css
installed=1

test "$(sha256sum /var/www/agentic-website/index.html | awk '{print $1}')" = "$expected_html"
test "$(sha256sum /var/www/agentic-website/daveai-ui-v6.html | awk '{print $1}')" = "$expected_html"
test "$(sha256sum /var/www/agentic-website/assets/daveai-v6.css | awk '{print $1}')" = "$expected_css"
public_html="$(curl --fail --silent "https://daveai.tech/?release=$stamp")"
grep -q "/assets/daveai-v6.css?v=$expected_cache_key" <<<"$public_html"
grep -q 'id="fp-tool-count"' <<<"$public_html"
grep -q 'function activateOnKeyboard(event)' <<<"$public_html"
test "$(curl --fail --silent "https://daveai.tech/assets/daveai-v6.css?v=$expected_cache_key&release=$stamp" | sha256sum | awk '{print $1}')" = "$expected_css"
curl --fail --silent https://api.daveai.tech/health | grep -q '"tools":120'

trap - ERR
printf 'backup=%s\n' "$backup"
printf 'html_sha256=%s\n' "$expected_html"
printf 'css_sha256=%s\n' "$expected_css"
printf 'cache_key=%s\n' "$expected_cache_key"
printf 'homepage=ok stylesheet=ok brain=ok accessibility_contract=ok\n'
