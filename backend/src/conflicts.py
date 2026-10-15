"""Deterministic conflict and required-field gap detection."""
from __future__ import annotations

import logging
import re
from collections import defaultdict

from src.models import AnalysisResult, Conflict, Fact, Gap

logger = logging.getLogger(__name__)

REQUIRED_FIELDS = [
    Gap(field="Product Name", description="The product's official name", category="Product"),
    Gap(field="Brand", description="The brand or manufacturer", category="Product"),
    Gap(field="Pack Size", description="Net weight or volume", category="Packaging"),
    Gap(field="Legal Name / Statement of Identity", description="Regulatory product naming", category="Legal"),
    Gap(field="Ingredient List", description="Full ingredient list, descending by weight", category="Legal"),
    Gap(field="Allergen Information", description="Required allergen statement", category="Legal"),
    Gap(field="Nutrition Panel", description="Nutrition Facts content and format", category="Nutrition"),
    Gap(field="Storage Instructions", description="How the product should be stored", category="Packaging"),
    Gap(field="Country of Market", description="Target market country", category="Legal"),
    Gap(field="Claims & Certifications", description="Marketing or certification claims", category="Branding"),
]
_NAME_RE = re.compile(r"[^a-z0-9]+")


def _normalize_name(value: str) -> str:
    return _NAME_RE.sub(" ", value.lower()).strip()


def _normalize_value(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower()).rstrip(".")


def detect_conflicts(facts: list[Fact]) -> list[Conflict]:
    """Find same-name facts with more than one normalized value."""
    grouped: dict[str, list[Fact]] = defaultdict(list)
    for fact in facts:
        grouped[_normalize_name(fact.name)].append(fact)
    conflicts = []
    for group in grouped.values():
        if len(group) > 1 and len({_normalize_value(f.value) for f in group}) > 1:
            conflicts.append(Conflict(
                name=group[0].name,
                facts=group,
                note=f"{len(group)} facts contain distinct values",
            ))
    logger.info("Detected %d conflicts", len(conflicts))
    return conflicts


def detect_gaps(facts: list[Fact]) -> list[Gap]:
    """Return required fields not covered by a fact name."""
    names = [_normalize_name(fact.name) for fact in facts]
    missing = [
        required for required in REQUIRED_FIELDS
        if not any(
            (target := _normalize_name(required.field)) == name
            or target in name
            or name in target
            for name in names
        )
    ]
    logger.info("Detected %d gaps", len(missing))
    return missing


def analyze(facts: list[Fact]) -> AnalysisResult:
    """Run deterministic conflict and gap analysis."""
    return AnalysisResult(conflicts=detect_conflicts(facts), gaps=detect_gaps(facts))