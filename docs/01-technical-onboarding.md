# Document 1: Technical Onboarding & Local Dev Setup

## RiskMind - Underwriting Co-Pilot

> **Welcome to the team!** This document will help you set up your local development environment and understand the architecture of our hackathon project.

---

## 1. Architecture Overview

### System Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         RISKMIND ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌──────────────────────┐         ┌──────────────────────────────┐ │
│   │   FRONTEND (React)   │  HTTP   │      BACKEND (FastAPI)       │ │
│   │   Port: 5173         │◄───────►│      Port: 8000              │ │
│   │   Vite + Tailwind    │         │      Python 3.10+            │ │
│   └──────────────────────┘         └──────────────────────────────┘ │
│            │                                    │                    │
│            │                                    │                    │
│            ▼                                    ▼                    │
│   ┌──────────────────────┐         ┌──────────────────────────────┐ │
│   │   Glass Box UI       │         │   SQLite Database            │ │
│   │   - SQL Query View   │         │   (claims_data.db)           │ │
│   │   - Evidence Display │         │                              │ │
│   │   - Guideline Cite   │         │   AI/RAG Layer (Mock/LLM)    │ │
│   └──────────────────────┘         └──────────────────────────────┘ │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | React + Vite | Fast, modern UI framework |
| **Styling** | Tailwind CSS | Utility-first CSS framework |
| **Backend** | FastAPI (Python) | High-performance async API |
| **Database** | SQLite | Lightweight, file-based database for MVP |
| **AI Layer** | Mock logic (configurable) | Placeholder for enterprise LLM integration |

### Default Ports

| Service | Port | URL |
|---------|------|-----|
| Backend API | 8000 | http://localhost:8000 |
| Frontend Dev | 5173 | http://localhost:5173 |
| API Docs | 8000 | http://localhost:8000/docs |

---

## 2. Local Setup Steps

> **Important:** Both VS Code and Antigravity/Cloud IDE are allowed. Git is our interface—use whatever IDE you prefer!

### Option A: VS Code Setup

#### Step 1: Install VS Code
- [ ] Download from https://code.visualstudio.com/
- [ ] Install for your OS (Windows/Mac/Linux)

#### Step 2: Install Required Extensions
Open VS Code, go to Extensions (Ctrl+Shift+X), and install:

| Extension | Publisher | Purpose |
|-----------|-----------|---------|
| **Python** | Microsoft | Python language support |
| **Pylance** | Microsoft | Python IntelliSense |
| **ESLint** | Microsoft | JavaScript/React linting |
| **Prettier** | Prettier | Code formatting |
| **Tailwind CSS IntelliSense** | Tailwind Labs | Tailwind autocomplete |
| **GitLens** | GitKraken | Enhanced Git integration |

#### Step 3: Configure Python Interpreter
1. Open Command Palette (Ctrl+Shift+P)
2. Type "Python: Select Interpreter"
3. Choose the virtual environment we'll create later

---

### Option B: Google Antigravity / Cloud IDE Setup

#### For Local Antigravity:
- [ ] Ensure you have the Antigravity desktop app installed
- [ ] Open the project folder in Antigravity
- [ ] The AI assistant will help with code navigation and suggestions

#### For Browser-Based IDE:
- [ ] Access through your provided cloud workspace URL
- [ ] Ensure stable internet connection
- [ ] All Git operations work the same way

> **Note:** Both IDEs work seamlessly because **Git is our shared interface**. Commit, push, and pull normally regardless of which IDE you use.

---

## 3. Repo Setup & Running the App

### Step 1: Clone the Repository

```bash
# Clone the repo (replace with actual repo URL)
git clone https://github.com/YOUR_ORG/riskmind.git

# Navigate into the project
cd riskmind
```

### Step 2: Backend Setup (Python/FastAPI)

```bash
# Navigate to backend folder
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file from template
cp .env.example .env

# Start the backend server
uvicorn main:app --reload --port 8000
```

#### Verify Backend is Running
- [ ] Open http://localhost:8000/docs in your browser
- [ ] You should see the Swagger API documentation

### Step 3: Frontend Setup (React/Vite)

```bash
# Open a NEW terminal window
# Navigate to frontend folder
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

#### Verify Frontend is Running
- [ ] Open http://localhost:5173 in your browser
- [ ] You should see the RiskMind interface

### Quick Start Checklist

- [ ] Repository cloned successfully
- [ ] Backend virtual environment created and activated
- [ ] Backend dependencies installed
- [ ] Backend running on port 8000
- [ ] Frontend dependencies installed
- [ ] Frontend running on port 5173
- [ ] Both services can communicate (test an API call)

---

## 4. Coding Standards

### Folder Structure

```
riskmind/
├── backend/
│   ├── main.py              # FastAPI entry point
│   ├── requirements.txt     # Python dependencies
│   ├── .env.example         # Environment template
│   ├── routers/             # API route handlers
│   │   ├── claims.py
│   │   ├── underwriting.py
│   │   └── analysis.py
│   ├── services/            # Business logic
│   │   ├── claims_service.py
│   │   ├── rag_service.py
│   │   └── ai_service.py
│   ├── models/              # Pydantic models
│   │   └── schemas.py
│   └── database/            # DB connection & queries
│       ├── connection.py
│       └── claims_data.db
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   ├── components/      # Reusable UI components
│   │   │   ├── GlassBox.jsx
│   │   │   ├── ClaimsTable.jsx
│   │   │   └── GuidelineCard.jsx
│   │   ├── pages/           # Page components
│   │   └── services/        # API call functions
│   └── public/
└── docs/                    # Documentation
```

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| **Python files** | snake_case | `claims_service.py` |
| **Python functions** | snake_case | `get_claims_history()` |
| **Python classes** | PascalCase | `ClaimsResponse` |
| **React components** | PascalCase | `GlassBox.jsx` |
| **React functions** | camelCase | `fetchClaimsData()` |
| **CSS classes** | Tailwind utilities | `bg-blue-500 p-4` |
| **API endpoints** | kebab-case | `/api/claims-history` |
| **Environment vars** | UPPER_SNAKE | `DATABASE_URL` |

### API Response Consistency

All API responses should follow this structure:

```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully",
  "metadata": {
    "sql_query": "SELECT * FROM claims WHERE...",
    "source": "claims_data.db",
    "guideline_citation": "Section 3.2.1 - High Severity Claims"
  }
}
```

> **Glass Box Principle:** Always include `metadata` with the SQL query and guideline citation so the underwriter can verify the evidence.

### Linting & Formatting

#### Python (Backend)
```bash
# Install linters (included in requirements.txt)
pip install black flake8

# Format code
black .

# Check for issues
flake8 .
```

#### JavaScript/React (Frontend)
```bash
# Format code
npm run format

# Lint code
npm run lint
```

---

## 5. Testing & Demo Reliability Tips

### Deterministic Demo Flows

> **Goal:** The demo should work the same way every time. No surprises!

#### Pre-Demo Checklist
- [ ] Fresh database reset (`python reset_db.py`)
- [ ] All services running (backend + frontend)
- [ ] Test each demo scenario manually
- [ ] Clear browser cache if needed

#### Sample Demo Scenarios to Test

| Scenario | Expected Behavior |
|----------|------------------|
| Search policy "COMM-001" | Returns 3 claims, Glass Box shows SQL |
| High-severity alert | Shows "Refer to Manager" recommendation |
| Guideline citation | Displays relevant underwriting rule |

### Logging Guidelines

```python
# backend/services/claims_service.py
import logging

logger = logging.getLogger(__name__)

def get_claims(policy_id: str):
    logger.info(f"Fetching claims for policy: {policy_id}")
    # ... logic
    logger.debug(f"SQL query: {query}")
    logger.info(f"Found {len(results)} claims")
    return results
```

| Log Level | When to Use |
|-----------|-------------|
| `DEBUG` | Detailed diagnostic info (SQL queries, internal state) |
| `INFO` | Normal operations (requests, responses) |
| `WARNING` | Unexpected but handled situations |
| `ERROR` | Failures that need attention |

### Avoiding Demo Breakage

#### Do's ✅
- Test your changes locally before pushing
- Run the full demo flow after any change
- Use feature branches, never push directly to `main`
- Communicate with the team before changing shared files

#### Don'ts ❌
- Don't modify the demo database structure without team discussion
- Don't add dependencies without updating `requirements.txt` / `package.json`
- Don't hardcode URLs or ports (use environment variables)
- Don't commit half-finished features to `develop`

---

## Quick Reference Commands

```bash
# Backend
cd backend
source venv/bin/activate  # or venv\Scripts\activate on Windows
uvicorn main:app --reload --port 8000

# Frontend
cd frontend
npm run dev

# Git (daily workflow)
git pull origin develop
git checkout -b feature/your-name-feature-desc
# ... make changes ...
git add .
git commit -m "feat: add claims history endpoint"
git push origin feature/your-name-feature-desc
```

---

## Need Help?

1. **Check the docs folder** for additional documentation
2. **Search existing issues** on GitHub
3. **Ask in the team chat** (response within working hours)
4. **Tag your PR with questions** if code-related

> **Remember:** There are no stupid questions! We're here to learn and build together. 🚀
