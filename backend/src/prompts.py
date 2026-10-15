"""Centralized prompts and prompt-formatting helpers."""
from __future__ import annotations

from typing import Iterable

from src.models import Fact, Gap, Conflict, SourceElement

SYSTEM_PREAMBLE = """You are an expert packaging compliance assistant.
Translate messy product inputs into clear, trustworthy design briefs.
Only use information present in the provided sources. Never invent facts.
When information is missing, say so explicitly. Flag conflicts across sources.
Cite sources using the exact source IDs provided.
"""

FACT_EXTRACTION_SYSTEM = SYSTEM_PREAMBLE + """
Extract structured facts. For each fact provide a canonical name, string value,
supporting source IDs, confidence from 0.0 to 1.0, brief reasoning, and category.
Return one fact per distinct piece of information and never invent source IDs.
"""

FACT_EXTRACTION_USER_TEMPLATE = """Source elements:
{formatted_sources}

Return valid JSON: {{"facts": [{{"name": "string", "value": "string",
"sources": ["element_id"], "confidence": 0.0, "reasoning": "string",
"category": "string"}}]}}
"""

VISION_EXTRACTION_SYSTEM = SYSTEM_PREAMBLE + """
Describe all visible packaging text, panel structure, claims, ingredients,
allergen and nutrition content, logos, images, and approximate layout.
Reconstruct fragmented or rotated text where legible and preserve wording.
"""
VISION_EXTRACTION_USER = "Describe all text and visual content on this packaging page in detail."

BRIEF_GENERATION_SYSTEM = SYSTEM_PREAMBLE + """
Produce a structured design brief with these sections in order:
Product Overview, Packaging Requirements, Mandatory Content, Claims & Certifications,
Design Direction, and Open Questions for Agency.
Use 2-5 sentences per section, cite only supplied fact IDs, and mark unsupported
sections as "Not determined from sources." Also return genuine uncertainty and
agency questions.
"""

BRIEF_GENERATION_USER_TEMPLATE = """Extracted facts:
{formatted_facts}

Detected conflicts:
{formatted_conflicts}

Detected gaps:
{formatted_gaps}

Return JSON with title, sections (title, content, fact_ids, confidence,
confidence_reason), uncertainty, and open_questions.
"""


def format_sources_for_extraction(elements: Iterable[SourceElement]) -> str:
    lines: list[str] = []
    for element in elements:
        content = element.content.strip()
        if len(content) > 4000:
            content = content[:4000] + "\n... [truncated]"
        lines.append(f"[{element.id}] {element.ref()}\n{content}")
    return "\n\n".join(lines)


def format_facts_for_brief(facts: Iterable[Fact]) -> str:
    lines = [
        f"[{fact.id}] {fact.name}: {fact.value} "
        f"(confidence: {fact.confidence:.2f}, sources: {', '.join(fact.sources) or 'none'})"
        for fact in facts
    ]
    return "\n".join(lines) or "(no facts extracted)"


def format_conflicts_for_brief(conflicts: Iterable[Conflict]) -> str:
    lines = []
    for conflict in conflicts:
        variants = "; ".join(
            f"{fact.value} (from {', '.join(fact.sources)})" for fact in conflict.facts
        )
        lines.append(f"- {conflict.name}: {variants}")
    return "\n".join(lines) or "(no conflicts detected)"


def format_gaps_for_brief(gaps: Iterable[Gap]) -> str:
    lines = [f"- {gap.field}: {gap.description}" for gap in gaps]
    return "\n".join(lines) or "(no gaps detected)"