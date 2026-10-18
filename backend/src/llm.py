"""Drop-in replacement for backend/src/llm.py

What changed vs. the old version:
- OpenAI SDK auto-retry is OFF (it silently re-sent every failed request twice).
- A daily-quota 429 is never retried; that provider is skipped for an hour.
- Disk cache: identical prompts are never sent twice (set LLM_CACHE=0 to disable).
- Provider order and model ids come from .env, nothing is hardcoded.
"""
import hashlib
import json
import logging
import os
import re
import time
from pathlib import Path
from typing import TypeVar

from openai import OpenAI, RateLimitError
from pydantic import BaseModel

logger = logging.getLogger(__name__)
T = TypeVar("T", bound=BaseModel)

USE_CACHE = os.getenv("LLM_CACHE", "1") == "1"
CACHE_DIR = Path(os.getenv("LLM_CACHE_DIR", Path(__file__).resolve().parent.parent / ".llm_cache"))
DEAD_SECONDS = 3600

# name: (base_url, api-key env var or None, model env var)
PROVIDERS = {
    "gemini": ("https://generativelanguage.googleapis.com/v1beta/openai/", "GEMINI_API_KEY", "GEMINI_MODEL"),
    "groq": ("https://api.groq.com/openai/v1", "GROQ_API_KEY", "GROQ_MODEL"),
    "cerebras": ("https://api.cerebras.ai/v1", "CEREBRAS_API_KEY", "CEREBRAS_MODEL"),
    "openrouter": ("https://openrouter.ai/api/v1", "OPENROUTER_API_KEY", "OPENROUTER_MODEL"),
    "ollama": ("http://localhost:11434/v1", None, "OLLAMA_MODEL"),
}


class LLMError(Exception):
    pass


class _DailyQuota(Exception):
    pass


def _is_daily_quota(msg: str) -> bool:
    m = msg.lower()
    return any(s in m for s in ("per day", "perday", "tokens per day", "requests per day", "tpd", "rpd"))


def _retry_delay(msg: str) -> float:
    m = re.search(r"(?:retry|try again)\D{0,15}?(\d+(?:\.\d+)?)\s*s", msg, re.I)
    return float(m.group(1)) + 1 if m else 15.0


def _strip_fences(raw: str) -> str:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```[a-zA-Z]*\n?|```$", "", raw).strip()
    return raw


class MultiProviderClient:
    def __init__(self):
        wanted = [p.strip() for p in os.getenv("LLM_PROVIDERS", "gemini,groq").split(",") if p.strip()]
        self._clients: dict[str, tuple[OpenAI, str]] = {}
        self._dead: dict[str, float] = {}
        for name in wanted:
            if name not in PROVIDERS:
                logger.warning("unknown provider %s", name)
                continue
            base, key_env, model_env = PROVIDERS[name]
            key = os.getenv(key_env, "") if key_env else "ollama"
            model = os.getenv(model_env, "")
            if not key or not model:
                logger.warning("provider %s skipped: set %s and %s", name, key_env, model_env)
                continue
            # max_retries=0 stops the SDK from silently re-sending failed requests
            self._clients[name] = (OpenAI(api_key=key, base_url=base, max_retries=0), model)
        self.order = [n for n in wanted if n in self._clients]
        if not self.order:
            raise LLMError("No usable LLM provider. Check LLM_PROVIDERS and the key/model env vars.")
        logger.info("LLM provider order: %s (cache=%s)", self.order, USE_CACHE)

    def generate_json(
        self,
        system: str,
        user: str,
        schema: type[T],
        model: str | None = None,
        max_retries: int = 2,
        max_tokens: int = 4096,
    ) -> T:
        key = self._cache_key(system, user, schema)
        if USE_CACHE:
            cached = self._cache_get(key, schema)
            if cached is not None:
                logger.info("llm cache hit %s", key[:8])
                return cached

        errors = []
        for i, name in enumerate(self.order):
            if self._dead.get(name, 0) > time.time():
                errors.append(f"{name}: skipped (quota exhausted)")
                continue
            try:
                result, raw = self._call(
                    name, system, user, schema, model if i == 0 else None, max_retries, max_tokens
                )
                if USE_CACHE:
                    self._cache_put(key, raw)
                return result
            except _DailyQuota:
                self._dead[name] = time.time() + DEAD_SECONDS
                errors.append(f"{name}: daily quota exhausted")
                logger.error("%s daily quota exhausted; skipping it for %ds", name, DEAD_SECONDS)
            except Exception as e:
                errors.append(f"{name}: {str(e)[:200]}")
                logger.warning("%s failed: %s", name, str(e)[:200])
        raise LLMError("All providers failed -> " + " | ".join(errors))

    def _call(self, name, system, user, schema, model, max_retries, max_tokens):
        client, default_model = self._clients[name]
        for attempt in range(1, max_retries + 1):
            started = time.perf_counter()
            try:
                resp = client.chat.completions.create(
                    model=model or default_model,
                    messages=[
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                    response_format={"type": "json_object"},
                    max_tokens=max_tokens,
                    timeout=90,
                )
                raw = _strip_fences(resp.choices[0].message.content or "")
                result = schema.model_validate_json(raw)
                logger.info(
                    "%s ok model=%s attempt=%d %.0fms",
                    name, model or default_model, attempt, (time.perf_counter() - started) * 1000,
                )
                return result, raw
            except RateLimitError as e:
                msg = str(e)
                if _is_daily_quota(msg):
                    raise _DailyQuota(msg)
                wait = _retry_delay(msg)
                if attempt == max_retries or wait > 45:
                    raise
                logger.warning("%s rate-limited, waiting %.0fs", name, wait)
                time.sleep(wait)
            except ValueError as e:  # truncated or invalid JSON
                if attempt == max_retries:
                    raise
                max_tokens = min(max_tokens * 2, 16000)
                logger.warning("%s bad JSON (%s); retrying with max_tokens=%d", name, str(e)[:100], max_tokens)
        raise LLMError(f"{name}: exhausted retries")

    @staticmethod
    def _cache_key(system: str, user: str, schema) -> str:
        blob = system + "\x00" + user + "\x00" + json.dumps(schema.model_json_schema(), sort_keys=True)
        return hashlib.sha256(blob.encode()).hexdigest()

    @staticmethod
    def _cache_get(key: str, schema):
        path = CACHE_DIR / f"{key}.json"
        if not path.exists():
            return None
        try:
            return schema.model_validate_json(path.read_text())
        except Exception:
            return None

    @staticmethod
    def _cache_put(key: str, raw: str) -> None:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        (CACHE_DIR / f"{key}.json").write_text(raw)
