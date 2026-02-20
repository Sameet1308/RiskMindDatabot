# Chetan - Data, Testing & Documentation Tasks

## Your Role
Data & QA Engineer — Expand the demo data, write tests, update documentation.

## Setup
```powershell
cd backend
.\venv\Scripts\activate
pip install -r requirements.txt
python seed_data.py
uvicorn main:app --reload
```

---

## Task 1: Expand Seed Data ⭐ HIGH PRIORITY
**Deadline:** End of Week 1

### What to Do
Update `backend/seed_data.py` to add more realistic data. Currently we only have 3 policies and 8 claims. We need 20 policies and 50+ claims.

### File to Edit: `backend/seed_data.py`

### Policies to Add (20 total)
| # | Policy Number | Company | Industry | Type |
|---|--------------|---------|----------|------|
| 1 | COMM-2024-001 | ABC Manufacturing Inc | Manufacturing | commercial_property |
| 2 | COMM-2024-002 | XYZ Restaurant Group | Restaurant | general_liability |
| 3 | COMM-2024-003 | SafeBuild Construction | Construction | workers_comp |
| 4 | COMM-2024-004 | MedCare Health Services | Healthcare | professional_liability |
| 5 | COMM-2024-005 | FastTrack Logistics | Transportation | commercial_auto |
| 6 | COMM-2024-006 | TechNova Solutions | Technology | cyber_liability |
| 7 | COMM-2024-007 | GreenLeaf Properties | Real Estate | commercial_property |
| 8 | COMM-2024-008 | CityBite Foods LLC | Restaurant | general_liability |
| 9 | COMM-2024-009 | IronWorks Fabrication | Manufacturing | workers_comp |
| 10 | COMM-2024-010 | QuickMart Retail Chain | Retail | general_liability |
| 11 | COMM-2024-011 | BuildRight Contractors | Construction | workers_comp |
| 12 | COMM-2024-012 | DataShield Cybersec | Technology | cyber_liability |
| 13 | COMM-2024-013 | SunValley Farms | Agriculture | commercial_property |
| 14 | COMM-2024-014 | OceanView Hotels | Hospitality | general_liability |
| 15 | COMM-2024-015 | PrimeCare Dental | Healthcare | professional_liability |
| 16 | COMM-2024-016 | Eagle Transport Co | Transportation | commercial_auto |
| 17 | COMM-2024-017 | BlueSky Development | Real Estate | commercial_property |
| 18 | COMM-2024-018 | FreshBrew Coffee Chain | Restaurant | general_liability |
| 19 | COMM-2024-019 | SteelEdge Manufacturing | Manufacturing | commercial_property |
| 20 | COMM-2024-020 | PetCare Animal Hospital | Healthcare | professional_liability |

### Claims to Add
Spread claims across policies. Some need to trigger alerts:

**High Frequency (5+ claims) — for testing alerts:**
- COMM-2024-002 (XYZ Restaurant): 6 claims
- COMM-2024-008 (CityBite Foods): 5 claims

**High Severity ($100K+) — for testing alerts:**
- COMM-2024-003 (SafeBuild): 1 claim at $175,000
- COMM-2024-011 (BuildRight): 1 claim at $250,000

**Normal (low risk):**
- COMM-2024-001: 2 claims ($8,500 and $15,000)
- COMM-2024-006: 1 claim ($5,000)
- COMM-2024-007: 0 claims

**Total: 50-60 claims across all policies**

### Claim Types to Use
- property_damage
- bodily_injury
- workers_compensation
- general_liability
- professional_liability
- cyber_breach
- auto_accident

### Guidelines to Add (15+ total)
Add more detailed guidelines:

| Section | Category | Title | Content |
|---------|----------|-------|---------|
| 2.1.1 | eligibility | Business Age | Businesses must be operational for minimum 2 years |
| 2.1.2 | eligibility | Financial Standing | Minimum credit score of 650 required |
| 2.2.1 | eligibility | Industry Restrictions | Cannabis, fireworks, and adult entertainment excluded |
| 3.1.1 | frequency | Claim Frequency | 5+ claims annually require enhanced review |
| 3.1.2 | frequency | Frequency Trend | 50%+ increase in frequency requires pricing review |
| 4.1.1 | severity | Single Claim Threshold | Claims over $100,000 require senior review |
| 4.1.2 | severity | Aggregate Threshold | Total claims over $250,000 require referral |
| 5.1.1 | pricing | Loss Ratio Under 50% | Standard renewal, no rate change |
| 5.1.2 | pricing | Loss Ratio 50-65% | Review pricing, consider 5-10% increase |
| 5.1.3 | pricing | Loss Ratio Over 65% | Mandatory rate increase or non-renewal |
| 5.2.1 | pricing | New Business Pricing | Apply experience modification factor |
| 6.1.1 | coverage | Property Limits | Maximum $5M per occurrence |
| 6.1.2 | coverage | Liability Limits | Maximum $2M per occurrence |
| 6.2.1 | coverage | Excluded Perils | Flood, earthquake, nuclear excluded |
| 7.1.1 | authority | Binding Authority | Junior underwriters: up to $1M premium |

### How to Test
```powershell
python seed_data.py
# Should print: "Database seeded with X policies, Y claims, Z guidelines"

# Then check the API
curl http://localhost:8000/api/policies
curl http://localhost:8000/api/guidelines
```

### Done When
- [ ] 20 policies in database
- [ ] 50+ claims across policies
- [ ] 15+ guidelines
- [ ] `python seed_data.py` runs without errors
- [ ] Dashboard shows updated stats

---

## Task 2: API Testing
**Deadline:** End of Week 2

### What to Do
Write automated tests for all API endpoints.

### Setup
```bash
pip install pytest pytest-asyncio httpx
```

### Create Test Files

**File: `backend/tests/__init__.py`** (empty file)

**File: `backend/tests/test_health.py`**
```python
import pytest
from httpx import AsyncClient, ASGITransport
from main import app

@pytest.mark.asyncio
async def test_health():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
```

**File: `backend/tests/test_analysis.py`**
```python
@pytest.mark.asyncio
async def test_analyze_valid_policy():
    # Test COMM-2024-001 returns 200
    # Check response has: recommendation, risk_level, reason, evidence

@pytest.mark.asyncio
async def test_analyze_invalid_policy():
    # Test INVALID-999 returns 404
```

**File: `backend/tests/test_guidelines.py`**
```python
@pytest.mark.asyncio
async def test_get_guidelines():
    # Test /api/guidelines returns list
    # Check each guideline has: id, section_code, title, content, category
```

**File: `backend/tests/test_alerts.py`** (after Anshul builds alerts API)
```python
@pytest.mark.asyncio
async def test_get_alerts():
    # Test /api/alerts returns list
    # Check alert has: type, severity, policy_number, message
```

### Run Tests
```bash
cd backend
pytest tests/ -v
```

### Done When
- [ ] All test files created
- [ ] Tests pass with `pytest tests/ -v`
- [ ] Coverage for health, analysis, guidelines, alerts endpoints

---

## Task 3: Update Documentation
**Deadline:** End of Week 2

### What to Do
1. Update `README.md` with new features
2. Create `docs/API-Reference.md` listing all endpoints

### API Reference Template
```markdown
# RiskMind API Reference

## Health
GET /health → {"status": "healthy"}

## Analysis
GET /api/analysis/{policy_number}
Response: recommendation, risk_level, evidence...

## Guidelines
GET /api/guidelines
Response: list of guidelines...

## Alerts (NEW)
GET /api/alerts?type=&severity=
Response: list of alerts...

## Chat (NEW)
POST /api/chat
Body: {"message": "...", "conversation_history": [...]}
Response: {"response": "..."}

## Memo (NEW)
GET /api/memo/{policy_number}
Response: structured memo...
```

### Done When
- [ ] README reflects current features
- [ ] API Reference doc covers all endpoints
- [ ] Onboarding doc is up to date

---

## Tips
- Start with Task 1 (Seed Data) — Everyone else depends on good data!
- Use realistic company names and claim amounts
- Vary the risk levels so demos look interesting
- Make sure some policies trigger alerts (high frequency/severity)
