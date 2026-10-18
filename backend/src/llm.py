"""Multi-provider LLM client with Gemini primary and Mistral fallback."""
from __future__ import annotations

import base64
import logging
import time
from pathlib import Path
from typing import Type, TypeVar

from openai import OpenAI
from mistralai.client import Mistral
from mistralai.utils import BackoffStrategy, RetryConfig
from pydantic import BaseModel, ValidationError

logger = logging.getLogger(__name__)
T = TypeVar("T", bound=BaseModel)

# ============ Gemini Client ============
gemini_client = OpenAI(
    api_key="",
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
)

# ============ Mistral Client ============
mistral_client = Mistral(
    api_key="",
    retry_config=RetryConfig("backoff", BackoffStrategy(1, 50, 1.1, 100), False),
)

GEMINI_MODEL = "gemini-2.5-flash"
MISTRAL_MODEL = "mistral-small-latest"
VISION_MODEL = "gemini-2.5-flash"
DEFAULT_TIMEOUT = 60.0
DEFAULT_MAX_RETRIES = 3


class LLMError(RuntimeError):
    """Raised when an LLM request cannot produce validated output."""


class MultiProviderClient:
    """Provide validated JSON generation and image description with automatic failover."""

    def __init__(self, gemini_api_key: str, mistral_api_key: str, *, timeout: float = DEFAULT_TIMEOUT) -> None:
        self.gemini_client = OpenAI(
            api_key=gemini_api_key,
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
            timeout=timeout,
        )
        self.mistral_client = Mistral(
            api_key=mistral_api_key,
            retry_config=RetryConfig("backoff", BackoffStrategy(1, 50, 1.1, 100), False),
        )

    def generate_json(
        self,
        *,
        system: str,
        user: str,
        schema: Type[T],
        model: str | None = None,
        max_retries: int = DEFAULT_MAX_RETRIES,
    ) -> T:
        """Try Gemini first; on 429/timeout/413, automatically fall back to Mistral."""
        # ---- Attempt 1: Gemini ----
        try:
            return self._call_gemini(system, user, schema, model, max_retries)
        except Exception as e:
            logger.warning("Gemini failed: %s — falling back to Mistral", e)

        # ---- Attempt 2: Mistral ----
        try:
            return self._call_mistral(system, user, schema, max_retries)
        except Exception as e:
            logger.error("Mistral also failed: %s", e)
            raise LLMError(f"generate_json failed after trying both providers: {e}")

    def _call_gemini(
        self,
        system: str,
        user: str,
        schema: Type[T],
        model: str | None = None,
        max_retries: int = DEFAULT_MAX_RETRIES,
    ) -> T:
        """Call Gemini with retry logic."""
        last_error: Exception | None = None
        for attempt in range(1, max_retries + 1):
            started = time.perf_counter()
            try:
                resp = self.gemini_client.chat.completions.create(
                    model=model or GEMINI_MODEL,
                    messages=[
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.1,
                    max_tokens=4096,
                )
                raw = resp.choices[0].message.content or "{}"
                result = schema.model_validate_json(raw)
                logger.info(
                    "gemini.generate_json model=%s attempt=%d elapsed_ms=%.0f",
                    model or GEMINI_MODEL, attempt, (time.perf_counter() - started) * 1000,
                )
                return result
            except (ValidationError, Exception) as exc:
                last_error = exc
                logger.warning("Gemini JSON attempt %d/%d failed: %s", attempt, max_retries, exc)
                if attempt < max_retries:
                    retry_after = self._get_retry_after(str(exc))
                    logger.warning(f"Rate limited, waiting {retry_after}s before retry")
                    time.sleep(retry_after)
        raise LLMError(f"Gemini generate_json failed after {max_retries} attempts: {last_error}")

    def _call_mistral(
        self,
        system: str,
        user: str,
        schema: Type[T],
        max_retries: int = DEFAULT_MAX_RETRIES,
    ) -> T:
        """Call Mistral with retry logic."""
        last_error: Exception | None = None
        for attempt in range(1, max_retries + 1):
            started = time.perf_counter()
            try:
                resp = self.mistral_client.chat.complete(
                    model=MISTRAL_MODEL,
                    messages=[
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.1,
                    max_tokens=4096,
                )
                raw = resp.choices[0].message.content or "{}"
                result = schema.model_validate_json(raw)
                logger.info(
                    "mistral.generate_json model=%s attempt=%d elapsed_ms=%.0f",
                    MISTRAL_MODEL, attempt, (time.perf_counter() - started) * 1000,
                )
                return result
            except (ValidationError, Exception) as exc:
                last_error = exc
                logger.warning("Mistral JSON attempt %d/%d failed: %s", attempt, max_retries, exc)
                if attempt < max_retries:
                    retry_after = self._get_retry_after(str(exc))
                    logger.warning(f"Rate limited, waiting {retry_after}s before retry")
                    time.sleep(retry_after)
        raise LLMError(f"Mistral generate_json failed after {max_retries} attempts: {last_error}")

    @staticmethod
    def _get_retry_after(error_msg: str) -> int:
        """Extract a retry-after delay from rate-limit errors."""
        import re

        match = re.search(r'in (\d+)m(\d+\.?\d*)s', error_msg)
        if match:
            minutes = int(match.group(1))
            seconds = float(match.group(2))
            return min(int(minutes * 60 + seconds), 300)
        return 30  # default

    def describe(self, *, image_path: str, system: str, user: str) -> str:
        """Describe a local image with the configured vision model."""
        encoded = base64.b64encode(Path(image_path).read_bytes()).decode("ascii")
        response = self.gemini_client.chat.completions.create(
            model=VISION_MODEL,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": [
                    {"type": "text", "text": user},
                    {"type": "image_url", "image_url": {
                        "url": f"data:image/png;base64,{encoded}"
                    }},
                ]},
            ],
            temperature=0.1,
            max_tokens=2048,
        )
        return response.choices[0].message.content or ""


def from_env() -> MultiProviderClient:
    """Create a client from the current process environment."""
    import os

    gemini_api_key = os.environ.get("GEMINI_API_KEY")
    mistral_api_key = os.environ.get("MISTRAL_API_KEY")
    if not gemini_api_key:
        raise LLMError("GEMINI_API_KEY not set in environment")
    if not mistral_api_key:
        raise LLMError("MISTRAL_API_KEY not set in environment")
    return MultiProviderClient(gemini_api_key=gemini_api_key, mistral_api_key=mistral_api_key)
