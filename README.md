# Brief AI — Agentic Packaging Design Brief Generator

> Turn messy packaging inputs into a cited, self-correcting design brief.

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TanStack](https://img.shields.io/badge/TanStack-Start-FF4154?logo=reactrouter&logoColor=white)](https://tanstack.com/start)
[![Tailwind](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Groq](https://img.shields.io/badge/Groq-Llama_3.3_70B-F55036)](https://groq.com)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## The Problem

Brand managers have scattered, messy inputs — old packaging PDFs, Excel content sheets, brand guideline documents. They need to synthesize this into a single, clear brief for a design agency. Today, this is manual, error-prone, and slow.

**Brief AI** solves this with an agentic pipeline that ingests raw files, extracts facts, detects conflicts and gaps, and generates a **self-correcting** design brief where every claim is traceable to a source.

## Architecture

```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│  Ingest     │───│ Extract     │───│ Analyze     │
│ (FastAPI)   │   │ (Groq LLM)  │   │ (Deterministic)│
└─────────────┘   └─────────────┘   └─────────────┘
        │                                        │
        ▼                                        │
┌─────────────┐◀────┐       ┌─────────────┐      │
│  Frontend   │     │       │ Generate    │      │
│ (TanStack)  │     │       │ (Groq LLM)  │      │
└─────────────┘     │       └─────────────┘      │
        ▲            │           ▲               │
        │            │           │               │
        └────────────┴── Refine ◄─┘              │
             (Self-Critique)                     │
```

1. **Ingest:** Parses `.xlsx`, `.pdf`, `.docx` into atomic source elements (rows, pages, cells).
2. **Extract:** Llama 3.3 70B (Groq) pulls facts with source-level attribution.
3. **Analyze:** Deterministic rules detect **Gaps** (missing required fields) and **Conflicts** (contradictory facts across sources).
4. **Generate:** Llama 3.3 drafts a 6-section brief with confidence scoring.
5. **Self-Critique (Agentic Loop):** A second LLM pass acts as a strict fact-checker, flagging unsupported claims and triggering a **refinement pass** to remove hallucinations.
6. **Frontend:** React + Tailwind with an interactive Evidence panel, confidence badges, and a floating AI assistant ("Jessy") showing real-time pipeline status.

## Key Features

| Feature | How it works |
|---------|--------------|
| **Agentic Self-Correction** | Draft → Critique → Refine loop. The AI checks its own output against source facts before finalizing. |
| **Formal Uncertainty Scoring** | Each section scored on **Confidence** (how sure the AI is) AND **Reviewability** (whether a human must check — legal/regulatory content gets a "Needs review" badge). |
| **Evidence Traceability** | Every citation chip links to the exact source file, row, and page. Click to open the Evidence panel. |
| **Gap Detection** | Deterministic rules flag missing required fields (e.g., "Target retail price not found"). |
| **Conflict Detection** | Compares facts across sources and surfaces contradictions (e.g., "Recycled Kraft vs Bleached White"). |
| **Real-time Ticker** | The "Jessy" panel shows pipeline stages: Uploading → Extracting → Analyzing → Drafting. |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Python 3.11, FastAPI, Pydantic |
| LLM | Groq (Llama 3.3 70B) |
| Frontend | React 19, TanStack Start, Tailwind CSS 4, Shadcn UI |
| Validation | Pydantic coercion (handles LLM output variance) |
| Deployment | Render (backend), Vercel (frontend) |

## Quick Start

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
echo "GROQ_API_KEY=your_key_here" > .env
python -m uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
echo "VITE_API_URL=http://127.0.0.1:8000" > .env.local
npm run dev
```

Open http://localhost:8080, click **Use sample sources**, then **Generate brief**. Wait ~2 minutes (Groq API latency). Watch the Jessy ticker for progress.

## Live Demo

- Frontend: your-vercel-url.vercel.app
- Backend API: esko-brief-api.onrender.com/docs

Note: Render free tier spins down after 15 min of inactivity. First request may take ~30s to cold-start.

## Sample Output

The system generates a brief with:

- 6 sections (Product Overview, Packaging Requirements, Mandatory Content, Claims & Certifications, Design Direction, Open Questions)
- Confidence badges (94% for high-confidence sections)
- "Needs review" badges for legal/regulatory content
- Interactive citations linking to source files
- AI self-check findings surfaced in the Uncertainty panel

## Limitations & Design Decisions

- **No RAG:** Sources are small (<100 facts), so embedding + retrieval would add latency without improving accuracy. Full fact context in the prompt works better at this scale.
- **No fine-tuning:** Groq's free tier doesn't support it, and the prompt engineering + self-critique loop achieves the same goal (fact-checking) without labeled data.
- **~2-minute latency:** The pipeline makes ~50 sequential LLM calls. The Jessy ticker keeps users informed.

## License

MIT — Built for Esko AIForge Hackathon 2026.
