"""Small, observable Groq client wrapper for text and vision calls."""
from __future__ import annotations

import base64
import logging
import time
from pathlib import Path
from typing import Type, TypeVar

from groq import Groq
from pydantic import BaseModel, ValidationError

logger = logging.getLogger(__name__)
T = TypeVar("T", bound=BaseModel)

TEXT_MODEL = "openai/gpt-oss-120b"
VISION_MODEL = "llama-3.2-90b-vision-preview"
DEFAULT_TIMEOUT = 60.0
DEFAULT_MAX_RETRIES = 3


class LLMError(RuntimeError):
    """Raised when a Groq request cannot produce validated output."""


class GroqClient:
    """Provide validated JSON generation and image description through Groq."""

    def __init__(self, api_key: str, *, timeout: float = DEFAULT_TIMEOUT) -> None:
        self._client = Groq(api_key=api_key, timeout=timeout)

    def generate_json(
        self,
        *,
        system: str,
        user: str,
        schema: Type[T],
        max_retries: int = DEFAULT_MAX_RETRIES,
    ) -> T:
        """Call the text model and validate its JSON against a Pydantic schema."""
        last_error: Exception | None = None
        for attempt in range(1, max_retries + 1):
            started = time.perf_counter()
            try:
                response = self._client.chat.completions.create(
                    model=TEXT_MODEL,
                    messages=[
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.1,
                    max_tokens=4096,
                )
                raw = response.choices[0].message.content or "{}"
                result = schema.model_validate_json(raw)
                logger.info(
                    "groq.generate_json model=%s attempt=%d elapsed_ms=%.0f",
                    TEXT_MODEL, attempt, (time.perf_counter() - started) * 1000,
                )
                return result
            except (ValidationError, Exception) as exc:  # noqa: BLE001
                last_error = exc
                logger.warning("Groq JSON attempt %d/%d failed: %s", attempt, max_retries, exc)
                if attempt < max_retries:
                    retry_after = self._get_retry_after(str(exc))
                    logger.warning(f"Rate limited, waiting {retry_after}s before retry")
                    time.sleep(retry_after)
        raise LLMError(f"generate_json failed after {max_retries} attempts: {last_error}")

    @staticmethod
    def _get_retry_after(error_msg: str) -> int:
        """Extract a retry-after delay from Groq rate-limit errors.

        Groq returns "Please try again in 55m0.048s". Cap at 5 minutes.
        """
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
        response = self._client.chat.completions.create(
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


def from_env() -> GroqClient:
    """Create a client from the current process environment."""
    import os

    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise LLMError("GROQ_API_KEY not set in environment")
    return GroqClient(api_key=api_key)