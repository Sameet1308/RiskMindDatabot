# RiskMind

> **Underwriting Co-Pilot** — An internal tool to help underwriters make faster, more consistent risk decisions using a "Glass Box" approach.

## 🎯 What is RiskMind?

RiskMind combines:
- **Internal claims data** (SQL/SQLite for MVP)
- **Underwriting guidelines** (PDF/text via RAG)

And presents evidence in a transparent **Glass Box UI** showing:
- SQL query executed
- Data returned
- Guideline citation

## 📚 Documentation

Start here:

| Document | Purpose |
|----------|---------|
| [01-Technical Onboarding](docs/01-technical-onboarding.md) | Dev setup, architecture, coding standards |
| [02-Git Workflow](docs/02-git-workflow.md) | Branching, PRs, commits, access control |
| [03-Insurance Domain Primer](docs/03-insurance-domain-primer.md) | Underwriting basics for developers |
| [04-Admin Setup Guide](docs/04-admin-setup-guide.md) | Gmail/GitHub org setup (admin only) |

## 🚀 Quick Start

For a full walkthrough, use:

- [docs/01-technical-onboarding.md](docs/01-technical-onboarding.md)

```bash
# Clone
git clone https://github.com/YOUR_ORG/riskmind.git
cd riskmind

# Backend
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

### Scripts (Windows)

```powershell
# Precheck environment
powershell -ExecutionPolicy Bypass -File scripts\precheck.ps1

# Run all services
powershell -ExecutionPolicy Bypass -File scripts\run-all.ps1

# Shortcut (same as run-all)
powershell -ExecutionPolicy Bypass -File run.ps1
```

- Backend: http://localhost:8000
- Frontend: http://localhost:5173
- API Docs: http://localhost:8000/docs

## 🏗️ Architecture

```
Frontend (React/Vite:5173) ←→ Backend (FastAPI:8000) ←→ SQLite + RAG Layer
```

## 📁 Structure

```
riskmind/
├── docs/           # Onboarding documentation
├── backend/        # FastAPI Python backend
├── frontend/       # React Vite frontend
└── README.md
```

---

**Built for Insurance Hackathon** 🏆
