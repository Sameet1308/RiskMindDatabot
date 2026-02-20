# Anshul - Backend & API Tasks

## Your Role
Backend Developer — Build new API endpoints and business logic.

## Setup
Make sure you can run the backend:
```powershell
cd backend
.\venv\Scripts\activate
pip install -r requirements.txt
python seed_data.py
uvicorn main:app --reload
```
API runs at http://localhost:8000
API docs at http://localhost:8000/docs

---

## Task 1: Alerts API ⭐ HIGH PRIORITY
**Deadline:** End of Week 1

### What to Build
API endpoint that scans policies/claims and generates risk alerts.

### Steps

**Step 1:** Add Alert schema in `backend/models/schemas.py`
```python
class AlertResponse(BaseModel):
    id: int
    type: str          # high_frequency, severity, loss_ratio, renewal
    severity: str      # critical, warning, info
    policy_number: str
    policyholder: str
    message: str
    guideline_ref: str | None = None
    created_at: str
```

**Step 2:** Create `backend/routers/alerts.py`
```python
from fastapi import APIRouter
router = APIRouter(prefix="/api", tags=["alerts"])

@router.get("/alerts")
async def get_alerts(type: str = None, severity: str = None):
    # Query all policies and claims from DB
    # Check each policy against rules:
    # Rule 1: claim_count >= 5 → high_frequency alert (critical)
    # Rule 2: max_claim >= 100000 → severity alert (critical)
    # Rule 3: loss_ratio > 0.65 → loss_ratio alert (warning)
    # Rule 4: renewal within 30 days → renewal alert (info)
    # Return filtered list
    pass
```

**Step 3:** Register in `backend/main.py`
```python
from routers.alerts import router as alerts_router
app.include_router(alerts_router)
```

### Alert Rules
| Condition | Alert Type | Severity | Message Template |
|-----------|-----------|----------|-----------------|
| 5+ claims | high_frequency | critical | "{count} claims filed - exceeds threshold" |
| Claim ≥ $100K | severity | critical | "${amount} claim exceeds $100K limit" |
| Loss ratio > 65% | loss_ratio | warning | "Loss ratio at {ratio}% - above 65% threshold" |
| Renewal ≤ 30 days | renewal | info | "Policy renews in {days} days" |

### Test It
```bash
curl http://localhost:8000/api/alerts
curl http://localhost:8000/api/alerts?type=high_frequency
curl http://localhost:8000/api/alerts?severity=critical
```

### Done When
- [ ] `GET /api/alerts` returns list of alerts
- [ ] Filters by type and severity work
- [ ] Shows in Swagger docs at /docs
- [ ] Pranali can use this API for her Alerts page

---

## Task 2: Underwriting Memo API
**Deadline:** End of Week 2

### What to Build
API endpoint that generates a structured underwriting memo for a policy.

### Steps
1. Create `backend/routers/memo.py`
2. Add MemoResponse schema
3. Register router

### Endpoint
```
GET /api/memo/COMM-2024-001
```

### Response Format
```json
{
  "policy_number": "COMM-2024-001",
  "policyholder": "ABC Manufacturing",
  "memo_date": "2026-02-09",
  "summary": {
    "total_claims": 2,
    "total_amount": 23500,
    "loss_ratio": 0.47,
    "avg_claim": 11750,
    "max_claim": 15000,
    "risk_level": "low"
  },
  "recommendation": "RENEW - Standard terms",
  "pricing_action": "No rate change needed",
  "reasons": [
    "Loss ratio of 47% is below industry average of 55%",
    "Claim frequency of 2 is within acceptable range"
  ],
  "guideline_references": [
    {"section": "3.1.1", "text": "Frequency threshold: 5+ claims"},
    {"section": "5.1.1", "text": "Loss ratio pricing adjustment"}
  ],
  "memo_text": "UNDERWRITING MEMORANDUM\n\nPolicy: COMM-2024-001..."
}
```

### Memo Text Template
```
UNDERWRITING MEMORANDUM
========================
Date: {date}
Policy: {policy_number}
Insured: {policyholder}

CLAIMS SUMMARY:
- Total Claims: {count}
- Total Amount: ${total}
- Loss Ratio: {ratio}%

RISK ASSESSMENT: {risk_level}

RECOMMENDATION: {recommendation}

RATIONALE:
{reasons}

GUIDELINE REFERENCES:
{guidelines}
```

### Done When
- [ ] `GET /api/memo/{policy}` returns structured memo
- [ ] Memo text is formatted and readable
- [ ] Invalid policy returns 404
- [ ] Suraj can later enhance memo_text with LLM

---

## Task 3: Industry Benchmarks API
**Deadline:** End of Week 2

### What to Build
Add industry benchmarks data and comparison endpoint.

### Steps
1. Add `industry_benchmarks` table to database
2. Add seed data for benchmarks
3. Create benchmark endpoint

### Benchmark Data to Add
| Industry | Avg Loss Ratio | Avg Frequency | Avg Claim Size |
|----------|---------------|---------------|----------------|
| Manufacturing | 55% | 2.5/year | $18,000 |
| Restaurant | 60% | 3.2/year | $12,000 |
| Construction | 65% | 3.8/year | $25,000 |
| Retail | 50% | 2.0/year | $8,000 |
| Healthcare | 58% | 2.8/year | $15,000 |
| Transportation | 68% | 4.0/year | $22,000 |
| Technology | 35% | 1.2/year | $10,000 |
| Real Estate | 45% | 1.8/year | $20,000 |

### Done When
- [ ] Benchmark data exists in database
- [ ] `GET /api/benchmarks/manufacturing` returns data
- [ ] Can compare policy metrics vs industry averages

---

## Tips
- Follow patterns in existing `routers/analysis.py` and `routers/guidelines.py`
- Use async functions with SQLAlchemy as shown in existing code
- Test with Swagger docs at http://localhost:8000/docs
- Pranali needs your Alerts API to build her page
