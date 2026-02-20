# RiskMind Demo Playbook & Capability Test Script

> **Total Capabilities: 33** | **Estimated Demo Time: ~25 min**
> Run each test in order. Mark PASS/FAIL as you go.
>
> **Live URL:** https://riskmind.onrender.com (Render auto-deploy from `main`)

---

## Pre-Flight Checklist

| # | Check | Command | Expected |
|---|-------|---------|----------|
| 0a | Backend running | `curl https://riskmind.onrender.com/health` | `{"status":"healthy","llm_active":true}` |
| 0b | Data status | `curl https://riskmind.onrender.com/api/data/status` | 6 tables, 145+ records, 122+ vectors |
| 0c | Frontend loads | Open `https://riskmind.onrender.com` | Redirects to `/login` |

> **Re-seed on Render:** Shell tab > `cd /app && python seed_data.py` (needed after evidence data updates)

---

## Phase 1: Authentication & Data Connector (3 tests)

### TEST 1 - User Login
- **Action:** Open `/login`
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
  - [  ] Canvas shows portfolio-level narrative (no KPI cards for portfolio queries)
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

## Phase 4: Conversational Intelligence (3 tests)

### TEST 14 - Follow-Up Context Resolution
- **Setup:** First ask `Analyze COMM-2024-003` (SafeBuild Construction)
- **Then ask:** `Show me the evidence trail`
- **Expected:**
  - [  ] System resolves COMM-2024-003 from conversation history (no policy number in follow-up)
  - [  ] Canvas shows evidence for SafeBuild, NOT a generic portfolio response
  - [  ] Evidence panel shows crane collapse photo + inspection report PDF
  - [  ] Entity carried forward from last 6 messages via `_resolve_entity_from_history()`
- **How it works:** `route_intent_node` scans history for COMM-*/CLM-* patterns when current message has none

### TEST 15 - Proactive Clarification
- **Demo Command:** Type just `evidence` (single word, no entity, fresh session)
- **Expected:**
  - [  ] Confidence drops below 50 → clarification flow triggered
  - [  ] 3 clickable suggestion chips appear in chat:
    - "Show evidence for COMM-2024-016"
    - "Show evidence for CLM-2024-005"
    - "Show portfolio evidence trail"
  - [  ] Clicking a chip sends that prompt to the chat
  - [  ] NO LLM call made (saves API cost)
- **Guard:** Evidence + no entity + word_count <= 5 → force clarification

### TEST 16 - Out-of-Scope Guardrail
- **Demo Command:** `What's the weather like today?`
- **Expected:**
  - [  ] Response: "I'm **RiskMind**, your underwriting co-pilot. I'm designed to help with **insurance risk assessment, claims analysis, and portfolio management**. I can't assist with that topic."
  - [  ] 3 suggested action chips: Portfolio overview, High risk policies, Claims analysis
  - [  ] NO canvas rendered (no KPIs, no narrative)
  - [  ] NO LLM call made (detected pre-LLM by `_is_out_of_scope()`)
  - [  ] Provider shows "guardrail" not "gemini" or "bedrock"
- **Also test:** `Tell me a joke`, `What's bitcoin worth?`, `Write me a poem`
- **Counter-test:** `What's the weather risk for COMM-2024-003?` → should PASS (has insurance context)

---

## Phase 5: Glass Box Explainability (3 tests)

### TEST 17 - Rich Evidence Panel
- **Demo Command:** `Analyze COMM-2024-003` then `show evidence`
- **Expected:**
  - [  ] Glass Box panel expands with 3 cards: Data Lineage, Citations, Evidence Items
  - [  ] **Evidence card spans full width** (because it has rich content)
  - [  ] **Image thumbnail** (80x60px) of crane collapse scene — clickable to full size
  - [  ] **PDF icon** (red badge) for "Pre-incident crane inspection report"
  - [  ] **AI analysis quote** (coral left-border blockquote) under each evidence item:
    - Image: *"Aerial imagery confirms complete structural failure of the 40-ton tower crane..."*
    - PDF: *"Last inspection dated March 2024 — flagged slewing ring bearings wear..."*
  - [  ] Claim reference badge (e.g., `CLM-2024-009`) on each item
- **Key point for demo:** "See — the AI isn't making this up. It's showing you the actual photo and quoting exactly what it found in the inspection report."

### TEST 18 - Confidence Scoring Display
- **Demo Command:** `Summarize portfolio risk`
- **Expected:**
  - [  ] Glass Box header shows confidence pill (e.g., "78% — Good Confidence")
  - [  ] Color-coded: green >=80, blue >=60, amber >=50, red <50
  - [  ] Reason code tags below: `metrics_present`, `portfolio_boost`, etc.
  - [  ] Response executes immediately (confidence >= 60)

### TEST 19 - Guideline Citations
- **Demo Command:** `Why is COMM-2024-016 high risk? Show evidence`
- **Expected:**
  - [  ] Citations card shows guideline section codes with purple badges
  - [  ] Each citation has: section code, title, snippet
  - [  ] Data Lineage card shows: `policies`, `claims`, `decisions`
  - [  ] AI response cites guidelines inline (e.g., "Section 4.1 - High-Risk Threshold")

---

## Phase 6: Document Upload & Analysis (2 tests)

### TEST 20 - Upload via Chat (Paperclip)
- **Action:** Click the paperclip icon in the chat composer, select a PDF or image
- **Expected:**
  - [  ] File uploads to `/api/chat/upload`
  - [  ] AI analyzes the document (Bedrock for PDF/image, Gemini for video)
  - [  ] Analysis summary appears in the chat response
  - [  ] Document indexed into ChromaDB for future RAG retrieval
- **Supported:** PDF, PNG, JPG, WEBP, GIF, MP4, MOV

### TEST 21 - Upload Referenced in Follow-Up
- **Action:** After uploading a document, ask: `What risks did you find in that document?`
- **Expected:**
  - [  ] LLM references the uploaded document analysis from the session context
  - [  ] Session documents injected into data snapshot via `session_documents` key
  - [  ] Document visible in ChromaDB knowledge collection for future queries

---

## Phase 7: Save & Export (3 tests)

### TEST 22 - Save Intelligence
- **Action:** On any analysis/memo/decision canvas card, click the "Save" button
- **Expected:**
  - [  ] "Saved!" confirmation
  - [  ] Item stored to localStorage (`riskmind_saved` key)

### TEST 23 - Saved Intelligence Page
- **Action:** Navigate to `/saved` via sidebar
- **Expected:**
  - [  ] List of all saved items with: title, type label, context, timestamp
  - [  ] Per-item: PDF Export button, Delete button
  - [  ] "Export All as PDF" button in header (when items exist)

### TEST 24 - PDF Export
- **Action:** Click "Export PDF" on any canvas card or on the Saved page
- **Expected:**
  - [  ] Browser downloads a PDF file
  - [  ] PDF contains the rendered canvas content (html2canvas-pro + jspdf)

---

## Phase 8: Workbench (5 tests)

### TEST 25 - Workbench Overview Tab
- **Action:** Navigate to `/workbench`
- **Expected:**
  - [  ] KPI strip: Total Premium, Needs Review, Pending Decisions, Avg Loss Ratio
  - [  ] Portfolio Risk Distribution bar (High/Medium/Low)
  - [  ] AI Portfolio Insight banner
  - [  ] Policy table with: Policy#, Policyholder, Industry, Premium, Claims, Loss Ratio, Risk, Evidence, Decision
  - [  ] Search bar filters policies in real-time
  - [  ] "Analyze" and "Intel" action buttons per row

### TEST 26 - Workbench Submissions Tab
- **Action:** Click "Submissions" tab
- **Expected:**
  - [  ] AI Submission Triage banner
  - [  ] Table: Submission ID, Policy, Policyholder, Industry, Quoted Premium, Status, Priority, AI Score, Insight
  - [  ] AI Score computed (60 + LR*0.3 + claims*2)
  - [  ] "Review" button navigates to analysis canvas

### TEST 27 - Workbench Renewals Tab
- **Action:** Click "Renewals" tab
- **Expected:**
  - [  ] Renewal cards with: Days to expiry, Current vs Suggested premium, Change%
  - [  ] AI recommendation per policy
  - [  ] 3 buttons per card: Decide, Memo, AI Review
  - [  ] Click "Decide" > navigates to `/?policy=X&output=decision`
  - [  ] Click "Memo" > navigates to `/?policy=X&output=memo`

### TEST 28 - Workbench Quote Decisions Tab
- **Action:** Click "Quote Decisions" tab
- **Expected:**
  - [  ] Table: Policy#, Policyholder, Premium, AI Suggested Price, Change%, Loss Ratio, Risk, Decision
  - [  ] AI pricing logic: High risk +30%, Medium +12%, Low 0%
  - [  ] "Quote" button navigates to decision canvas

### TEST 29 - Workbench Broker Comms Tab
- **Action:** Click "Broker Communications" tab
- **Expected:**
  - [  ] Communication cards with: Broker, Subject, Status, Priority, AI Draft
  - [  ] AI-drafted responses shown per communication
  - [  ] Reply / Use AI Draft buttons visible

---

## Phase 9: Analytics Playground (3 tests)

### TEST 30 - Analytics Query Builder
- **Action:** Navigate to `/analytics`
- **Expected:**
  - [  ] Sidebar with: Dimensions (checkboxes), Measures (checkboxes), Filters (add button)
  - [  ] Dimensions loaded from `GET /api/analytics/meta`
  - [  ] Empty state guidance before first query

### TEST 31 - Run Analytics Query
- **Action:** Select `Industry` dimension + `Claim Amount` + `Claim Count` measures > click Run
- **Expected:**
  - [  ] Totals KPI strip above results
  - [  ] Grid view: table with Industry, Claim Amount, Claim Count columns
  - [  ] Data scoped to Sarah's policies (RBAC via user_email)
- **API:** `POST /api/analytics/query` with `{dimensions, metrics, filters, user_email}`

### TEST 32 - Analytics Visualization Toggle
- **Action:** Click "Bar" toggle > then "Line" toggle
- **Expected:**
  - [  ] Bar chart: Recharts BarChart with coral/purple colored bars
  - [  ] Line chart: Recharts LineChart with multi-line per metric
  - [  ] Grid/Bar/Line toggle highlights active mode

---

## Phase 10: RBAC & Edge Cases (1 test)

### TEST 33 - User Data Scoping (RBAC)
- **Action:** Logout > Login as James Chen (password: `james123`) > navigate to Workbench
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
| 4. Conversational Intelligence | 3 | | |
| 5. Glass Box | 3 | | |
| 6. Document Upload | 2 | | |
| 7. Save & Export | 3 | | |
| 8. Workbench | 5 | | |
| 9. Analytics | 3 | | |
| 10. RBAC | 1 | | |
| **TOTAL** | **33** | | |

---

## Quick API Smoke Test (curl)

```bash
# Health
curl https://riskmind.onrender.com/health

# Auth
curl -X POST https://riskmind.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"sarah@apexuw.com","password":"sarah123"}'

# Data Status
curl https://riskmind.onrender.com/api/data/status

# Chat
curl -X POST https://riskmind.onrender.com/api/chat/ \
  -H "Content-Type: application/json" \
  -d '{"message":"Give me a portfolio risk overview","user_email":"sarah@apexuw.com"}'

# Geo Policies
curl "https://riskmind.onrender.com/api/chat/geo/policies?user_email=sarah@apexuw.com"

# Analytics Meta
curl https://riskmind.onrender.com/api/analytics/meta

# Analytics Query
curl -X POST https://riskmind.onrender.com/api/analytics/query \
  -H "Content-Type: application/json" \
  -d '{"dimensions":["industry_type"],"metrics":["claim_amount","claim_count"],"user_email":"sarah@apexuw.com"}'

# Memo
curl https://riskmind.onrender.com/api/memo/COMM-2024-016

# Policies (RBAC)
curl "https://riskmind.onrender.com/api/policies/?user_email=sarah@apexuw.com"

# Decisions
curl "https://riskmind.onrender.com/api/decisions/COMM-2024-016"

# Sessions
curl "https://riskmind.onrender.com/api/chat/sessions?user_email=sarah@apexuw.com"
```

---

## Demo Script (Narrative Flow)

> Use this as a spoken walkthrough for a live demo. ~20 minutes.

**Opening (1 min):**
"RiskMind is an AI-powered underwriting co-pilot that gives you transparent, evidence-backed intelligence. Unlike black-box AI tools, every answer shows exactly where the data came from and why the AI reached its conclusion. Let me show you."

**Login & Data Connector (1 min):**
"I log in as Sarah, a senior underwriter. RiskMind automatically connects to our data sources, discovers the schema, indexes our knowledge base into vector embeddings, and builds context. Everything is ready — Sarah only sees her 10 assigned policies."

**Quick Risk Assessment (2 min):**
"Let me ask: *Why is COMM-2024-016 considered high risk?* Instantly, we get KPIs — 5 claims, $76K total loss, 158% loss ratio. The AI cites specific guidelines: Section 4.1 says anything above 80% loss ratio warrants a surcharge. Every number comes from real data."

**Follow-Up Intelligence (1 min):**
"Now I just say: *Show me the evidence trail.* Notice I didn't repeat the policy number. RiskMind remembers the context — it knows I'm still talking about COMM-2024-016. The Glass Box panel opens with data lineage, guideline citations, and evidence items."

**Evidence Deep-Dive (2 min):**
"Look at this evidence panel. Here's an actual photo from the claim — you can see the damage. And here's the inspection report PDF. The AI is quoting directly from these documents: *'Driver exceeded posted speed limit approaching curve. Estimated speed at impact: 60+ mph.'* This isn't hallucination — it's citing the real police report."

**Decision Support (2 min):**
"Should we renew this policy? RiskMind gives me a decision-ready card with a recommendation based on our guidelines. I can accept, refer, or decline right here. The decision is recorded with my name and timestamp for audit."

**Underwriting Memo (1 min):**
"Need a formal memo? *Draft an underwriting memo for COMM-2024-016.* Guideline alignment, evidence citations, pricing recommendations — all auto-generated. Save it, export as PDF."

**Out-of-Scope Guardrail (1 min):**
"What happens if someone asks something off-topic? *What's the weather today?* RiskMind politely refuses: 'I'm designed for insurance risk assessment. I can't assist with that.' It doesn't waste API calls or hallucinate answers. But if I ask *What's the weather risk exposure for COMM-2024-003?* — it understands that's an insurance question and answers it."

**Geographic Risk (2 min):**
"Where are my risks concentrated? *Show me a geographic risk map.* Interactive map with color-coded markers. Click any marker for details. The sidebar shows top risk policies, industry concentration, and geographic hotspots."

**Workbench (2 min):**
"My daily workbench: submission triage with AI risk scores, renewal pricing with recommendations, quote decisions, and AI-drafted broker communications. Everything scoped to my assigned portfolio."

**Self-Service Analytics (1 min):**
"For ad-hoc exploration, the Analytics Playground lets me pick dimensions, measures, and filters. Toggle between grid, bar, and line charts. Export as CSV or PDF."

**RBAC (30 sec):**
"If I log in as James instead, he sees a completely different portfolio — his 11 policies, his claims, his analytics. Data isolation is built in."

**Close (30 sec):**
"RiskMind: transparent AI that makes underwriters faster without replacing their judgment. Every insight has a Glass Box — you can see exactly what data was used, which guidelines were cited, and how confident the AI is in its answer."

---

## Key Capabilities Summary (for panel Q&A)

| # | Capability | How We Prove It |
|---|-----------|-----------------|
| 1 | **RAG Pipeline** | ChromaDB indexes guidelines + claims + uploaded docs → cited in every response |
| 2 | **Glass Box** | Data lineage, confidence scoring, guideline citations, evidence thumbnails + quotes |
| 3 | **Human-in-the-Loop** | Decision canvas: AI recommends, human clicks Accept/Refer/Decline |
| 4 | **Guardrails** | Out-of-scope rejection (no LLM cost), hallucination detection, entity redaction |
| 5 | **Conversational Memory** | Follow-up questions resolve entities from chat history |
| 6 | **Multi-modal** | PDF analysis (Bedrock), image vision (Bedrock), video (Gemini) |
| 7 | **RBAC** | Each user sees only their assigned policies across all features |
| 8 | **Evidence Citing** | Image thumbnails + PDF icons + AI-extracted quotes in evidence panel |
| 9 | **Agentic Pipeline** | LangGraph 8-node state machine: intent → data → RAG → confidence → LLM → guardrails |
| 10 | **LLM Fallback** | Bedrock → Gemini → Claude → OpenAI → Mock (never fails) |

### Claims with Rich Evidence (for demo)

| Claim | Policy | What to Show |
|-------|--------|-------------|
| CLM-2024-009 | COMM-2024-003 (SafeBuild) | Crane collapse photo + inspection PDF with unfollowed recommendation |
| CLM-2024-010 | COMM-2024-003 (SafeBuild) | Scaffolding OSHA violation photo |
| CLM-2024-005 | COMM-2024-002 (XYZ Restaurant) | Kitchen fire photo + fire marshal report (NFPA 96 violation) |
| CLM-2024-030 | COMM-2024-011 (BuildRight) | Structural failure photo + engineer assessment ($380K remediation) |
| CLM-2024-040 | COMM-2024-016 (Eagle Transport) | Truck rollover photo + police report (speed as cause) |
| CLM-2024-047 | COMM-2024-019 (SteelEdge) | Safety guard removal photo + OSHA citation ($15,625 penalty) |
