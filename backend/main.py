"""FastAPI application exposing the Esko Brief AI pipeline."""
from __future__ import annotations

import json
import logging
import os
import tempfile
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from src.followups import questions_from_gaps
from src.brief import generate_brief
from src.conflicts import analyze
from src.facts import extract_facts
from src.ingest import ingest_directory
from src.llm import MultiProviderClient, LLMError
from src.models import AnalyzeRequest, Brief, BriefRequest, ExtractRequest, ExtractResponse, IngestResponse, Fact, Conflict, SourceElement

load_dotenv(Path(__file__).with_name(".env"))
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("esko.main")

app = FastAPI(title="Esko Brief AI", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _get_client() -> MultiProviderClient:
    gemini_key = os.environ.get("GEMINI_API_KEY")
    if not gemini_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")
    return MultiProviderClient()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "esko-brief-ai"}


@app.post("/voice/transcribe")
async def transcribe_voice(audio: UploadFile = File(...)) -> dict[str, str]:
    """Transcribe a browser-recorded audio clip with Groq Whisper."""
    key = os.environ.get("GROQ_API_KEY")
    if not key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not configured")
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Audio upload is empty")
    try:
        from groq import Groq

        result = Groq(api_key=key).audio.transcriptions.create(
            file=(audio.filename or "voice.webm", audio_bytes),
            model="whisper-large-v3-turbo",
            language="en",
            response_format="text",
        )
    except Exception as exc:
        logger.exception("Voice transcription failed")
        raise HTTPException(status_code=502, detail="Voice transcription failed") from exc
    return {"text": str(result).strip()}


@app.post("/ingest", response_model=IngestResponse)
async def ingest(files: list[UploadFile] = File(...)) -> IngestResponse:
    """Accept uploaded files and return their extracted source elements."""
    warnings: list[str] = []
    with tempfile.TemporaryDirectory() as temporary_directory:
        directory = Path(temporary_directory)
        for uploaded_file in files:
            filename = Path(uploaded_file.filename or "upload").name
            (directory / filename).write_bytes(await uploaded_file.read())
        elements = ingest_directory(directory)
    if not elements:
        warnings.append("No content could be extracted from the uploaded files.")
    return IngestResponse(elements=elements, warnings=warnings)


@app.post("/extract", response_model=ExtractResponse)
def extract(request: ExtractRequest) -> ExtractResponse:
    client = _get_client()
    try:
        return ExtractResponse(facts=extract_facts(request.elements, client))
    except LLMError as exc:
        raise HTTPException(status_code=502, detail=f"LLM failure: {exc}") from exc


@app.post("/analyze")
def analyze_facts(request: AnalyzeRequest) -> dict[str, object]:
    return analyze(request.facts).model_dump()


@app.post("/brief", response_model=Brief)
def brief(request: BriefRequest) -> Brief:
    client = _get_client()
    try:
        return generate_brief(
            facts=request.facts,
            conflicts=request.conflicts,
            gaps=request.gaps,
            source_elements=request.source_elements,
            client=client,
        )
    except LLMError as exc:
        raise HTTPException(status_code=502, detail=f"LLM failure: {exc}") from exc


@app.post("/pipeline")
async def pipeline(files: list[UploadFile] = File(...)) -> dict[str, object]:
    """Run ingest, extraction, analysis, and brief generation in one request."""
    client = _get_client()
    warnings: list[str] = []

    with tempfile.TemporaryDirectory() as temporary_directory:
        directory = Path(temporary_directory)
        for uploaded_file in files:
            filename = Path(uploaded_file.filename or "upload").name
            (directory / filename).write_bytes(await uploaded_file.read())
        try:
            elements = ingest_directory(directory)
        except Exception as exc:  # noqa: BLE001
            logger.exception("Pipeline ingest failed")
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    if not elements:
        raise HTTPException(status_code=400, detail="No content could be extracted from uploaded files")

    try:
        facts = extract_facts(elements, client)
    except LLMError as exc:
        raise HTTPException(status_code=502, detail=f"Fact extraction failed: {exc}") from exc

    analysis = analyze(facts)
    try:
        generated_brief = generate_brief(
            facts=facts,
            conflicts=analysis.conflicts,
            gaps=analysis.gaps,
            source_elements=elements,
            client=client,
        )
    except LLMError as exc:
        raise HTTPException(status_code=502, detail=f"Brief generation failed: {exc}") from exc

    return {
        "elements": [element.model_dump() for element in elements],
        "facts": [fact.model_dump() for fact in facts],
        "conflicts": [conflict.model_dump() for conflict in analysis.conflicts],
        "gaps": [gap.model_dump() for gap in analysis.gaps],
        "brief": generated_brief.model_dump(mode="json"),
        "warnings": warnings,
        # NEW: Agentic self-critique results for UI display
        "critique": generated_brief.critique,
        "questions": questions_from_gaps(analysis.gaps, [json.dumps(f.model_dump(mode="json")) for f in facts])
    }


class RegenerateRequest(BaseModel):
    facts: list[Fact]
    conflicts: list[Conflict] = []
    source_elements: list[SourceElement] = []


@app.post("/regenerate")
def regenerate_brief(req: RegenerateRequest):
    client = _get_client()
    try:
        new_brief = generate_brief(
            facts=req.facts,
            conflicts=req.conflicts,
            gaps=[],
            source_elements=req.source_elements,
            client=client
        )
    except LLMError as exc:
        raise HTTPException(status_code=502, detail=f"LLM failure: {exc}") from exc
    # Re-analyze gaps after regeneration
    analysis = analyze(req.facts)
    return {
        "brief": new_brief.model_dump(mode="json"),
        "questions": questions_from_gaps(analysis.gaps, [json.dumps(f.model_dump(mode="json")) for f in req.facts])
    }
