"""Gemini service.  Save as: apps/api/services/gemini_assistant.py"""
from google import genai
from google.genai import types

from apps.api.core.config import settings

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if not settings.GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not set")
    if _client is None:
        _client = genai.Client(api_key=settings.GEMINI_API_KEY)
    return _client


SYSTEM_PROMPT = """You are AgriSense Assistant for farmers in Sri Lanka.
Rules:
- Answer only farming questions: crops, pests, diseases, soil, water, weather.
- Reply in the user's language (en, si or ta). Keep answers short and simple.
- Never give exact pesticide doses. Say to follow the product label and ask a local agriculture officer.
- If a diagnosis has confidence below 70%, say it is unconfirmed and give no treatment advice.
- If unsure, say so. Never invent facts."""


async def ask_gemini(
    message: str,
    history: list[dict],
    language: str,
    diagnosis_summary: str | None,
) -> str:
    system = SYSTEM_PROMPT + f"\nUser language: {language}."
    if diagnosis_summary:
        system += f"\nCurrent diagnosis: {diagnosis_summary}"

    contents = [
        types.Content(
            role="user" if m["role"] == "user" else "model",
            parts=[types.Part.from_text(text=m["content"])],
        )
        for m in history[-10:]
    ]
    contents.append(types.Content(role="user", parts=[types.Part.from_text(text=message)]))

    resp = await _get_client().aio.models.generate_content(
        model=settings.GEMINI_MODEL,
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=system,
            max_output_tokens=600,
            temperature=0.4,
        ),
    )
    return resp.text or ""