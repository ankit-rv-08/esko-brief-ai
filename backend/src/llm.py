"""Multi-provider LLM client with Gemini primary and Groq fallback."""
import os
import time
import logging
from typing import TypeVar

from openai import OpenAI
from pydantic import BaseModel, ValidationError

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

# ============ Models ============
GEMINI_MODEL = "gemini-3.5-flash-lite"   # 15 RPM, 500 RPD, 250K TPM
GROQ_MODEL = "openai/gpt-oss-120b"        # 30 RPM, 8K TPM (only for short calls)

FORCE_PROVIDER = os.getenv("FORCE_PROVIDER", "").lower()

DEFAULT_TIMEOUT = 120.0


class LLMError(Exception):
    pass


class MultiProviderClient:
    def __init__(self):
        self.gemini_api_key = os.getenv("GEMINI_API_KEY")
        self.groq_api_key = os.getenv("GROQ_API_KEY", "")
        if not self.gemini_api_key:
            raise LLMError("GEMINI_API_KEY not set")

        self.gemini_client = OpenAI(
            api_key=self.gemini_api_key,
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
        )

        if self.groq_api_key:
            self.groq_client = OpenAI(
                api_key=self.groq_api_key,
                base_url="https://api.groq.com/openai/v1",
            )
        else:
            self.groq_client = None

    def generate_json(
        self,
        system: str,
        user: str,
        schema: type[T],
        model: str | None = None,
        max_retries: int = 3,
    ) -> T:
        if FORCE_PROVIDER == "groq":
            logger.info("FORCE_PROVIDER=groq — skipping Gemini")
            return self._call_groq(system, user, schema, max_retries)

        # Attempt 1: Gemini
        try:
            return self._call_gemini(system, user, schema, model, max_retries)
        except Exception as e:
            logger.warning("Gemini failed: %s — falling back to Groq", e)

        # Attempt 2: Groq
        return self._call_groq(system, user, schema, max_retries)

    def _call_gemini(
        self, system: str, user: str, schema: type[T], model: str | None, max_retries: int
    ) -> T:
        last_err = None
        for attempt in range(1, max_retries + 1):
            try:
                started = time.perf_counter()
                resp = self.gemini_client.chat.completions.create(
                    model=model or GEMINI_MODEL,
                    messages=[
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                    response_format={"type": "json_object"},
                    timeout=DEFAULT_TIMEOUT,
                )
                raw = resp.choices[0].message.content
                elapsed = (time.perf_counter() - started) * 1000
                logger.info("gemini.generate_json model=%s attempt=%d elapsed_ms=%.0f",
                            model or GEMINI_MODEL, attempt, elapsed)
                return schema.model_validate_json(raw)
            except Exception as e:
                last_err = e
                logger.warning("Gemini JSON attempt %d/%d failed: %s", attempt, max_retries, e)
                if attempt < max_retries:
                    wait = 15 * attempt  # 15s, 30s
                    logger.warning("Waiting %ds before retry", wait)
                    time.sleep(wait)
        raise LLMError(f"Gemini generate_json failed after {max_retries} attempts: {last_err}")

    def _call_groq(
        self, system: str, user: str, schema: type[T], max_retries: int
    ) -> T:
        if not self.groq_client:
            raise LLMError("Groq client not available (GROQ_API_KEY not set)")

        last_err = None
        for attempt in range(1, max_retries + 1):
            try:
                started = time.perf_counter()
                resp = self.groq_client.chat.completions.create(
                    model=GROQ_MODEL,
                    messages=[
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                    response_format={"type": "json_object"},
                    timeout=60.0,
                )
                raw = resp.choices[0].message.content
                elapsed = (time.perf_counter() - started) * 1000
                logger.info("groq.generate_json model=%s attempt=%d elapsed_ms=%.0f",
                            GROQ_MODEL, attempt, elapsed)
                return schema.model_validate_json(raw)
            except Exception as e:
                last_err = e
                logger.warning("Groq JSON attempt %d/%d failed: %s", attempt, max_retries, e)
                if attempt < max_retries:
                    time.sleep(10)
        raise LLMError(f"Groq generate_json failed after {max_retries} attempts: {last_err}")

    def describe(self, *, image_path: str, system: str, user: str) -> str:
        """Describe a local image with the configured vision model."""
        import base64
        from pathlib import Path

        encoded = base64.b64encode(Path(image_path).read_bytes()).decode("ascii")
        response = self.gemini_client.chat.completions.create(
            model=GEMINI_MODEL,
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
    return MultiProviderClient()
