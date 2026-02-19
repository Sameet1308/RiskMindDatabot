# RiskMind Demo Playbook & Capability Test Script

> **Total Capabilities: 28** | **Estimated Demo Time: ~20 min**
> Run each test in order. Mark PASS/FAIL as you go.

---

## Pre-Flight Checklist

| # | Check | Command | Expected |
|---|-------|---------|----------|
| 0a | Backend running | `curl http://localhost:8001/health` | `{"status":"healthy","llm_active":true}` |
| 0b | Data status | `curl http://localhost:8001/api/data/status` | 6 tables, 145 records, 122 vectors |
| 0c | Frontend running | Open `http://localhost:5179` | Redirects to `/login` |

---

## Phase 1: Authentication & Data Connector (3 tests)

### TEST 1 - User Login
- **Action:** Open `http://localhost:5179/login`
- **Steps:** Click "Sarah Mitchell" tile > type `sarah123` > click "Sign in"
- **Expected:**
  - [  ] Login screen shows 2 user tiles (Sarah, James)
  - [  ] Email field auto-fills on tile click
  - [  ] Successful login redirects to Data Connector screen
- **API:** `POST /api/auth/login` returns `{email, full_name, role, assigned_policies}`

### TEST 2 - Data Connector Splash
- **Action:** Observe the Data Connector after login
- **Expected:**
  - [  ] 4-step animated progress: Connecting > Schema > Indexing > Context
  - [  ] Each step shows green checkmark when done
  - [  ] Step metadata: db name, "6 tables found", vector count, record count
  - [  ] Database selector shows SQLite (active), PostgreSQL/Snowflake/Oracle (disabled)
  - [  ] "Continue to RiskMind" button appears when all steps complete
- **API:** `GET /api/data/status` returns table counts + ChromaDB status

### TEST 3 - Schema Preview
- **Action:** Click the "Schema discovered" expander on the Data Connector
- **Expected:**
  - [  ] Expandable grid shows all 6 tables: Policies, Claims, Decisions, Guidelines, Documents, Users
  - [  ] Each row shows: table name, description, row count, column count
  - [  ] Summary strip: "145 Records | 6 Tables | 122 AI Indexed"
- **Then:** Click "Continue to RiskMind"

---

## Phase 2: Welcome Canvas & Quick Actions (2 tests)

### TEST 4 - Empty Canvas (Welcome State)
- **Action:** Observe the main RiskMind page after Data Connector
- **Expected:**
  - [  ] Left panel: Chat input with composer
  - [  ] Right panel: Welcome hero text
  - [  ] 5 quick-action prompt groups: Understand, Analyze, Decide, Document, Explore
  - [  ] Each group has clickable prompt buttons

### TEST 5 - Prompt Library
- **Action:** Click the "Prompt Library" toggle in the chat panel
- **Expected:**
  - [  ] Collapsible section expands with pre-built prompts
  - [  ] Groups: Understand, Analyze, Decide, Document, Explore
  - [  ] Clicking any prompt populates the chat input field

---

## Phase 3: Chat Intelligence - Core Intents (8 tests)

### TEST 6 - UNDERSTAND Intent (Policy Risk)
- **Demo Command:** `Why is COMM-2024-016 considered high risk?`
- **Expected:**
  - [  ] Canvas switches to `analysis` mode
  - [  ] 4 KPI tiles: Policy Number, Claims Count, Total Loss, Loss Ratio
  - [  ] Key Drivers bullet list (claim severity, frequency, etc.)
  - [  ] AI narrative in chat (markdown formatted)
  - [  ] "Detailed view available in the Intelligence Canvas" hint in chat
  - [  ] Sources shown below chat message (guideline section codes)
- **Intent:** `policy_risk_summary` > `Understand` > `analysis`

### TEST 7 - UNDERSTAND Intent (Portfolio)
- **Demo Command:** `Give me a portfolio risk overview`
- **Expected:**
  - [  ] Canvas shows portfolio-level KPIs: Policy Count, Total Premium, Total Claims, Loss Ratio
  - [  ] AI narrative covers: risk distribution, top industries, high-risk policies
  - [  ] Data is scoped to Sarah's 10 assigned policies (RBAC)
- **Intent:** `portfolio_summary` > `Understand` > `analysis`

### TEST 8 - ANALYZE Intent (Ad-hoc Query)
- **Demo Command:** `What are the top 5 claims by amount?`
- **Expected:**
  - [  ] Canvas shows analysis with markdown narrative
  - [  ] Response lists specific claim numbers with amounts
  - [  ] Data pulled from pre-computed snapshot (TOP 10 CLAIMS BY AMOUNT)
- **Intent:** `ad_hoc_query` > `Analyze` > `analysis`

### TEST 9 - DECIDE Intent (Renewal Decision)
- **Demo Command:** `Should we renew COMM-2024-016? Give me a decision-ready card.`
- **Expected:**
  - [  ] Canvas switches to `decision` mode
  - [  ] AI recommendation shown (based on loss ratio thresholds)
  - [  ] 3 KPI tiles: Policy, Claims, Loss Total
  - [  ] 3 action buttons: Accept (green), Refer (amber), Decline (red)
  - [  ] Optional notes text field
- **Intent:** `policy_risk_summary` > `Decide` > `decision`

### TEST 10 - Record a Decision
- **Action:** On the decision card from TEST 9, type a note and click "Accept"
- **Expected:**
  - [  ] "Decision recorded: ACCEPT" confirmation toast
  - [  ] Decision saved to database via `POST /api/decisions/`
- **API:** `POST /api/decisions/` with `{policy_number, decision, reason, risk_level}`

### TEST 11 - DOCUMENT Intent (Underwriting Memo)
- **Demo Command:** `Draft an underwriting memo for COMM-2024-016 with guideline alignment`
- **Expected:**
  - [  ] Canvas switches to `memo` mode
  - [  ] Click "Generate" button if memo not auto-generated
  - [  ] Executive Summary narrative
  - [  ] 4 KPI grid: Total Claims, Total Loss, Loss Ratio, Risk Level
  - [  ] Recommendation + Pricing Action section
  - [  ] Risk Drivers bullet list
  - [  ] Evidence items (from claims)
  - [  ] Guideline Alignment section (section codes + citations)
- **Intent:** `policy_risk_summary` > `Document` > `memo`
- **API:** `GET /api/memo/COMM-2024-016`

### TEST 12 - GEO MAP Intent
- **Demo Command:** `Show me a geographic risk map of my portfolio`
- **Expected:**
  - [  ] Canvas switches to `geo_map` mode
  - [  ] Leaflet map renders with colored markers (red/gold/green = high/medium/low risk)
  - [  ] Click any marker > popup shows: policyholder, industry, premium, claims, loss ratio
  - [  ] Intelligence sidebar with 3 tabs: Top Risk, Industry, Hotspots
  - [  ] Portfolio KPI strip above sidebar
  - [  ] AI insights narrative below the map
- **Keywords:** map, geo, geography, spatial, geospatial, location, region
- **API:** `GET /api/chat/geo/policies?user_email=sarah@apexuw.com`

### TEST 13 - Analytics Playground Link (Chat Trigger)
- **Demo Command:** `Open the self-service analytics playground`
- **Expected:**
  - [  ] Chat response contains clickable link: "Open Analytics Playground"
  - [  ] Clicking link navigates to `/analytics` (SPA navigation, no full reload)
- **Keywords:** interactive, self-service, playground, slice and dice, explore data

---

## Phase 4: Glass Box Explainability (3 tests)

### TEST 14 - Evidence & Provenance Panel
- **Demo Command:** `Show me the evidence trail for COMM-2024-016`
- **Expected:**
  - [  ] Analysis canvas with evidence panel expanded
  - [  ] Data lineage: tables used, join paths, confidence reason codes
  - [  ] Guideline citations: section codes, titles, snippets
  - [  ] Evidence items: claim photos/documents if available
- **Keywords:** evidence, proof, citation, provenance, lineage, source, transparency, audit trail

### TEST 15 - Confidence: High Confidence (auto-execute)
- **Demo Command:** `Summarize portfolio risk`
- **Expected:**
  - [  ] Response executes immediately (confidence >= 60)
  - [  ] No clarification prompts
  - [  ] Full analysis canvas rendered

### TEST 16 - Confidence: Clarification Flow
- **Demo Command:** Type just `evidence` (single word, no entity)
- **Expected:**
  - [  ] Confidence < 50 triggers clarification
  - [  ] 3 clickable suggestion chips appear in chat:
    - "Show evidence for COMM-2024-016"
    - "Show evidence for CLM-2024-005"
    - "Show portfolio evidence trail"
  - [  ] Clicking a chip sends that prompt to the chat

---

## Phase 5: Save & Export (3 tests)

### TEST 17 - Save Intelligence
- **Action:** On any analysis/memo/decision canvas card, click the "Save" button
- **Expected:**
  - [  ] "Saved!" confirmation
  - [  ] Item stored to localStorage (`riskmind_saved` key)

### TEST 18 - Saved Intelligence Page
- **Action:** Navigate to `/saved` via sidebar
- **Expected:**
  - [  ] List of all saved items with: title, type label, context, timestamp
  - [  ] Per-item: PDF Export button, Delete button
  - [  ] "Export All as PDF" button in header (when items exist)

### TEST 19 - PDF Export
- **Action:** Click "Export PDF" on any canvas card or on the Saved page
- **Expected:**
  - [  ] Browser downloads a PDF file
  - [  ] PDF contains the rendered canvas content (html2canvas-pro + jspdf)

---

## Phase 6: Workbench (5 tests)

### TEST 20 - Workbench Overview Tab
- **Action:** Navigate to `/workbench`
- **Expected:**
  - [  ] KPI strip: Total Premium, Needs Review, Pending Decisions, Avg Loss Ratio
  - [  ] Portfolio Risk Distribution bar (High/Medium/Low)
  - [  ] AI Portfolio Insight banner
  - [  ] Policy table with: Policy#, Policyholder, Industry, Premium, Claims, Loss Ratio, Risk, Evidence, Decision
  - [  ] Search bar filters policies in real-time
  - [  ] "Analyze" and "Intel" action buttons per row

### TEST 21 - Workbench Submissions Tab
- **Action:** Click "Submissions" tab
- **Expected:**
  - [  ] AI Submission Triage banner
  - [  ] Table: Submission ID, Policy, Policyholder, Industry, Quoted Premium, Status, Priority, AI Score, Insight
  - [  ] AI Score computed (60 + LR*0.3 + claims*2)
  - [  ] "Review" button navigates to analysis canvas

### TEST 22 - Workbench Renewals Tab
- **Action:** Click "Renewals" tab
- **Expected:**
  - [  ] Renewal cards with: Days to expiry, Current vs Suggested premium, Change%
  - [  ] AI recommendation per policy
  - [  ] 3 buttons per card: Decide, Memo, AI Review
  - [  ] Click "Decide" > navigates to `/?policy=X&output=decision`
  - [  ] Click "Memo" > navigates to `/?policy=X&output=memo`

### TEST 23 - Workbench Quote Decisions Tab
- **Action:** Click "Quote Decisions" tab
- **Expected:**
  - [  ] Table: Policy#, Policyholder, Premium, AI Suggested Price, Change%, Loss Ratio, Risk, Decision
  - [  ] AI pricing logic: High risk +30%, Medium +12%, Low 0%
  - [  ] "Quote" button navigates to decision canvas

### TEST 24 - Workbench Broker Comms Tab
- **Action:** Click "Broker Communications" tab
- **Expected:**
  - [  ] Communication cards with: Broker, Subject, Status, Priority, AI Draft
  - [  ] AI-drafted responses shown per communication
  - [  ] Reply / Use AI Draft buttons visible

---

## Phase 7: Analytics Playground (3 tests)

### TEST 25 - Analytics Query Builder
- **Action:** Navigate to `/analytics`
- **Expected:**
  - [  ] Sidebar with: Dimensions (checkboxes), Measures (checkboxes), Filters (add button)
  - [  ] Dimensions loaded from `GET /api/analytics/meta`
  - [  ] Empty state guidance before first query

### TEST 26 - Run Analytics Query
- **Action:** Select `Industry` dimension + `Claim Amount` + `Claim Count` measures > click Run
- **Expected:**
  - [  ] Totals KPI strip above results
  - [  ] Grid view: table with Industry, Claim Amount, Claim Count columns
  - [  ] Data scoped to Sarah's policies (RBAC via user_email)
- **API:** `POST /api/analytics/query` with `{dimensions, metrics, filters, user_email}`

### TEST 27 - Analytics Visualization Toggle
- **Action:** Click "Bar" toggle > then "Line" toggle
- **Expected:**
  - [  ] Bar chart: Recharts BarChart with coral/purple colored bars
  - [  ] Line chart: Recharts LineChart with multi-line per metric
  - [  ] Grid/Bar/Line toggle highlights active mode

---

## Phase 8: RBAC & Edge Cases (1 test)

### TEST 28 - User Data Scoping (RBAC)
- **Action:** Logout > Login as James Cooper (password: `james123`) > navigate to Workbench
- **Expected:**
  - [  ] James sees DIFFERENT policies than Sarah (his 11 assigned vs her 10)
  - [  ] Policy table, analytics, geo map all scoped to James's data
  - [  ] Chat responses reference James's portfolio, not Sarah's

---

## Scoring

| Phase | Tests | Pass | Fail |
|-------|-------|------|------|
| 1. Auth & Connector | 3 | | |
| 2. Welcome Canvas | 2 | | |
| 3. Core Intents | 8 | | |
| 4. Glass Box | 3 | | |
| 5. Save & Export | 3 | | |
| 6. Workbench | 5 | | |
| 7. Analytics | 3 | | |
| 8. RBAC | 1 | | |
| **TOTAL** | **28** | | |

---

## Quick API Smoke Test (curl)

```bash
# Auth
curl -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"sarah@apexuw.com","password":"sarah123"}'

# Data Status
curl http://localhost:8001/api/data/status

# Chat
curl -X POST http://localhost:8001/api/chat/ \
  -H "Content-Type: application/json" \
  -d '{"message":"Give me a portfolio risk overview","user_email":"sarah@apexuw.com"}'

# Geo Policies
curl "http://localhost:8001/api/chat/geo/policies?user_email=sarah@apexuw.com"

# Analytics Meta
curl http://localhost:8001/api/analytics/meta

# Analytics Query
curl -X POST http://localhost:8001/api/analytics/query \
  -H "Content-Type: application/json" \
  -d '{"dimensions":["industry_type"],"metrics":["claim_amount","claim_count"],"user_email":"sarah@apexuw.com"}'

# Memo
curl http://localhost:8001/api/memo/COMM-2024-016

# Policies (RBAC)
curl "http://localhost:8001/api/policies/?user_email=sarah@apexuw.com"

# Decisions
curl "http://localhost:8001/api/decisions/COMM-2024-016"

# Sessions
curl "http://localhost:8001/api/chat/sessions?user_email=sarah@apexuw.com"
```

---

## Demo Script (Narrative Flow)

> Use this as a spoken walkthrough for a live demo.

**Opening (1 min):**
"RiskMind is an AI-powered underwriting co-pilot that gives you transparent, evidence-backed intelligence. Let me show you."

**Login & Data Connector (1 min):**
"I log in as Sarah, a senior underwriter. RiskMind automatically connects to our data sources, discovers the schema, indexes our knowledge base, and builds context. Everything is ready."

**Quick Risk Assessment (2 min):**
"Let me ask: Why is COMM-2024-016 considered high risk? Instantly, we get KPIs, key drivers, and a full narrative. Every insight is backed by data in our Glass Box."

**Decision Support (2 min):**
"Should we renew this policy? RiskMind gives me a decision-ready card with a recommendation. I can accept, refer, or decline right here."

**Underwriting Memo (2 min):**
"Need a formal memo? Draft an underwriting memo for COMM-2024-016. Guideline alignment, evidence citations, pricing recommendations all auto-generated."

**Geographic Risk (2 min):**
"Where are my risks? Show me a geographic risk map. Interactive map with color-coded markers, hotspot detection, and industry concentration analysis."

**Workbench (3 min):**
"My workbench gives me submission triage with AI scores, renewal pricing with recommendations, quote decisions, and even AI-drafted broker communications."

**Self-Service Analytics (2 min):**
"For ad-hoc exploration, the Analytics Playground lets me pick dimensions, measures, filters, and toggle between grid, bar, and line charts."

**Save & Export (1 min):**
"Every insight can be saved and exported as PDF for compliance and audit trails."

**Glass Box (1 min):**
"The Glass Box approach means every answer shows its evidence trail: data lineage, guideline citations, and confidence scoring. No black boxes."

**Close (30 sec):**
"RiskMind: transparent AI that makes underwriters faster without replacing their judgment."
