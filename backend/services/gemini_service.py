"""
Reusable Google Gemini client wrapper.

This is the single place in the backend that talks to Gemini. Everything
else (chatbot.ai_engine, future summarisation jobs, etc.) consumes the
helpers exposed here so we never duplicate SDK setup or key-lookup logic.

Public surface
--------------
- ``is_available()``    → bool, whether SDK + key are both ready
- ``get_model()``        → str, model id we would call right now
- ``get_client()``        → ``google.genai.Client`` | None
- ``generate_text(...)``  → str, plain text reply from Gemini
"""
from __future__ import annotations

import logging
import os
from typing import Any, Iterable, Optional

from django.conf import settings

logger = logging.getLogger(__name__)

# ── SDK import (soft-fail so the rest of the app still boots if the package
#    is somehow missing on a dev machine)
try:
    from google import genai
    from google.genai import errors as genai_errors
    from google.genai import types as genai_types
    _HAS_SDK = True
except ImportError:  # pragma: no cover — only hit if requirements not installed
    _HAS_SDK = False
    genai = None  # type: ignore[assignment]
    genai_errors = None  # type: ignore[assignment]
    genai_types = None  # type: ignore[assignment]
    logger.warning("google-genai SDK not installed; Gemini disabled")


# Default model — overridable via the GEMINI_MODEL env var.
DEFAULT_MODEL = "gemini-2.5-flash"


# ── Key + model lookup ──────────────────────────────────────────────────────
def _read_api_key() -> str:
    """Read GEMINI_API_KEY from the OS environment, falling back to Django
    settings (which loads .env via python-decouple in this project).
    """
    raw = os.environ.get("GEMINI_API_KEY")
    if raw and raw.strip():
        return raw.strip()
    fallback = getattr(settings, "GEMINI_API_KEY", "") or ""
    return fallback.strip()


def get_model() -> str:
    return (
        os.environ.get("GEMINI_MODEL")
        or getattr(settings, "GEMINI_MODEL", "")
        or DEFAULT_MODEL
    )


def is_available() -> bool:
    """Lightweight pre-flight: do we have everything we need to call Gemini?"""
    return bool(_HAS_SDK and _read_api_key())


# ── Client construction ────────────────────────────────────────────────────
_client_cache: Optional["genai.Client"] = None


def get_client() -> Optional["genai.Client"]:
    """Cached genai.Client for the current process.

    Returns ``None`` when the SDK is missing or the key isn't configured —
    callers should fall through to their own fallback path rather than crash.
    """
    global _client_cache

    if not _HAS_SDK:
        return None

    api_key = _read_api_key()
    if not api_key:
        logger.warning(
            "WARNING: GEMINI_API_KEY not set — Gemini service running in fallback mode"
        )
        return None

    if _client_cache is None:
        try:
            _client_cache = genai.Client(api_key=api_key)
        except Exception as e:  # noqa: BLE001
            logger.exception("Failed to initialise Gemini client: %s", e)
            return None

    return _client_cache


def reset_client_cache() -> None:
    """Test hook — drop the cached client so the next call rebuilds it."""
    global _client_cache
    _client_cache = None


# ── Generation helpers ──────────────────────────────────────────────────────
def generate_text(
    prompt: str,
    *,
    system_instruction: Optional[str] = None,
    history: Iterable[dict] | None = None,
    response_schema: Optional[Any] = None,
    response_mime_type: Optional[str] = None,
    model: Optional[str] = None,
    max_output_tokens: int = 1024,
    temperature: Optional[float] = None,
) -> str:
    """Send ``prompt`` to Gemini and return the response text.

    Args:
        prompt: The current user message.
        system_instruction: Optional system prompt prepended at the model level.
        history: Optional list of prior turns in Gemini "contents" format
            ``[{role: 'user'|'model', parts: [{text: ...}]}, ...]``. The current
            ``prompt`` is appended automatically.
        response_schema: Optional Pydantic / dict schema for structured output.
            When set, ``response_mime_type`` defaults to ``application/json``.
        response_mime_type: Override the response MIME type explicitly.
        model: Override the configured ``GEMINI_MODEL``.
        max_output_tokens: Cap on the response length.
        temperature: Optional sampling temperature.

    Returns:
        Plain text response from Gemini. On any error returns an empty string
        and logs the failure — callers decide how to handle that.
    """
    client = get_client()
    if client is None or not _HAS_SDK:
        return ""

    contents: list[dict] = []
    if history:
        contents.extend(history)
    contents.append({"role": "user", "parts": [{"text": prompt}]})

    config_kwargs: dict[str, Any] = {"max_output_tokens": max_output_tokens}
    if system_instruction:
        config_kwargs["system_instruction"] = system_instruction
    if temperature is not None:
        config_kwargs["temperature"] = temperature
    if response_schema is not None:
        config_kwargs["response_schema"] = response_schema
        config_kwargs["response_mime_type"] = response_mime_type or "application/json"
    elif response_mime_type:
        config_kwargs["response_mime_type"] = response_mime_type

    try:
        config = genai_types.GenerateContentConfig(**config_kwargs)
        response = client.models.generate_content(
            model=model or get_model(),
            contents=contents,
            config=config,
        )
    except genai_errors.APIError as e:
        logger.error("Gemini API error: %s", e)
        return ""
    except Exception as e:  # noqa: BLE001
        logger.exception("Unexpected Gemini error: %s", e)
        return ""

    text = getattr(response, "text", "") or ""
    return text.strip()
