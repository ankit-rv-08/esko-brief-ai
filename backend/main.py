"""FastAPI application exposing the Esko Brief AI pipeline."""
from __future__ import annotations

import logging
import os
import tempfile
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from src.brief import generate_brief
from src.conflicts import analyze
from src.facts import extract_facts
from src.ingest import ingest_directory
from src.llm import GroqClient, LLMError
from src.models import AnalyzeRequest, Brief, BriefRequest, ExtractRequest, ExtractResponse, IngestResponse

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


def _get_client() -> GroqClient:
    key = os.environ.get("GROQ_API_KEY")
    if not key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not configured")
    return GroqClient(api_key=key)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "esko-brief-ai"}


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