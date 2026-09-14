import httpx

from apps.api.core.config import settings

BASE_SYSTEM_PROMPT = """You are AgriSense AI's agricultural extension assistant, speaking with
smallholder and commercial farmers. Behave like an experienced agricultural extension officer:
- Ask clarifying follow-up questions (crop, symptoms, duration, weather, region) before giving
  firm treatment or fertilizer recommendations, unless the farmer has already given enough detail.
- Ground answers in established agricultural practice; do not invent chemical dosages.
- Keep responses concise and practical for a mobile chat interface.
- If farmer context is provided below, use it naturally (e.g. reference their farm, their last
  diagnosis, or current weather risk) instead of asking the farmer to repeat information you
  already have.
"""

# OpenRouter is OpenAI-API-compatible and offers several free-tier models
# (rate-limited but $0 cost), which is why we're using it instead of calling
# Anthropic's API directly — that requires a separate paid Anthropic Console key.
#
# IMPORTANT: OpenRouter periodically retires free-tier models. A retired model
# ID stays listed but every request against it fails with a 404
# ("No endpoints found for <model>") that looks identical to a routing/auth
# bug. If /chat starts 502ing again with a 404 to this URL, check
# https://openrouter.ai/api/v1/models (or the model's page) to see if
# OPENROUTER_MODEL below has been retired, and swap in a current ":free" id.
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODEL = "nex-agi/nex-n2.5-mini:free"
# Tried in order if the primary model has no available endpoints (404).
OPENROUTER_FALLBACK_MODELS = [
    "nex-agi/nex-n2.5-pro:free",
    "inclusionai/ling-3.0-flash-vl:free",
]


class LLMConfigError(RuntimeError):
    """Raised when LLM_API_KEY is missing or obviously malformed, before we
    even make a network call. Caught in the chat router and turned into a
    clean error response instead of surfacing as a confusing 401."""


def _clean_api_key() -> str:
    # .env files loaded via docker-compose's `env_file:` are passed through
    # literally — if the value has surrounding quotes (LLM_API_KEY="sk-...")
    # those quote characters end up IN the header value and the request
    # gets rejected with a 401 that looks identical to "no key at all".
    key = (settings.LLM_API_KEY or "").strip()
    if key.startswith(("'", '"')) and key.endswith(("'", '"')) and len(key) > 1:
        key = key[1:-1].strip()
    return key


async def generate_assistant_reply(
    history: list[tuple[str, str]],
    new_message: str,
    context_block: str = "",
) -> tuple[str, list[str]]:
    api_key = _clean_api_key()
    if not api_key or api_key.lower() in {"changeme", "your-api-key-here", "sk-ant-...", "sk-or-..."}:
        raise LLMConfigError(
            "LLM_API_KEY is missing or still a placeholder. Set a real OpenRouter API key "
            "(from https://openrouter.ai/keys) in apps/api/.env (no surrounding quotes) and "
            "restart the api container."
        )

    system_prompt = BASE_SYSTEM_PROMPT + context_block
    messages = [{"role": "system", "content": system_prompt}]
    messages += [{"role": r, "content": c} for r, c in history]
    messages.append({"role": "user", "content": new_message})

    models_to_try = [OPENROUTER_MODEL, *OPENROUTER_FALLBACK_MODELS]
    last_error: Exception | None = None

    async with httpx.AsyncClient(timeout=30.0) as client:
        for model_id in models_to_try:
            try:
                response = await client.post(
                    OPENROUTER_URL,
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                        # Optional but recommended by OpenRouter for free-tier routing/analytics.
                        "HTTP-Referer": "http://localhost:3000",
                        "X-Title": "AgriSense AI",
                    },
                    json={
                        "model": model_id,
                        "max_tokens": 500,
                        "messages": messages,
                    },
                )
                # A 404 here almost always means "this model id has no
                # endpoints" (retired/removed), not a routing typo — try the
                # next model instead of failing the whole chat request.
                if response.status_code == 404:
                    last_error = LLMConfigError(
                        f"OpenRouter model '{model_id}' returned 404 (likely retired). "
                        "Trying fallback model..."
                    )
                    continue
                response.raise_for_status()
                data = response.json()
                reply_text = data["choices"][0]["message"]["content"]
                break
            except httpx.HTTPStatusError as exc:
                last_error = exc
                continue
        else:
            raise LLMConfigError(
                "All configured OpenRouter models are unavailable (see server logs). "
                "Check https://openrouter.ai/api/v1/models for current free-tier model ids "
                "and update OPENROUTER_MODEL / OPENROUTER_FALLBACK_MODELS in llm_service.py."
            ) from last_error

    follow_ups = _extract_follow_up_questions(reply_text)
    return reply_text, follow_ups


def _extract_follow_up_questions(reply_text: str) -> list[str]:
    return [s.strip() + "?" for s in reply_text.split("?")[:-1] if len(s.strip()) > 8][:3]