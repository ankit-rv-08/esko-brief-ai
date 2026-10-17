"""Shared validated models for the Esko Brief AI pipeline."""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import uuid4

from pydantic import BaseModel, Field


class SourceType(str, Enum):
    PDF = "pdf"
    DOCX = "docx"
    XLSX = "xlsx"
    IMAGE = "image"
    TEXT = "text"


class Confidence(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class Severity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"


class SourceElement(BaseModel):
    """One atomic, citeable unit extracted from an input file."""

    id: str = Field(default_factory=lambda: uuid4().hex[:12])
    source_file: str
    source_type: SourceType
    page: Optional[int] = None
    sheet: Optional[str] = None
    row: Optional[int] = None
    content: str
    image_path: Optional[str] = None

    def ref(self) -> str:
        """Return a human-readable source citation."""
        if self.source_type == SourceType.PDF and self.page:
            return f"{self.source_file} (page {self.page})"
        if self.source_type == SourceType.XLSX and self.sheet and self.row:
            return f"{self.source_file} ({self.sheet}, row {self.row})"
        return self.source_file


class Fact(BaseModel):
    """A structured claim supported by one or more source elements."""

    id: str = Field(default_factory=lambda: uuid4().hex[:12])
    name: str
    value: str
    sources: list[str] = Field(default_factory=list)
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    reasoning: Optional[str] = None
    category: Optional[str] = None


class FactExtractionResult(BaseModel):
    """Validated LLM response for fact extraction."""

    facts: list[Fact] = Field(default_factory=list)


class Conflict(BaseModel):
    """Facts sharing a name but disagreeing on their values."""

    name: str
    facts: list[Fact]
    severity: Severity = Severity.WARNING
    note: Optional[str] = None


class Gap(BaseModel):
    """A required brief field not covered by extracted facts."""

    field: str
    description: str
    category: str
    severity: Severity = Severity.INFO


class AnalysisResult(BaseModel):
    conflicts: list[Conflict] = Field(default_factory=list)
    gaps: list[Gap] = Field(default_factory=list)


class BriefSection(BaseModel):
    """A prose section of the final brief with fact provenance."""

    title: str
    content: str
    fact_ids: list[str] = Field(default_factory=list)
    confidence: Confidence = Confidence.MEDIUM
    confidence_reason: Optional[str] = None
    # NEW: Formal uncertainty scoring — review axis
    needs_human_review: bool = False
    review_reason: Optional[str] = None


class Brief(BaseModel):
    id: str = Field(default_factory=lambda: uuid4().hex[:12])
    title: str
    sections: list[BriefSection]
    uncertainty: list[str] = Field(default_factory=list)
    open_questions: list[str] = Field(default_factory=list)
    # NEW: Agentic self-critique findings
    critique: list[dict] = Field(default_factory=list)
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    source_elements: list[SourceElement] = Field(default_factory=list)
    facts: list[Fact] = Field(default_factory=list)
    conflicts: list[Conflict] = Field(default_factory=list)
    gaps: list[Gap] = Field(default_factory=list)


class ExtractRequest(BaseModel):
    elements: list[SourceElement]


class ExtractResponse(BaseModel):
    facts: list[Fact]
    warnings: list[str] = Field(default_factory=list)


class AnalyzeRequest(BaseModel):
    facts: list[Fact]


class BriefRequest(BaseModel):
    facts: list[Fact]
    conflicts: list[Conflict] = Field(default_factory=list)
    gaps: list[Gap] = Field(default_factory=list)
    source_elements: list[SourceElement] = Field(default_factory=list)


class IngestResponse(BaseModel):
    elements: list[SourceElement]
    warnings: list[str] = Field(default_factory=list)