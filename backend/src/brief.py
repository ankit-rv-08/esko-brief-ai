"""Generate a cited, structured design brief from analyzed facts."""
from __future__ import annotations

import logging

from pydantic import BaseModel, Field, field_validator

from src.llm import GroqClient
from src.models import Brief, BriefSection, Confidence, Conflict, Fact, Gap, SourceElement
from src.prompts import (
    BRIEF_GENERATION_SYSTEM,
    BRIEF_GENERATION_USER_TEMPLATE,
    format_conflicts_for_brief,
    format_facts_for_brief,
    format_gaps_for_brief,
)

logger = logging.getLogger(__name__)


class _LLMSection(BaseModel):
    title: str
    content: str
    fact_ids: list[str] = Field(default_factory=list)
    confidence: Confidence | float = Confidence.MEDIUM
    confidence_reason: str | None = None

    @field_validator("confidence", mode="before")
    @classmethod
    def normalize_confidence(cls, value: object) -> Confidence:
        """Accept model score variants while keeping the internal enum contract."""
        if isinstance(value, str):
            return Confidence(value.lower())
        if isinstance(value, (int, float)):
            if value >= 0.8:
                return Confidence.HIGH
            if value >= 0.5:
                return Confidence.MEDIUM
            return Confidence.LOW
        return Confidence.MEDIUM


class _LLMBriefOutput(BaseModel):
    title: str
    sections: list[_LLMSection]
    uncertainty: list[str] = Field(default_factory=list)
    open_questions: list[str] = Field(default_factory=list)


def generate_brief(
    *,
    facts: list[Fact],
    conflicts: list[Conflict],
    gaps: list[Gap],
    source_elements: list[SourceElement],
    client: GroqClient,
) -> Brief:
    """Generate prose and strip any fact citations not present in `facts`."""
    prompt = BRIEF_GENERATION_USER_TEMPLATE.format(
        formatted_facts=format_facts_for_brief(facts),
        formatted_conflicts=format_conflicts_for_brief(conflicts),
        formatted_gaps=format_gaps_for_brief(gaps),
    )
    raw = client.generate_json(
        system=BRIEF_GENERATION_SYSTEM,
        user=prompt,
        schema=_LLMBriefOutput,
    )
    valid_ids = {fact.id for fact in facts}
    sections = []
    for section in raw.sections:
        valid_fact_ids = [fact_id for fact_id in section.fact_ids if fact_id in valid_ids]
        if len(valid_fact_ids) != len(section.fact_ids):
            logger.warning("Stripped unknown fact citations from section %s", section.title)
        sections.append(BriefSection(
            title=section.title,
            content=section.content,
            fact_ids=valid_fact_ids,
            confidence=section.confidence,
            confidence_reason=section.confidence_reason,
        ))
    return Brief(
        title=raw.title,
        sections=sections,
        uncertainty=raw.uncertainty,
        open_questions=raw.open_questions,
        source_elements=source_elements,
        facts=facts,
        conflicts=conflicts,
        gaps=gaps,
    )