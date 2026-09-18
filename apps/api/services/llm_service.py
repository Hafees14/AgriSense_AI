import json

import httpx

from apps.api.core.config import settings

LANGUAGE_NAMES = {
    "en": "English",
    "si": "Sinhala (Sri Lanka)",
    "ta": "Tamil (Sri Lanka)",
}

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


def _require_api_key() -> str:
    api_key = _clean_api_key()
    if not api_key or api_key.lower() in {"changeme", "your-api-key-here", "sk-ant-...", "sk-or-..."}:
        raise LLMConfigError(
            "LLM_API_KEY is missing or still a placeholder. Set a real OpenRouter API key "
            "(from https://openrouter.ai/keys) in apps/api/.env (no surrounding quotes) and "
            "restart the api container."
        )
    return api_key


async def _chat_completion(messages: list[dict], max_tokens: int = 500) -> str:
    """Shared OpenRouter call used by both the chat assistant and the
    treatment-text translator, so the retired-model fallback logic lives in
    exactly one place.
    """
    api_key = _require_api_key()
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
                        "max_tokens": max_tokens,
                        "messages": messages,
                    },
                )
                # A 404 here almost always means "this model id has no
                # endpoints" (retired/removed), not a routing typo — try the
                # next model instead of failing the whole request.
                if response.status_code == 404:
                    last_error = LLMConfigError(
                        f"OpenRouter model '{model_id}' returned 404 (likely retired). "
                        "Trying fallback model..."
                    )
                    continue
                response.raise_for_status()
                data = response.json()
                return data["choices"][0]["message"]["content"]
            except httpx.HTTPStatusError as exc:
                last_error = exc
                continue

    raise LLMConfigError(
        "All configured OpenRouter models are unavailable (see server logs). "
        "Check https://openrouter.ai/api/v1/models for current free-tier model ids "
        "and update OPENROUTER_MODEL / OPENROUTER_FALLBACK_MODELS in llm_service.py."
    ) from last_error


async def generate_assistant_reply(
    history: list[tuple[str, str]],
    new_message: str,
    context_block: str = "",
    language: str = "en",
) -> tuple[str, list[str]]:
    system_prompt = BASE_SYSTEM_PROMPT + context_block
    if language != "en":
        language_name = LANGUAGE_NAMES.get(language, language)
        system_prompt += (
            f"\nIMPORTANT: Reply entirely in {language_name}. Keep any chemical/product names in "
            "their common form (Latin/English) since farmers usually recognize product labels that "
            f"way, but every sentence of your explanation must be in {language_name}."
        )

    messages = [{"role": "system", "content": system_prompt}]
    messages += [{"role": r, "content": c} for r, c in history]
    messages.append({"role": "user", "content": new_message})

    reply_text = await _chat_completion(messages)
    follow_ups = _extract_follow_up_questions(reply_text)
    return reply_text, follow_ups


async def translate_fields(fields: dict[str, str | None], target_language: str) -> dict[str, str | None]:
    """Translate a diagnosis result's advice text (causes, treatments,
    prevention tips, etc.) into the farmer's preferred language.

    Best-effort: on any failure (bad JSON back, LLM unavailable, malformed
    response) this returns the ORIGINAL English fields unchanged rather than
    raising — a diagnosis result must never fail just because the
    translation step had a hiccup. Keys with a None value are skipped and
    returned as None, so callers don't need to filter first.
    """
    if target_language == "en":
        return fields

    translatable = {k: v for k, v in fields.items() if v}
    if not translatable:
        return fields

    language_name = LANGUAGE_NAMES.get(target_language, target_language)
    prompt = (
        f"Translate the values of this JSON object into {language_name}. "
        "Keep the keys exactly as given. Keep specific chemical/product names in their common "
        "form rather than transliterating them. Respond with ONLY the translated JSON object, "
        "no markdown fences, no commentary.\n\n"
        f"{json.dumps(translatable, ensure_ascii=False)}"
    )

    try:
        raw = await _chat_completion(
            [
                {"role": "system", "content": "You are a precise JSON-in, JSON-out translation tool."},
                {"role": "user", "content": prompt},
            ],
            max_tokens=800,
        )
        cleaned = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        translated = json.loads(cleaned)
        if not isinstance(translated, dict):
            return fields
        # Merge back over the original so any key the model dropped still
        # falls back to its English value instead of disappearing.
        result = dict(fields)
        for key, value in translated.items():
            if key in result and isinstance(value, str):
                result[key] = value
        return result
    except Exception:
        # Translation is a nice-to-have layered on top of a working
        # diagnosis — never let it take the whole response down.
        return fields


def _extract_follow_up_questions(reply_text: str) -> list[str]:
    return [s.strip() + "?" for s in reply_text.split("?")[:-1] if len(s.strip()) > 8][:3]