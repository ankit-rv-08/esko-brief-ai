"""Extract and validate structured facts from source elements."""
from __future__ import annotations

import logging

from src.llm import GroqClient
from src.models import Fact, FactExtractionResult, SourceElement
from src.prompts import (
    FACT_EXTRACTION_SYSTEM,
    FACT_EXTRACTION_USER_TEMPLATE,
    format_sources_for_extraction,
)

logger = logging.getLogger(__name__)
MAX_BATCH_CHARS = 8000


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
    return result