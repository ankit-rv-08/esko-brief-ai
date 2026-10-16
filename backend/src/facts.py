"""Extract and validate structured facts from source elements."""
from __future__ import annotations

import hashlib
import json
import logging
from pathlib import Path

from src.llm import GroqClient
from src.models import Fact, FactExtractionResult, SourceElement
from src.prompts import (
    FACT_EXTRACTION_SYSTEM,
    FACT_EXTRACTION_USER_TEMPLATE,
    format_sources_for_extraction,
)

logger = logging.getLogger(__name__)

# Reduced from 8000 to 1500 to halve per-batch token usage.
# Each 1000 chars of source content ≈ 250-300 tokens for GPT-OSS-120B.
# 1500 chars ≈ 400-450 tokens of source + ~4000 tokens of prompt template.
# Total ≈ 4400-4500 TPM, well within the 8000 TPM limit.
MAX_BATCH_CHARS = 1500

# Cache: key = SHA256 of sorted element content, stored as JSON in /tmp/esko_cache/
CACHE_DIR = Path("/tmp/esko_cache")
CACHE_DIR.mkdir(exist_ok=True)


def _cache_key(elements: list[SourceElement]) -> str:
    """Compute a SHA256 cache key from sorted element content."""
    h = hashlib.sha256()
    for el in sorted(elements, key=lambda e: e.id):
        h.update(el.content.encode())
    return h.hexdigest()


def _cache_get(key: str):
    """Load cached data for a key, or return None if not present."""
    path = CACHE_DIR / f"{key}.json"
    if path.exists():
        data = json.loads(path.read_text())
        # Return the dict as-is; callers handle dict vs list
        return data
    return None


def _cache_set(key: str, data: dict):
    """Write data to cache for a key."""
    path = CACHE_DIR / f"{key}.json"
    path.write_text(json.dumps(data))


def _batch_elements(
    elements: list[SourceElement], max_chars: int = MAX_BATCH_CHARS
) -> list[list[SourceElement]]:
    """Split elements into bounded prompt-sized batches."""
    batches: list[list[SourceElement]] = []
    current: list[SourceElement] = []
    current_size = 0
    for element in elements:
        size = len(element.content) + 100
        if current and current_size + size > max_chars:
            batches.append(current)
            current, current_size = [], 0
        current.append(element)
        current_size += size
    if current:
        batches.append(current)
    return batches


def _dedupe(facts: list[Fact]) -> list[Fact]:
    """Merge facts with identical normalized names and values."""
    unique: dict[tuple[str, str], Fact] = {}
    for fact in facts:
        key = (fact.name.strip().lower(), fact.value.strip().lower())
        existing = unique.get(key)
        if existing is None:
            unique[key] = fact
        else:
            existing.sources = list(dict.fromkeys(existing.sources + fact.sources))
            existing.confidence = max(existing.confidence, fact.confidence)
    return list(unique.values())


def extract_facts(elements: list[SourceElement], client: GroqClient) -> list[Fact]:
    """Extract facts in batches and discard facts citing unknown sources."""
    valid_ids = {element.id for element in elements}
    extracted: list[Fact] = []

    # Cache check
    key = _cache_key(elements)
    cached = _cache_get(key)
    if cached is not None:
        logger.info("Fact extraction cache hit for %d elements", len(elements))
        # Cached data is {"facts": [...]}; convert back to list[Fact]
        return [Fact.model_validate(f) for f in cached["facts"]]

    batches = _batch_elements(elements)
    for index, batch in enumerate(batches, start=1):
        logger.info("Extracting facts from batch %d/%d", index, len(batches))
        prompt = FACT_EXTRACTION_USER_TEMPLATE.format(
            formatted_sources=format_sources_for_extraction(batch)
        )
        try:
            result: FactExtractionResult = client.generate_json(
                system=FACT_EXTRACTION_SYSTEM,
                user=prompt,
                schema=FactExtractionResult,
            )
        except Exception as exc:  # noqa: BLE001
            logger.error("Fact extraction batch %d failed: %s", index, exc)
            continue
        for fact in result.facts:
            fact.sources = [source_id for source_id in fact.sources if source_id in valid_ids]
            if fact.sources:
                extracted.append(fact)
            else:
                logger.warning("Dropped fact without valid sources: %s", fact.name)
    result = _dedupe(extracted)
    logger.info("Extracted %d raw facts, %d after dedupe", len(extracted), len(result))
    # Convert facts to dicts for JSON serialization
    cache_data = {
        "facts": [fact.model_dump() for fact in result],
    }
    _cache_set(key, cache_data)
    return result