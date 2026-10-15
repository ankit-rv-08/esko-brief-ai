# esko-brief-ai
AI-powered assistant that turns messy packaging inputs into structured design briefs. Built for Esko AIForge Hackathon 2026.

## Project layout

- `frontend/` - Next.js App Router application
- `backend/` - Python service dependencies and source package
- `data/samples/` - local sample inputs (ignored by Git)

## Local setup

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend reads the backend URL from `frontend/.env.local`.

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Set `GROQ_API_KEY` in `backend/.env` before starting the API service.
