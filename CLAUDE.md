# RiskMind — AI Underwriting Co-Pilot

## What This Project Is
AI-powered underwriting assistant for commercial insurance. Uses a "Glass Box" approach: transparent AI reasoning backed by internal claims data + underwriting guidelines.

## Tech Stack
- **Backend:** FastAPI + SQLite + ChromaDB (RAG) — runs on http://localhost:8000
- **Frontend:** React 19 + TypeScript + TailwindCSS + Recharts + Vite — runs on http://localhost:5174
- **AI:** Gemini 2.0 Flash (primary, FREE tier), OpenAI GPT-4o-mini (fallback)
- **Shell:** Windows — use `bash` syntax, not PowerShell

## How to Run
```bash
# Backend (from /backend)
uvicorn main:app --reload --port 8000

# Frontend (from /frontend)
npm run dev
```

## Database Schema (SQLite)
```
policies  : id, policy_number, policyholder_name, industry_type, premium,
            effective_date, expiration_date, latitude, longitude, created_at
claims    : id, claim_number, policy_id, claim_date, claim_amount, claim_type,
            status, description, evidence_files, created_at
decisions : id, policy_number, decision (accept/refer/decline), reason,
            risk_level, decided_by, created_at
guidelines: id, section_code, title, content, category, policy_number,
            threshold_type, threshold_value, action
users     : id, email, full_name, role, is_active, created_at, last_login
documents : id, filename, file_path, file_type, file_size, uploaded_by,
            analysis_summary, created_at
```

**Risk Level** (computed, not stored on policies):
- HIGH: 5+ claims OR total_claims >= $100,000
- MEDIUM: 2-4 claims OR $50k–$100k
- LOW: 0-1 claims AND < $50k

**Loss Ratio** = (SUM(claim_amount) / premium) * 100

**Decision rules:** loss_ratio > 80% → decline | 60–80% → refer | < 60% → accept

## Key File Locations
| File | Purpose |
|---|---|
| `backend/services/intent_engine.py` | Intent routing, SQL generation, 4-tier strategy |
| `backend/services/query_library.py` | 100 pre-built golden SQL queries (Tier 1) |
| `backend/routers/chat.py` | Main chat API endpoint |
| `backend/routers/dashboard.py` | Dashboard data API |
| `backend/services/vector_store.py` | ChromaDB RAG for guidelines |
| `backend/services/join_context.py` | Allowed JOIN paths between tables |
| `frontend/src/pages/RiskMind.tsx` | Main intelligence canvas UI |
| `frontend/src/index.css` | All CSS including markdown styles |

## Intent Routing Architecture
3-layer system:
1. **Specific Intent** (what): `policy_risk_summary`, `claim_summary`, `portfolio_summary`, `ad_hoc_query`, `geo_risk`
2. **Canonical Intent** (goal): `Understand`, `Analyze`, `Decide`, `Document`
3. **Output Type** (UI): `analysis`, `dashboard`, `memo`, `decision`, `card`

### Tiered SQL Strategy (ZERO LLM cost for ~80% of queries)
```
Tier 0  — Deterministic patterns   → _try_dashboard_query_pattern() / _try_simple_query_pattern()
Tier 1  — Query Library (100 SQL)  → backend/services/query_library.py → match_query()
Tier 2  — LRU SQL Cache            → _sql_cache dict, max 100 entries
Tier 3  — LLM SQL Generation       → Gemini 2.0 Flash (novel queries only, result cached)
Tier 4  — LLM Reasoning            → Pure language response (always for explanations)
```

### Dashboard Widget Keywords (always trigger Analyze intent + dashboard output):
`chart`, `dashboard`, `plot`, `graph`, `visualization`, `widget`, `trend`, `compare`, `breakdown`, `analyze`, ` by `

### Confidence Scoring:
- Base 72 | +6 metrics | +6 evidence | -6 ad_hoc | -14 short prompt | -8 no entity | +4 keyword
- < 50 → clarification needed (show clickable intent chips)
- 50–59 → low confidence (show suggested prompts)
- ≥ 60 → execute intent directly

## Query Library Categories (query_library.py)
| Category | IDs | Count |
|---|---|---|
| Portfolio Overview | PF-001 to PF-010 | 10 |
| Claims Analysis | CL-001 to CL-020 | 20 |
| Risk Analysis | RK-001 to RK-015 | 15 |
| Industry Analysis | IN-001 to IN-010 | 10 |
| Financial Analysis | FI-001 to FI-010 | 10 |
| Decisions Analysis | DE-001 to DE-010 | 10 |
| Geographic Risk | GE-001 to GE-005 | 5 |
| Time Trends | TR-001 to TR-010 | 10 |
| Entity Lookups | EN-001 to EN-010 | 10 |

## Common Patterns

### Adding a new feature to the chat pipeline:
1. Check `intent_engine.py` → `_route_intent()` for intent detection
2. Check `query_library.py` for an existing golden query, add one if missing
3. Update `chat.py` for response construction
4. Update `RiskMind.tsx` for frontend rendering

### Adding a new golden query:
Edit `backend/services/query_library.py`, add entry to `QUERY_LIBRARY` dict:
```python
"XX-NNN": {
    "id": "XX-NNN",
    "description": "What it returns",
    "sql": "SELECT ...",
    "params": {},           # {} if no params, else {"param_name": "description"}
    "category": "Category Name",
    "triggers": ["phrase that matches", "another trigger"],
    "chart_type": "bar|line|pie|table|metric|map|card",
    "is_aggregate": True,   # True = single summary row, False = multiple rows
}
```

### Frontend canvas rendering flow:
1. Chat API returns `output_type` + `analysis_object`
2. `RiskMind.tsx` checks `output_type` → renders Summary card / Focus Insight / Dashboard
3. For dashboard: fetches `/api/dashboard/data` → builds `dashboardCache` → calls `addWidgetDirect()`
4. Focus Insight uses `<ReactMarkdown remarkPlugins={[remarkGfm]}>` for markdown

## Known Issues / Watch Out For
- `policies` table has NO `risk_level` column — always compute it via CASE/HAVING
- `decisions.risk_level` IS stored (set when underwriter makes a decision)
- Windows console is cp1252 — avoid emoji in `print()` statements in backend Python files
- SQLite date functions: use `strftime()`, `date('now')`, `julianday()`
- Gemini free tier: 15 RPM limit — intent_engine has exponential backoff + retry logic
- `evidence_files` is a JSON string column, not a real array — check `!= '[]'` not `IS NOT NULL` alone

## LLM Usage Philosophy
- LLM should ONLY do what ONLY LLM can do: reasoning, explanation, decision support
- SQL for known query patterns → query library (free, instant)
- SQL for novel queries → LLM generates once, cached forever after
- Never use LLM to generate SQL that could be a golden query
