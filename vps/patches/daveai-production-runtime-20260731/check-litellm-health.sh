#!/usr/bin/env bash
set -euo pipefail

LITELLM_BASE="${LITELLM_BASE:-http://127.0.0.1:4000}"
MODEL="${LITELLM_HEALTH_MODEL:-fast-agent}"
ENV_FILE="${LITELLM_ENV_FILE:-/opt/litellm/.env}"

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

echo "Checking LiteLLM readiness at ${LITELLM_BASE}/health/readiness"
curl -fsS --max-time 10 "${LITELLM_BASE}/health/readiness" >/dev/null

echo "Checking LiteLLM liveliness at ${LITELLM_BASE}/health/liveliness"
curl -fsS --max-time 10 "${LITELLM_BASE}/health/liveliness" >/dev/null

echo "Checking LiteLLM model list at ${LITELLM_BASE}/v1/models"
curl -fsS --max-time 10 "${LITELLM_BASE}/v1/models" >/dev/null

echo "Checking LiteLLM completion path with model ${MODEL}"
AUTH_ARGS=()
if [ -n "${LITELLM_MASTER_KEY:-}" ]; then
  AUTH_ARGS=(-H "Authorization: Bearer ${LITELLM_MASTER_KEY}")
else
  echo "LITELLM_MASTER_KEY is not set; probing unauthenticated local completion path."
fi

curl -fsS --max-time 60 "${LITELLM_BASE}/v1/chat/completions" \
  "${AUTH_ARGS[@]}" \
  -H "Content-Type: application/json" \
  -d "{\"model\":\"${MODEL}\",\"messages\":[{\"role\":\"user\",\"content\":\"reply pong only\"}],\"max_tokens\":8,\"stream\":false}" \
  | python3 -c "import json,sys; data=json.load(sys.stdin); assert data.get('choices'), data; print(data['choices'][0]['message'].get('content','')[:80])"

echo "LiteLLM functional health passed."
