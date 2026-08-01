"""brain_llm.py — LLM abstraction: 4-stage fallback, streaming, JSON mode, caching.

Stage chain (no cloud-provider dependency — local-first):
  1. LiteLLM streaming  (model → heavy-coder / fast-agent / vision via /opt/litellm/config.yaml)
  2. LiteLLM non-stream (same model, no stream)
  3. LiteLLM fast-agent (if HEAVY failed, retry with FAST)
  4. Direct LM Studio   (bypass LiteLLM proxy entirely — final safety net)

No Anthropic SDK dependency. Removed 2026-05-25 per Dave's directive: "anthropic isn't
one of the api keys in the list to be usable". If a cloud provider key (Anthropic/MiniMax/
SiliconFlow/OpenRouter) is rotated and re-enabled later, the LiteLLM config can route
brain aliases through it transparently — no code change required here.
"""
import os, json, re, time, hashlib, threading, urllib.request, urllib.error, sys
from brain_core import LLM_BASE, HEAVY, FAST, VISION
from brain_events import agent_set, emit


# ── ReAct control-token stream filter ─────────────────────────────────────────
# Defense-in-depth (Wave 2 ReAct leak fix, 2026-05-25):
# Even if a build-keyword prompt slips past is_website_change() narrowing,
# the agent's ReAct scaffolding (THOUGHT: / ACTION: / OBSERVATION: / FINAL:)
# MUST NOT reach the user-visible chat bubble. This filter buffers stream
# tokens line-by-line and:
#   - drops complete lines that start with THOUGHT:/ACTION:/OBSERVATION:
#   - for FINAL: lines, emits only the body after the marker
#   - passes through everything else unchanged
#
# Used by chat / reply / narrator labels where the assistant text is shown to
# the user. ReAct internal labels ("coder", "asset") should not stream at all
# (brain_graph.py _react now passes stream_label="" for the LLM call), but this
# filter is a belt-and-braces guarantee.

_REACT_DROP_PREFIXES = ("THOUGHT:", "ACTION:", "OBSERVATION:")
_REACT_FINAL_RE      = re.compile(r"\bFINAL\s*:\s*", re.IGNORECASE)


class _ReActStreamFilter:
    """Strip ReAct control tokens from streaming text, line by line.

    Tokens arrive in arbitrary chunks, so we buffer until a newline and then
    classify the line. Partial trailing text (no newline yet) is held until
    either we see more tokens or `flush()` is called. The filter is permissive
    on the wire: only well-formed control-token lines are dropped — normal
    chat text passes through with no change.
    """

    __slots__ = ("_buf", "_after_final", "_seen_any_final")

    def __init__(self):
        self._buf: str = ""
        self._after_final: bool = False
        self._seen_any_final: bool = False

    def feed(self, token: str) -> str:
        """Return the portion of `token` that should be emitted downstream."""
        if not token:
            return ""
        self._buf += token
        out_parts: list[str] = []
        # Emit any complete lines, leave a tail in the buffer for next chunk.
        while True:
            nl = self._buf.find("\n")
            if nl < 0:
                # No complete line yet. If we are past a FINAL: marker and
                # the partial buffer doesn't look like a fresh directive, we
                # can still emit it incrementally so the UI streams cleanly.
                if self._after_final and self._buf and not self._buf.lstrip().startswith(
                        _REACT_DROP_PREFIXES + ("FINAL:",)):
                    out_parts.append(self._buf)
                    self._buf = ""
                break
            line = self._buf[: nl + 1]            # include trailing \n
            self._buf = self._buf[nl + 1:]
            stripped = line.lstrip()
            if stripped.startswith(_REACT_DROP_PREFIXES):
                # Drop the whole line, including its trailing newline.
                self._after_final = False
                continue
            m = _REACT_FINAL_RE.match(stripped) if stripped else None
            if m:
                body = stripped[m.end():]         # text after "FINAL:"
                out_parts.append(body)
                self._after_final = True
                self._seen_any_final = True
                continue
            # Normal line — emit as-is.
            out_parts.append(line)
        return "".join(out_parts)

    def flush(self) -> str:
        """Return any remaining buffered text (called at stream end)."""
        if not self._buf:
            return ""
        stripped = self._buf.lstrip()
        if stripped.startswith(_REACT_DROP_PREFIXES):
            self._buf = ""
            return ""
        m = _REACT_FINAL_RE.match(stripped) if stripped else None
        if m:
            body = stripped[m.end():]
            self._buf = ""
            self._seen_any_final = True
            return body
        out = self._buf
        self._buf = ""
        return out

try:
    from litellm import completion as _litellm_completion
    _LITELLM_OK = True
except ImportError:
    _LITELLM_OK = False

# ── Local-direct fallback config (overridable via /opt/agent-brain/.env) ──────
# Used as Stage 4: bypasses LiteLLM proxy and calls LM Studio directly via HTTP.
# Default points at the Tailnet LM Studio endpoint that the brain aliases already use.
LOCAL_DIRECT_URL = os.getenv(
    "LOCAL_LLM_DIRECT_URL",
    "http://127.0.0.1:11434/v1/chat/completions",
)
LOCAL_DIRECT_MODEL = os.getenv(
    "LOCAL_LLM_DIRECT_MODEL",
    "qwen2.5-coder:3b",
)
LOCAL_OLLAMA_CHAT_URL = os.getenv(
    "LOCAL_OLLAMA_CHAT_URL",
    "http://127.0.0.1:11434/api/chat",
)
LOCAL_CHAT_MAX_TOKENS = int(os.getenv("LOCAL_CHAT_MAX_TOKENS", "512"))

# User-facing message shown when EVERY LLM path failed. Friendly, voice-safe (no
# stack traces, no tokens, no URLs).
_NO_LLM_USER_MSG = (
    "I'm having trouble reaching my language model right now. "
    "Please try again in a moment."
)

# ── Simple response cache (LRU-ish, 128 slots) ─────────────────────────────────
_cache: dict = {}
_cache_lock = threading.Lock()
_CACHE_MAX = 128
_CACHE_TTL = 300  # seconds


def _cache_key(model: str, prompt: str, system: str) -> str:
    # NOTE: hash FULL system prompt — quick_reply/invoke splice session
    # history into system prompt after byte 80; truncating caused cross-session
    # cache collisions (Wave 1g finding 2026-05-25). Prompt truncation kept
    # since user msgs are bounded by chat UI.
    sys_hash = hashlib.md5(system.encode(errors='replace')).hexdigest()[:16]
    raw = f"{model}|{sys_hash}|{prompt[:200]}"
    return hashlib.md5(raw.encode()).hexdigest()


def _cache_get(key: str) -> str | None:
    with _cache_lock:
        entry = _cache.get(key)
        if entry and (time.monotonic() - entry["ts"]) < _CACHE_TTL:
            return entry["value"]
    return None


def _cache_put(key: str, value: str):
    with _cache_lock:
        if len(_cache) >= _CACHE_MAX:
            oldest = min(_cache, key=lambda k: _cache[k]["ts"])
            del _cache[oldest]
        _cache[key] = {"value": value, "ts": time.monotonic()}


# ── Core litellm call (single attempt) ────────────────────────────────────────
def _litellm_call(model: str, msgs: list, stream: bool = False,
                  timeout: int = 300, q=None, stream_label: str = "") -> str:
    if not _LITELLM_OK:
        return ""
    if stream:
        collected = []
        reasoning_collected = []
        # ReAct sanitizer — strips THOUGHT:/ACTION:/OBSERVATION:/FINAL: prefixes
        # from user-visible token stream. The `collected` buffer still gets the
        # RAW tokens so the caller's full-text return value (used by _react to
        # parse ACTION lines / FINAL bodies) is unaffected.
        react_filter = _ReActStreamFilter() if (q and stream_label) else None
        r = _litellm_completion(
            model=f"openai/{model}", messages=msgs,
            api_base=LLM_BASE, api_key="local", timeout=timeout,
            stream=True, max_tokens=4096)
        for chunk in r:
            delta = chunk.choices[0].delta if chunk.choices else None
            if delta:
                token = getattr(delta, "content", "") or ""
                reasoning = getattr(delta, "reasoning_content", "") or ""
                if token:
                    collected.append(token)
                    if react_filter is not None:
                        clean = react_filter.feed(token)
                        if clean:
                            emit(q, "token", token=clean, msg=clean, label=stream_label)
                elif reasoning:
                    reasoning_collected.append(reasoning)
        # Flush any trailing buffered text (last partial line w/o newline).
        if react_filter is not None:
            tail = react_filter.flush()
            if tail:
                emit(q, "token", token=tail, msg=tail, label=stream_label)
        result = "".join(collected).strip()
        if not result:
            result = "".join(reasoning_collected).strip()
        return result
    else:
        r = _litellm_completion(
            model=f"openai/{model}", messages=msgs,
            api_base=LLM_BASE, api_key="local", timeout=timeout,
            max_tokens=4096)
        msg_obj = r.choices[0].message
        text = (msg_obj.content or "").strip()
        if not text:
            text = (getattr(msg_obj, "reasoning_content", "") or "").strip()
        return text


# ── Stage 4: direct local model call (no LiteLLM) ─────────────────────────────
def _local_direct_call(prompt: str, system: str = "", timeout: int = 60,
                       max_tokens: int | None = None, *, q=None,
                       stream_label: str = "") -> str:
    """Final safety net: bypass LiteLLM proxy and call the local model directly.

    Production note (2026-07-31): normal chat must stream visible tokens from
    Ollama's native /api/chat. The VPS model is slow per token; waiting for the
    full response makes the UI look frozen and lets upstream clients time out.
    """
    msgs = []
    if system:
        msgs.append({"role": "system", "content": system})
    msgs.append({"role": "user", "content": prompt})
    token_budget = int(max_tokens or LOCAL_CHAT_MAX_TOKENS)
    should_stream = bool(q is not None and stream_label)

    native_payload = json.dumps({
        "model": LOCAL_DIRECT_MODEL,
        "messages": msgs,
        "stream": should_stream,
        "keep_alive": os.getenv("LOCAL_OLLAMA_KEEP_ALIVE", "10m"),
        "options": {"num_predict": token_budget, "temperature": 0.5},
    }).encode("utf-8")
    collected: list[str] = []
    try:
        req = urllib.request.Request(
            LOCAL_OLLAMA_CHAT_URL,
            data=native_payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=timeout) as r:
            if should_stream:
                for raw in r:
                    if not raw or not raw.strip():
                        continue
                    try:
                        data = json.loads(raw.decode("utf-8", errors="replace"))
                    except Exception:
                        continue
                    token = ((data.get("message") or {}).get("content")
                             or data.get("response") or "")
                    if token:
                        collected.append(token)
                        emit(q, "token", token=token, msg=token,
                             label=stream_label)
                    if data.get("done"):
                        break
                text = "".join(collected).strip()
            else:
                data = json.loads(r.read().decode("utf-8", errors="replace"))
                text = ((data.get("message") or {}).get("content")
                        or data.get("response") or "").strip()
        if text:
            return text
    except Exception as e:
        partial = "".join(collected).strip()
        if partial:
            sys.stderr.write(
                f"[brain_llm ollama-native stream partial after {type(e).__name__}: {e}]\n")
            return partial
        sys.stderr.write(
            f"[brain_llm ollama-native direct failed: {type(e).__name__}: {e}]\n")

    payload = json.dumps({
        "model": LOCAL_DIRECT_MODEL,
        "messages": msgs,
        "max_tokens": token_budget,
        "temperature": 0.5,
    }).encode("utf-8")
    try:
        req = urllib.request.Request(
            LOCAL_DIRECT_URL,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=timeout) as r:
            data = json.loads(r.read().decode("utf-8", errors="replace"))
        text = ((data.get("choices") or [{}])[0].get("message", {}).get("content") or "").strip()
        text = text or _NO_LLM_USER_MSG
        if q is not None and stream_label and text:
            emit(q, "token", token=text, msg=text, label=stream_label)
        return text
    except Exception as e:
        sys.stderr.write(f"[brain_llm local-direct fallback failed: {type(e).__name__}: {e}]\n")
        if q is not None and stream_label:
            emit(q, "token", token=_NO_LLM_USER_MSG, msg=_NO_LLM_USER_MSG,
                 label=stream_label)
        return _NO_LLM_USER_MSG


def llm_chat_direct(prompt: str, system: str = "", *, q=None,
                    stream_label: str = "", agent_name: str = "",
                    timeout: int = 75, max_tokens: int = 96) -> str:
    """Fast path for user-facing conversational chat.

    Streams native Ollama tokens into the SSE queue when one is provided. This
    keeps the UI visibly alive even on the current slower VPS model.
    """
    if agent_name:
        agent_set(agent_name, "working", prompt[:60], 50, FAST)
    result = _local_direct_call(prompt, system, timeout=timeout,
                                max_tokens=max_tokens, q=q,
                                stream_label=stream_label)
    result = result or _NO_LLM_USER_MSG
    if agent_name:
        status = "done" if result and result != _NO_LLM_USER_MSG else "error"
        agent_set(agent_name, status, result[:60], 100, FAST)
    return result


# ── Public LLM interface ───────────────────────────────────────────────────────
def llm(model: str, prompt: str, system: str = "", *,
        q=None, stream_label: str = "", agent_name: str = "",
        use_cache: bool = False, timeout: int = 300) -> str:
    """
    4-stage fallback (no Anthropic dependency):
      1. LiteLLM streaming   (model → heavy-coder / fast-agent / vision)
      2. LiteLLM non-stream  (same model, no stream)
      3. LiteLLM fast-agent  (if HEAVY failed, retry with FAST)
      4. Direct LM Studio    (bypass LiteLLM proxy entirely)
    """
    if agent_name:
        agent_set(agent_name, "working", prompt[:60], 50, model)

    if use_cache:
        ck = _cache_key(model, prompt, system)
        cached = _cache_get(ck)
        if cached:
            if agent_name:
                agent_set(agent_name, "done", cached[:60], 100, model)
            return cached

    msgs = []
    if system:
        msgs.append({"role": "system", "content": system})
    msgs.append({"role": "user", "content": prompt})

    text = ""

    # Stage 1 — litellm streaming
    try:
        text = _litellm_call(model, msgs, stream=True, timeout=timeout,
                             q=q, stream_label=stream_label)
    except Exception as e:
        sys.stderr.write(f"[brain_llm stage1 stream failed model={model}: {type(e).__name__}: {e}]\n")

    # Stage 2 — litellm non-streaming
    if not text:
        try:
            text = _litellm_call(model, msgs, stream=False, timeout=timeout)
        except Exception as e:
            sys.stderr.write(f"[brain_llm stage2 nonstream failed model={model}: {type(e).__name__}: {e}]\n")

    # Stage 3 — try fast-agent if heavy-coder failed
    if not text and model == HEAVY:
        try:
            text = _litellm_call(FAST, msgs, stream=False, timeout=60)
        except Exception as e:
            sys.stderr.write(f"[brain_llm stage3 fast-retry failed: {type(e).__name__}: {e}]\n")

    # Stage 4 — direct LM Studio fallback (bypasses LiteLLM proxy)
    if not text:
        text = _local_direct_call(prompt, system, timeout=60)

    result = text or _NO_LLM_USER_MSG

    if use_cache and result and result != _NO_LLM_USER_MSG:
        _cache_put(ck, result)

    if agent_name:
        status = "done" if result and result != _NO_LLM_USER_MSG else "error"
        agent_set(agent_name, status, result[:60], 100, model)

    return result


def llm_json(model: str, prompt: str, system: str = "", **kwargs) -> dict:
    """LLM call that forces JSON output and parses it."""
    json_sys = (system + "\n\nRespond ONLY with valid JSON. No prose, no markdown."
                if system else "Respond ONLY with valid JSON. No prose, no markdown.")
    raw = llm(model, prompt, json_sys, **kwargs)
    # try to extract JSON from response
    for start in [raw.find("{"), raw.find("[")]:
        if start >= 0:
            try:
                return json.loads(raw[start:])
            except Exception as e:
                sys.stderr.write(f"[brain_llm llm_json parse failed: {type(e).__name__}]\n")
    # fallback: wrap raw in a dict
    return {"raw": raw}


def llm_fast(prompt: str, system: str = "", **kwargs) -> str:
    # W2: pin English + brevity by default for chat-fast path. Caller-supplied system overrides.
    if not system:
        system = "Respond in English. Be concise and friendly."
    # W3: enable response cache by default for fast path (cache infra already exists, was disabled).
    kwargs.setdefault("use_cache", True)
    return llm(FAST, prompt, system, **kwargs)


def llm_heavy(prompt: str, system: str = "", **kwargs) -> str:
    if not system:
        system = "Respond in English."
    return llm(HEAVY, prompt, system, **kwargs)
