# Brief AI — Agentic Packaging Design Brief Generator

> Turn messy packaging inputs into a cited, self-correcting design brief.

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![Gemini](https://img.shields.io/badge/Gemini_3.8_Flash-4285F4?logo=google&logoColor=white)](https://ai.google.dev)

## The Problem

Brand managers have scattered, messy inputs — old packaging PDFs, Excel content sheets, brand guideline documents. They need to synthesize this into a single, clear brief for a design agency. Today, this is manual, error-prone, and slow.

**Brief AI** solves this with an agentic pipeline that ingests raw files, extracts facts, asks smart follow-up questions for missing data, and generates a **self-correcting** design brief where every claim is traceable to a source.

## Key Features

| Feature | How it works |
|---------|--------------|
| **Agentic Self-Correction** | Draft → Critique → Refine loop. The AI checks its own output against source facts and **flags and removes unsupported claims**. |
| **Interactive Follow-ups** | If the AI detects missing data, it generates context-aware questions. User answers are converted into traceable facts. Skips questions the facts already answer. |
| **Human-in-the-Loop Review** | Users can inline-edit any section (marked with an "Edited by you" badge), with a "Needs Review" gate that requires human acknowledgment before finalizing. |
| **Evidence Traceability** | Every citation chip links to the exact source file, row, and page. |
| **Formal Uncertainty Scoring** | Each section is scored on Confidence and Reviewability. |

## Architecture

1. **Ingest:** Parses `.xlsx`, `.pdf`, `.docx` into atomic source elements.
2. **Extract:** `gemini-3.8-flash` pulls facts with source-level attribution.
3. **Analyze:** Deterministic rules detect Gaps and Conflicts.
4. **Follow-up:** Zero-LLM engine converts gaps into questions.
5. **Generate & Critique:** Gemini drafts the brief, followed by a strict fact-checker pass.
6. **Review:** React UI allows inline editing and human sign-off.

## Quick Start

### Backend
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
echo "GEMINI_API_KEY=your_key" > .env
echo "GEMINI_MODEL=gemini-3.8-flash" >> .env
python -m uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
echo "VITE_API_URL=http://127.0.0.1:8000" > .env.local
npm run dev
```

## Live Demo & Video

- **Live Demo:** https://esko-brief-ai-m9fc.vercel.app
- **Demo Video:** https://youtu.be/y4wWjKvDw0U

## Limitations

- The live demo runs on a rate-limited free API tier (~20 requests/day).
- The "Use sample sources" button uses local LLM response caching for a fast, reliable experience.
- Uploading custom files runs the live pipeline and may hit rate limits
