# RiskMind - Team Task Assignments

## Document Information
| Property | Value |
|----------|-------|
| **Project** | RiskMind Underwriting Co-Pilot |
| **Sprint** | Sprint 1 (2 Weeks) |
| **Date** | February 2026 |
| **Team** | Pranali, Anshul, Suraj, Chetan |

---

## Team Overview

| Member | Role | Focus Area |
|--------|------|------------|
| **Pranali** | Frontend Developer | UI pages, components, styling |
| **Anshul** | Backend Developer | APIs, database, business logic |
| **Suraj** | AI/ML Engineer | LLM integration, RAG, AI features |
| **Chetan** | Data & QA Engineer | Seed data, testing, documentation |

---

## PRANALI — Frontend & UI

### Task 1: Smart Alerts Dashboard Page
**Priority:** HIGH | **Deadline:** End of Week 1

**Description:** Create a new page `/alerts` that displays risk alerts for underwriters.

**Acceptance Criteria:**
- [ ] New file `frontend/src/pages/Alerts.tsx`
- [ ] Page shows a list of alert cards with:
  - Alert type icon (⚠️ High Risk, 📈 Trend, 🔄 Renewal, 🚩 Guideline)
  - Policy number and policyholder name
  - Alert description text
  - Severity badge (Critical, Warning, Info)
  - Timestamp
- [ ] Alerts filterable by type (All, High Risk, Renewal, Trend)
- [ ] Alerts sortable by date and severity
- [ ] Add "Alerts" link to navigation in `Layout.tsx`
- [ ] Styling matches existing light theme in `index.css`
- [ ] Mock data used initially (hardcoded array of 8-10 alerts)

**Reference:** Look at `Dashboard.tsx` and `Guidelines.tsx` for patterns.

**Files to Create/Modify:**
- `frontend/src/pages/Alerts.tsx` (NEW)
- `frontend/src/components/Layout.tsx` (add nav link)
- `frontend/src/App.tsx` (add route)
- `frontend/src/index.css` (add alert-specific styles if needed)

---

### Task 2: Underwriter Workbench Page
**Priority:** MEDIUM | **Deadline:** End of Week 2

**Description:** Create a portfolio view page showing an underwriter's assigned policies.

**Acceptance Criteria:**
- [ ] New file `frontend/src/pages/Workbench.tsx`
- [ ] Top section: 4 stat cards (Total Policies, Pending Reviews, Avg Loss Ratio, Renewals This Month)
- [ ] Main section: Table of assigned policies with columns:
  - Policy Number (clickable → goes to /analyze?policy=XXX)
  - Policyholder Name
  - Policy Type
  - Premium Amount
  - Loss Ratio
  - Renewal Date
  - Risk Status (badge: Low/Medium/High)
- [ ] Search/filter by policy number or name
- [ ] Add "My Book" link to navigation
- [ ] Responsive layout

**Files to Create/Modify:**
- `frontend/src/pages/Workbench.tsx` (NEW)
- `frontend/src/components/Layout.tsx` (add nav link)
- `frontend/src/App.tsx` (add route)

---

### Task 3: Dashboard Enhancements
**Priority:** LOW | **Deadline:** End of Week 2

**Description:** Improve the existing Dashboard page.

**Acceptance Criteria:**
- [ ] Add a "Recent Activity" timeline section below stats
- [ ] Add hover effects on stat cards (slight lift/shadow)
- [ ] Add a "View All" link on the claims table that navigates to analysis
- [ ] Improve table row click interaction (highlight + pointer cursor)

---

## ANSHUL — Backend & API

### Task 1: Alerts API
**Priority:** HIGH | **Deadline:** End of Week 1

**Description:** Build API endpoint that returns risk alerts based on policy/claims data.

**Acceptance Criteria:**
- [ ] New file `backend/routers/alerts.py`
- [ ] `GET /api/alerts` endpoint returns list of alerts
- [ ] Alert generation logic checks for:
  - High claim frequency (5+ claims) → "High Frequency Alert"
  - High severity claim ($100K+) → "Severity Alert"
  - High loss ratio (>65%) → "Loss Ratio Alert"
  - Upcoming renewals (within 30 days) → "Renewal Alert"
- [ ] Each alert returns:
  ```json
  {
    "id": 1,
    "type": "high_frequency",
    "severity": "critical",
    "policy_number": "COMM-2024-002",
    "policyholder": "XYZ Restaurant Group",
    "message": "5 claims filed in review period",
    "guideline_ref": "Section 3.1.1",
    "created_at": "2026-02-09T12:00:00"
  }
  ```
- [ ] Filterable by `?type=high_frequency` and `?severity=critical`
- [ ] Register router in `main.py`
- [ ] Add Pydantic schema in `models/schemas.py`

**Reference:** Follow same pattern as `routers/analysis.py` and `routers/guidelines.py`.

**Files to Create/Modify:**
- `backend/routers/alerts.py` (NEW)
- `backend/models/schemas.py` (add Alert schema)
- `backend/main.py` (register router)

---

### Task 2: Underwriting Memo API
**Priority:** MEDIUM | **Deadline:** End of Week 2

**Description:** Build endpoint that generates a structured underwriting memo for a policy.

**Acceptance Criteria:**
- [ ] `GET /api/memo/{policy_number}` endpoint
- [ ] Response includes:
  ```json
  {
    "policy_number": "COMM-2024-001",
    "policyholder": "ABC Manufacturing",
    "memo_date": "2026-02-09",
    "summary": {
      "total_claims": 2,
      "total_amount": 23500,
      "loss_ratio": 0.47,
      "risk_level": "low"
    },
    "recommendation": "RENEW - Standard terms",
    "pricing_action": "No rate change needed",
    "guideline_references": ["Section 3.1.1", "Section 5.1.1"],
    "memo_text": "Full formatted memo text..."
  }
  ```
- [ ] Memo text follows standard underwriting memo format
- [ ] Uses existing claims and policy data from database

**Files to Create/Modify:**
- `backend/routers/memo.py` (NEW)
- `backend/models/schemas.py` (add Memo schema)
- `backend/main.py` (register router)

---

### Task 3: Industry Benchmarks API
**Priority:** LOW | **Deadline:** End of Week 2

**Description:** Add industry average data and comparison endpoint.

**Acceptance Criteria:**
- [ ] New database table `industry_benchmarks` with columns: industry, avg_loss_ratio, avg_claim_frequency, avg_claim_size
- [ ] `GET /api/benchmarks/{industry}` returns benchmarks
- [ ] `GET /api/analysis/{policy_number}` enhanced with benchmark comparison
- [ ] Add benchmark seed data in `seed_data.py`

---

## SURAJ — AI/LLM Integration

### Task 1: Connect Chat to Real LLM
**Priority:** HIGH | **Deadline:** End of Week 1

**Description:** Replace mock chat responses in `Chat.tsx` with actual AI responses via backend API.

**Acceptance Criteria:**
- [ ] New file `backend/routers/chat.py`
- [ ] `POST /api/chat` endpoint that accepts:
  ```json
  {
    "message": "What policies have high loss ratios?",
    "conversation_history": []
  }
  ```
- [ ] Backend calls OpenAI API (GPT-4o-mini) with system prompt about RiskMind
- [ ] System prompt includes context about available data and underwriting domain
- [ ] Response streams or returns AI-generated answer
- [ ] Update `Chat.tsx` to call `/api/chat` instead of using mock responses
- [ ] Handle errors gracefully (API key missing, rate limits)
- [ ] Environment variable `OPENAI_API_KEY` controls the feature
- [ ] Fallback to mock responses if no API key is configured

**Reference:** Check `services/ai_service.py` for existing AI provider pattern.

**Files to Create/Modify:**
- `backend/routers/chat.py` (NEW)
- `backend/main.py` (register router)
- `frontend/src/pages/Chat.tsx` (update to call API)
- `frontend/src/services/api.ts` (add chat API method)

---

### Task 2: RAG Pipeline (Guidelines Search)
**Priority:** HIGH | **Deadline:** End of Week 2

**Description:** Implement Retrieval-Augmented Generation so the AI can search guidelines contextually.

**Acceptance Criteria:**
- [ ] Create embeddings for all guidelines using OpenAI embeddings API
- [ ] Store embeddings (locally using chromadb or in-memory for POC)
- [ ] When user asks a question in chat:
  1. Convert question to embedding
  2. Search for relevant guidelines (top 3)
  3. Include relevant guidelines as context in LLM prompt
  4. LLM answers using the guidelines as source
- [ ] Response includes citation of which guideline section was used
- [ ] New file `backend/services/rag_service.py`

**Files to Create/Modify:**
- `backend/services/rag_service.py` (NEW)
- `backend/routers/chat.py` (integrate RAG)
- `backend/requirements.txt` (add chromadb, tiktoken)

---

### Task 3: Auto-Memo with LLM
**Priority:** MEDIUM | **Deadline:** End of Week 2

**Description:** Enhance Anshul's memo endpoint to use LLM for generating the narrative text.

**Acceptance Criteria:**
- [ ] After Anshul builds the memo API structure, add LLM call to generate `memo_text`
- [ ] LLM receives: policy data, claims summary, guidelines, benchmarks
- [ ] LLM outputs a professional underwriting memo narrative
- [ ] Fallback to template-based memo if LLM is unavailable

---

## CHETAN — Data, Testing & Documentation

### Task 1: Expand Seed Data
**Priority:** HIGH | **Deadline:** End of Week 1

**Description:** Add realistic insurance data to make the product demo-ready.

**Acceptance Criteria:**
- [ ] Update `backend/seed_data.py` with:
  - 20 policies (currently 3) across different industries:
    - Manufacturing, Restaurant, Construction, Retail, Healthcare, Transportation, Technology, Real Estate
  - 50+ claims across those policies with realistic amounts
  - 15+ guidelines covering all categories (eligibility, pricing, frequency, severity, coverage)
  - Varied risk levels: 6 low, 8 medium, 4 high, 2 refer
- [ ] Each policy has realistic data:
  - Policy numbers: COMM-2024-001 through COMM-2024-020
  - Realistic company names
  - Realistic claim amounts ($500 to $500,000)
  - Dates spread across 2023-2024
- [ ] Run `python seed_data.py` successfully with no errors
- [ ] Dashboard shows updated stats

**Files to Modify:**
- `backend/seed_data.py`

---

### Task 2: API Testing
**Priority:** MEDIUM | **Deadline:** End of Week 2

**Description:** Write pytest tests for all API endpoints.

**Acceptance Criteria:**
- [ ] New directory `backend/tests/`
- [ ] `backend/tests/test_health.py` — Test `/health` endpoint
- [ ] `backend/tests/test_analysis.py` — Test `/api/analysis/{policy}` endpoint
  - Test valid policy returns 200 with expected fields
  - Test invalid policy returns 404
- [ ] `backend/tests/test_guidelines.py` — Test `/api/guidelines` endpoint
  - Test returns list of guidelines
  - Test empty search returns results
- [ ] `backend/tests/test_alerts.py` — Test `/api/alerts` (after Anshul builds it)
- [ ] All tests pass with `pytest backend/tests/ -v`
- [ ] Add `pytest` and `pytest-asyncio` to `requirements.txt`

**Files to Create:**
- `backend/tests/__init__.py` (NEW)
- `backend/tests/test_health.py` (NEW)
- `backend/tests/test_analysis.py` (NEW)
- `backend/tests/test_guidelines.py` (NEW)
- `backend/tests/test_alerts.py` (NEW)

---

### Task 3: Update Documentation
**Priority:** LOW | **Deadline:** End of Week 2

**Description:** Keep project documentation current.

**Acceptance Criteria:**
- [ ] Update `README.md` with new features (Alerts, Chat, Login, Workbench)
- [ ] Add API documentation in `docs/API-Reference.md` listing all endpoints
- [ ] Update `docs/01-technical-onboarding.md` with any new setup steps
- [ ] Ensure all docs reflect current state of the project

---

## Dependencies Between Tasks

```
Week 1:
  Chetan (Seed Data) ──→ Feeds into all other work
  Anshul (Alerts API) ──→ Pranali (Alerts Page) uses this API
  Suraj (Chat LLM) ──→ Independent

Week 2:
  Anshul (Memo API) ──→ Suraj (LLM Memo) enhances it
  Pranali (Workbench) ──→ Independent
  Chetan (Tests) ──→ Tests Anshul's APIs
```

---

## Daily Standup Questions
Each member should answer daily:
1. What did I complete yesterday?
2. What am I working on today?
3. Am I blocked on anything?

---

## Backup Plan (If Tasks Are Not Completed)

| Task | Risk Level | If Incomplete, We Will... |
|------|-----------|--------------------------|
| Seed Data (Chetan) | LOW | Complete in 30 mins |
| Alerts API (Anshul) | LOW | Build in 1-2 hours |
| Alerts Page (Pranali) | LOW | Build in 1-2 hours |
| Chat LLM (Suraj) | MEDIUM | Connect in 2-3 hours |
| RAG Pipeline (Suraj) | HIGH | Build together, may simplify |
| Tests (Chetan) | LOW | Write basic tests in 1 hour |

---

*Document Version: 1.0 | Last Updated: February 2026*
