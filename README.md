# Brief AI — Agentic Packaging Design Brief Generator

> Turns messy packaging inputs into a cited, reviewable design brief. Built for the Esko AIForge Hackathon 2026 (problem: *From Product Idea to Design Brief*).

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![Gemini](https://img.shields.io/badge/Gemini-4285F4?logo=google&logoColor=white)](https://ai.google.dev)

**Demo video:** https://www.youtube.com/watch?v=y4wWjKvDw0U
**Live demo:** https://esko-brief-ai-m9fc.vercel.app (free tiers; if it hangs, please use the video)

![Brief AI screenshot](assets/screenshot-brief.png)

## The problem

A brand manager has an Excel content sheet, a packaging PDF and a few notes: scattered, partly incomplete, sometimes contradictory. They must turn this into one clear brief for a design agency. Done by hand, it is slow and error-prone.

## What it does

| The problem statement asks for | How Brief AI handles it |
|---|---|
| Read the files provided | Parses `.xlsx`, `.pdf` and `.docx` into source elements (rows, pages) |
| Ask smart follow-up questions | A rule-based gap check produces a question only for items the extracted facts do not already answer |
| Identify inconsistent or unclear information | Rules look for conflicting facts across sources; the model also lists uncertainties it could not resolve |
| Create a brief an agency can use | A sectioned brief with confidence scores, plus open questions for the agency |
| Show where information came from | Every sentence carries citation chips (file + row or page); an Evidence panel shows the source text |
| Let the user review and edit before finalizing | Inline editing, a per-section review gate, then Finalize |

## Architecture

![Architecture](assets/architecture.png)

1. **Ingest:** files become atomic source elements (rows, pages).
2. **Extract:** an LLM pulls facts, each with its source location.
3. **Rule checks (no LLM):** gaps and conflicts are detected deterministically.
4. **Follow-up questions (no LLM):** gaps are turned into questions, skipping anything the facts already cover.
5. **Draft:** an LLM writes the brief with a confidence score per section.
6. **Self-critique:** a second pass compares the draft with the extracted facts and lists discrepancies.
7. **Refine:** the draft is corrected against those findings.
8. **Human review:** evidence panel, inline edit, review gate, finalize.

## Handling uncertainty and wrong AI output

- Each section shows a **confidence score**; sections with open findings are marked **needs human review**.
- The **self-critique** findings are shown under *Uncertainty* instead of being hidden.
- Gaps and conflicts come from **rules**, not from the model, so they do not depend on the model's mood.
- Every sentence is **cited**, so a reviewer can open the source and check it.
- Finalize stays locked until flagged sections are acknowledged.
- **Known limit:** the model can still add content the sources do not support (for example, design suggestions in our sample output), and the self-check does not catch everything. That is why a person signs off.

## Models and technologies

| Role | Technology |
|---|---|
| Fact extraction, drafting, critique, refinement | Gemini (`gemini-3.8-flash`) |
| Fallback when quota is exhausted | Groq `openai/gpt-oss-120b` |
| Gap, conflict and follow-up logic | Plain Python rules (no model) |
| Backend | Python, FastAPI, Pydantic |
| Frontend | React, TanStack Start, Tailwind CSS |
| Hosting | Render (backend), Vercel (frontend) |

## Run locally

Backend:

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
echo "GEMINI_API_KEY=your_key" > .env
echo "GEMINI_MODEL=gemini-3.8-flash" >> .env
python -m uvicorn main:app --reload --port 8000
```

Optional fallback: add `GROQ_API_KEY` and `GROQ_MODEL=openai/gpt-oss-120b`, and set `LLM_PROVIDERS=gemini,groq`.

Frontend:

```bash
cd frontend
npm install
echo "VITE_API_URL=http://127.0.0.1:8000" > .env.local
npm run dev
```

Open http://localhost:8080, click **Use sample sources**, then **Generate brief**.

## Limitations

- **Free API tiers.** Daily and per-minute limits apply. Model responses are cached on disk, and [EDIT: keep only if you ship `sample_replay.py`] for the bundled sample files the backend replays a saved output of a real pipeline run. Your own uploads run the live pipeline and may hit rate limits.
- **Regenerate** (after answering a follow-up question) needs live model calls and can fail when quota is used up.
- **Text and tables only.** Packaging artwork images are not read yet.
- **Gap detection** checks a fixed list of required fields (pack size, legal name, allergens, market, claims). It does not yet cover price or print run, and "already answered" is a keyword match.
- Sample data should not include confidential files, since free API tiers may use inputs to improve models.

## Future work

- Read artwork images with a multimodal model.
- Regenerate only the affected section and keep user-edited sections locked.
- Export the finalized brief.

## License

MIT
