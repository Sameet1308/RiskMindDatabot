# RiskMind AI Engine — Architecture & Use Cases

## How the Engine Works

### Core Principle
**The AI never processes raw data directly. It works in two passes.**

1. **Pass 1 — LLM reads the question + schema, picks which analyses to run**
2. **Pass 2 — Backend executes those analyses on full dataset, returns small results to LLM for explanation**

### Four-Box Flow (Every Scenario)

```
+---------------+    +------------------+    +-----------------+    +----------------+
|  LLM LAYER    |    |  EXECUTOR AGENT  |    |  LLM ANALYSIS   |    |   RESPONSE     |
|               |    |                  |    |                 |    |                |
| Reads the     |--->| Runs analysis    |--->| Reads small     |--->| Plain English  |
| question      |    | on FULL dataset  |    | results (30-60  |    | + Glass Box    |
| + schema      |    | using code       |    | rows max)       |    | evidence       |
|               |    |                  |    |                 |    |                |
| Picks which   |    | Returns only     |    | Connects dots   |    | KPI cards      |
| analyses      |    | summarized       |    | across multiple |    | + narrative    |
| to run        |    | findings         |    | analyses        |    | + citations    |
|               |    |                  |    |                 |    |                |
| Zero data     |    | Handles any      |    | Small context   |    | Actionable     |
| touched       |    | volume           |    | always          |    | insight        |
+---------------+    +------------------+    +-----------------+    +----------------+
  ~100 tokens         50 to 50M rows          30-60 rows            User sees this
```

---

## USP of the AI Engine

1. **Glass Box, Not Black Box** — Every response shows what data and guidelines were used. The underwriter can verify the reasoning.

2. **Agentic Pipeline** — 8-node LangGraph state machine. It decides what information to gather, checks its own confidence, asks for clarification when unsure.

3. **3-Source RAG** — Claims data + underwriting guidelines + past decisions, all combined in one response via ChromaDB semantic search.

4. **Compute First, Explain Second** — Statistical analysis runs in code on full dataset. LLM only reasons over small, pre-computed findings.

5. **Confidence-Aware** — Scores its own confidence (45-95). Below 50 it asks for clarification instead of guessing.

6. **Multi-Modal** — Analyzes images, PDFs, videos of claim evidence in underwriting context.

7. **Zero LLM Cost for Data Work** — LLM only does reasoning. All aggregation, filtering, and computation is deterministic code.

---

## Scaling Strategy

| Data Size | Strategy | LLM Sees |
|---|---|---|
| Thousands (demo) | Load all, pass as text context | All data (~4K chars) |
| Millions | LLM picks analysis functions, DB executes, returns results | 30-60 summary rows |
| Billions | Pre-aggregated cubes + targeted SQL + caching layers | 30-60 summary rows |

**Key insight:** Volume doesn't matter. The AI always sees the same thing — a compact set of findings. The database handles the volume. The AI handles the intelligence.

---

## Resilience & Failure Handling

| Scenario | What Happens | User Experience |
|---|---|---|
| Cache warm, DB up | Use cached data, skip DB | Full response, fastest |
| Cache cold, DB up | Hit DB, populate cache, respond | Full response, +1 sec |
| Cache warm, DB down | Use cached data (may be slightly stale) | Full response, user unaware |
| Cache cold, DB down | No data available | AI responds with guideline-only reasoning: "I can't access live data right now, but based on our guidelines..." |
| Query fails | Catch error, return empty for that analysis | Slightly less comprehensive answer, other analyses still succeed |
| LLM down | Fallback chain: Claude -> Gemini -> OpenAI -> Mock template | Simpler response but real numbers from data |
| LLM returns garbage | Validation node checks. Glass Box KPI cards show real numbers regardless | User can verify AI narrative against displayed data |
| ChromaDB down | No guidelines context | Data-driven answer without guideline citations |
| User has no data | Empty result recognized | "No policies assigned yet. Contact your admin." |
| Concurrent users | User-scoped filtering (assigned_to) | Each user sees only their portfolio, no data leakage |

**Four layers of resilience:**
1. **Cache layer** — Buffer against DB outages
2. **Fallback chain** — Multiple LLM providers + mock
3. **Graceful degradation** — Best answer possible with whatever is available
4. **Glass Box verification** — Real numbers always shown, user can verify AI claims

---

## Complete Use Case Catalog

### Category 1: Simple Lookups

```
USER QUESTION                LLM LAYER              EXECUTOR AGENT           LLM ANALYSIS            RESPONSE
-------------------------    --------------------    ---------------------    --------------------    ---------------------
"Tell me about               Detects: policy_id     Fetches from DB:         Reads 1 policy +       "COMM-2024-016 is a
 COMM-2024-016"              = COMM-2024-016         - 1 policy row           3 claims. Computes     construction policy
                             Intent: entity_lookup   - 3 linked claims        risk narrative.        with $180K premium,
                             Plan: direct fetch      - 1 latest decision      Cites guidelines.      3 claims totaling
                                                                                                     $95K, LR 52.8%..."

"What happened with          Detects: claim_id      Fetches from DB:         Reads claim details    "CLM-2024-005 is a
 CLM-2024-005?"              = CLM-2024-005          - 1 claim row            + policy context.      $45K property damage
                             Intent: claim_lookup    - linked policy           Explains severity.     claim filed on..."
                             Plan: direct fetch      - evidence files
```

**Engine pattern:** Direct key lookup. No aggregation. Instant.

---

### Category 2: Aggregated Summaries

```
USER QUESTION                LLM LAYER              EXECUTOR AGENT           LLM ANALYSIS            RESPONSE
-------------------------    --------------------    ---------------------    --------------------    ---------------------
"Show claims by              Detects: group_by       Runs on full dataset:   Reads 6 rows.          "Construction leads
 industry"                   needed                  GROUP BY industry        Identifies biggest     at $500K (38% of
                             Intent: aggregation     SUM(claim_amount)        contributor,           total losses),
                             Plan: [group_by(        COUNT(*)                 compares segments.     followed by
                               industry,             -> Returns 6 rows                               Healthcare at..."
                               claim_amount, sum)]

"Total losses by year"       Detects: time +         Runs on full dataset:   Reads 3 rows.          "Losses increased
                             aggregation             GROUP BY year            Identifies trend       23% from 2023 to
                             Intent: time_agg        SUM(claim_amount)        direction.             2024, driven
                             Plan: [group_by(        -> Returns 3 rows                               primarily by..."
                               year, claim_amount,
                               sum)]

"How many open vs            Detects: status         GROUP BY status          Reads 2 rows.          "Currently 23 open
 closed claims?"             breakdown               COUNT(*)                 Calculates ratio.      claims (42%) and
                             Intent: aggregation     -> Returns 2 rows                               32 closed (58%)..."

"Average claim size          Detects: group_by       GROUP BY claim_type      Reads 6-8 rows.        "Property damage has
 by type"                    + avg metric            AVG(claim_amount)        Ranks by severity.     the highest average
                             Intent: aggregation     -> Returns 6-8 rows                             at $72K, followed
                                                                                                     by liability at..."
```

**Engine pattern:** Single aggregation. 1M rows scanned, 5-10 rows returned. AI explains the breakdown.

---

### Category 3: Ranked / Top-N

```
USER QUESTION                LLM LAYER              EXECUTOR AGENT           LLM ANALYSIS            RESPONSE
-------------------------    --------------------    ---------------------    --------------------    ---------------------
"Which policies have         Detects: ranking        JOIN policies+claims     Reads 10 rows.         "Worst performer is
 the highest loss            needed                  Compute LR per policy    Explains WHY each      COMM-2024-003 at
 ratio?"                     Intent: top_n           ORDER BY LR DESC         is high.               238% LR -- 5 claims
                             Plan: [top_n(           LIMIT 10                                        including a $350K
                               loss_ratio, 10)]      -> Returns 10 rows                              structural collapse."

"10 largest claims"          Detects: ranking        ORDER BY amount DESC    Reads 10 rows.         "Largest claim is
                             Intent: top_n           LIMIT 10                 Notes concentration.   $350K on COMM-2024-
                             Plan: [top_n(           -> Returns 10 rows                              003. 7 of top 10
                               claim_amount, 10)]                                                    are construction."

"Which underwriter           Detects: ranking +      Group by assigned_to    Reads 2-5 rows.        "Sarah has 4 high-
 has most high-risk          user dimension          Count HIGH risk          Compares performance.  risk policies vs
 policies?"                  Intent: top_n           -> Returns 2-5 rows                             James's 2..."
```

**Engine pattern:** Aggregate + sort + limit. 1M rows scanned, 10 returned.

---

### Category 4: Trend Analysis

```
USER QUESTION                LLM LAYER              EXECUTOR AGENT           LLM ANALYSIS            RESPONSE
-------------------------    --------------------    ---------------------    --------------------    ---------------------
"Is claim frequency          Detects: trend +        GROUP BY month           Reads 24 data points.  "Claim frequency is
 increasing?"                time_series             COUNT(*)                 Calculates MoM         up 12% YoY. The
                             Intent: trend           Compute MoM change       growth rate. Detects   acceleration started
                             Plan: [trend(           -> Returns 24 rows       acceleration or        in Q3 when
                               claim_date,                                    seasonality.           construction claims
                               count, monthly)]                                                      spiked..."

"Show severity trend         Detects: trend +        GROUP BY quarter         Reads 4-8 rows.        "Average severity
 by quarter"                 avg metric              AVG(claim_amount)        Identifies direction   rose from $28K in
                             Intent: trend           -> Returns 4-8 rows      and rate of change.    Q1 to $45K in Q4,
                             Plan: [trend(                                                           a 60% increase..."
                               quarterly, avg)]

"When did construction       Detects: trend +        WHERE industry=const    Reads 12 data points.  "Construction claims
 claims start spiking?"      filter + inflection     GROUP BY month           Finds the inflection   began spiking in
                             Intent: trend_detect    Compute rate of change   point.                 July 2024, jumping
                             Plan: [trend(           -> Returns 12 rows                              from 2/month to
                               monthly,                                                              5/month..."
                               filter=construction)]
```

**Engine pattern:** Time-series aggregation. All computed in code. AI narrates the pattern.

---

### Category 5: Comparisons

```
USER QUESTION                LLM LAYER              EXECUTOR AGENT           LLM ANALYSIS            RESPONSE
-------------------------    --------------------    ---------------------    --------------------    ---------------------
"Compare construction        Detects: compare +      TWO aggregations:       Reads 2 blocks.        "Construction has
 vs healthcare"              two segments            Segment A: construction  Finds the key          higher premium but
                             Intent: comparison      Segment B: healthcare    differences.           far worse LR (238%
                             Plan: [compare(         -> Returns 2 blocks                             vs 62%). The gap is
                               industry,                                                             driven by 5 large
                               [constr, health])]                                                    claims..."

"Sarah's book vs             Detects: compare +      TWO user-scoped         Reads 2 blocks.        "Sarah: $970K prem,
 James's book"               two users               aggregations:           Compares portfolio     84.8% LR. James:
                             Intent: user_compare    Sarah: 10 policies      health and risk mix.   $850K prem, 61% LR.
                             Plan: [compare(         James: 11 policies                             James's book is
                               assigned_to)]         -> Returns 2 blocks                            healthier because..."

"New business vs             Detects: compare +      Segment by policy age   Reads 2 blocks.        "New business runs
 renewals"                   age segmentation        Compute LR for each     Identifies pricing     at 95% LR vs 58%
                             Intent: comparison      -> Returns 2 blocks     implications.          for renewals.
                             Plan: [compare(                                                        Suggests new biz
                               policy_age)]                                                         may be underpriced."
```

**Engine pattern:** Parallel aggregations, different filters, same metrics. AI compares.

---

### Category 6: Outlier & Anomaly Detection

```
USER QUESTION                LLM LAYER              EXECUTOR AGENT           LLM ANALYSIS            RESPONSE
-------------------------    --------------------    ---------------------    --------------------    ---------------------
"Any unusual claims?"        Detects: anomaly        Compute mean, std dev   Reads 8 flagged rows.  "Found 8 anomalies.
                             detection needed        Flag where > 2 std dev  Explains WHY each is   CLM-2024-008 ($350K)
                             Intent: outlier         -> Returns 8 rows       unusual.               is 4.2 std devs
                             Plan: [outliers(                                                        above average..."
                               claim_amount, 2)]

"Which policies are          Detects: threshold      Compute LR per policy   Reads 5 policies.      "5 policies exceed
 bleeding money?"            breach detection        Flag where LR > 150%    Ranks by severity.     150% LR. Worst is
                             Intent: outlier         -> Returns 5 rows       Identifies patterns.   COMM-2024-003 at
                             Plan: [outliers(                                                        238%..."
                               loss_ratio, 150)]

"Claims that look            Detects: multi-rule     Runs 3 rule checks:     Reads 12 flags.        "12 claims flagged.
 suspicious"                 anomaly detection       1: amount > 3 std dev   Groups by rule type.   5 unusually high,
                             Intent: fraud_screen    2: filed < 30d expiry   Highlights overlap.    4 filed before
                             Plan: [outliers(amt),   3: 3+ in 60 days                               expiry, 3 trigger
                               outliers(timing),     -> Returns 12 flags                            multiple rules..."
                               outliers(frequency)]

"Policies with sudden        Detects: rate change    Per-policy time series  Reads 2-10 flags.      "3 policies show
 claim spikes"               detection               Detect where monthly    Explains the spike     sudden spikes.
                             Intent: spike_detect    count jumps > 2x avg    context for each.      COMM-2024-003 went
                             Plan: [outliers(        -> Returns 2-10 rows                           from 1/month to
                               rate_of_change)]                                                     4/month in Q3..."
```

**Engine pattern:** Statistical functions on full dataset. Only flagged outliers go to AI. 1M rows scanned, 10-15 anomalies surfaced.

---

### Category 7: Correlation & Driver Analysis

```
USER QUESTION                LLM LAYER              EXECUTOR AGENT           LLM ANALYSIS            RESPONSE
-------------------------    --------------------    ---------------------    --------------------    ---------------------
"What's driving our          Detects: multi-dim      Runs 5 PARALLEL:        Reads ~50 rows total.  "Top driver:
 losses?"                    analysis                1. group_by(industry)    Connects dots across   Construction (38%).
                             Intent: driver          2. group_by(claim_type)  dimensions.            Within construction,
                             Plan:                   3. group_by(year)                               property damage is
                             [group_by(industry),    4. top_n(policies, 10)                          72%. 3 policies =
                              group_by(type),        5. outliers(LR, 2)                              80% of the
                              trend(yearly),         -> Returns ~50 rows                             problem..."
                              top_n(10),
                              outliers(LR)]

"Why is construction         Detects: drill-down     4 analyses FILTERED     Reads ~30 rows.        "Concentrated in
 performing badly?"          on single segment       to construction:        Finds root cause.      property damage.
                             Intent: root_cause      1. group_by(claim_type)                        One policy (COMM-
                             Plan:                   2. trend(monthly)                               2024-003) = 70%
                             [group_by(type, f=c),   3. top_n(policies, 5)                          of segment losses."
                              trend(monthly, f=c),   4. outliers(amount)
                              top_n(5, f=c),         -> Returns ~30 rows
                              outliers(f=c)]

"Does industry affect        Detects: correlation    Group by industry       Reads 5-10 rows        "Strong correlation.
 claim severity?"            analysis                AVG(claim_amount)       + 1 stat.              Construction avg
                             Intent: correlation     Compute correlation     Explains relationship. $100K vs Healthcare
                             Plan: [group_by(        -> Returns 5-10 rows                           $37K. Industry is
                               industry, avg),       + correlation coeff                            the strongest
                               correlation(                                                         predictor of
                               industry, amount)]                                                   severity."

"Which factors predict       Detects: multi-factor   Group by industry       Reads ~20 rows.        "Three factors
 high loss ratios?"          analysis                Group by region         Ranks factors by       predict high LR:
                             Intent: factor_analysis Group by policy_age     predictive strength.   1) Industry (constr
                             Plan:                   Rank each by LR                                = 238% LR) 2) Policy
                             [group_by(industry),    -> Returns ~20 rows                            age < 1yr (95% LR)
                              group_by(region),                                                     3) Region: coastal
                              group_by(age)]                                                        (89% LR)..."
```

**Engine pattern:** Multiple parallel aggregations. Each returns small ranked result. AI synthesizes across all dimensions.

---

### Category 8: Predictive / Forward-Looking

```
USER QUESTION                LLM LAYER              EXECUTOR AGENT           LLM ANALYSIS            RESPONSE
-------------------------    --------------------    ---------------------    --------------------    ---------------------
"Which policies will         Detects: prediction     Pattern match:          Reads 7 flagged.       "7 policies match
 deteriorate?"               based on history        "3+ claims in yr 1      Explains pattern       deterioration
                             Intent: risk_predict    -> 78% chance LR>100%"  and risk for each.     pattern. Highest
                             Plan: [pattern_match(   -> Returns 7 matches    Recommends action.     risk: COMM-2024-009
                               rule="3+ claims                                                      with 4 claims in
                               in year 1")]                                                         first 8 months..."

"What if we drop             Detects: scenario       TWO calculations:       Reads before/after.    "Current LR: 84.8%.
 construction?"              simulation              1. Current total LR     Quantifies impact.     Without construction:
                             Intent: what_if         2. LR excl. constr     Flags trade-offs.      58.2%. Save $500K
                             Plan:                   + premium impact                                losses but lose
                             [aggregate(all),        -> Returns 2 numbers                           $210K premium..."
                              aggregate(excl=c)]

"Which renewals should       Detects: decision       Compute LR + trend +   Reads 5-10 policies.   "Recommend declining
 I decline?"                 support for batch       guideline compliance    Ranks by risk.         3 renewals: COMM-
                             Intent: batch_decide    for expiring policies   Recommends per policy. 2024-003 (238% LR),
                             Plan:                   -> Returns 5-10 rows                           COMM-2024-009
                             [batch_evaluate(                                                       (145% LR)..."
                               expiring=true)]

"Project next quarter        Detects: projection     Historical frequency    Reads projected        "Based on current
 loss ratio"                 based on trend          x severity trend        numbers.               trajectory, Q1
                             Intent: forecast        Extrapolate forward     Explains assumptions.  projected LR is
                             Plan: [project(         -> Returns 1 projection Flags uncertainty.     91%, up from 84.8%.
                               metric=LR,            + confidence interval                          Construction is
                               horizon=1Q)]                                                         the primary driver."
```

**Engine pattern:** Scenario simulation. Backend runs what-if in code. AI interprets and adds judgment.

---

### Category 9: Compliance & Guidelines

```
USER QUESTION                LLM LAYER              EXECUTOR AGENT           LLM ANALYSIS            RESPONSE
-------------------------    --------------------    ---------------------    --------------------    ---------------------
"Is COMM-2024-003            Detects: compliance     TWO parallel fetches:   Reads metrics +        "COMM-2024-003
 within guidelines?"         check needed            1. Compute policy KPIs  guidelines. Compares   BREACHES UW-003:
                             Intent: compliance      2. ChromaDB: matching   each metric vs         LR 238% vs 80%
                             Plan:                   guidelines              threshold.             threshold. Also
                             [fetch_metrics(),       -> Returns 1 policy                            exceeds 5-claim
                              search_guidelines()]   + 3 guideline sections                         frequency limit."

"Which policies breach       Detects: batch          Compute LR per policy   Reads 8 breaches.      "8 of 21 policies
 our LR threshold?"          compliance scan         Compare vs threshold    Groups by severity.    breach 80% LR.
                             Intent: compliance_all  -> Returns 8 breaches   Recommends priority.   3 are critical
                             Plan: [batch_comply(                                                    (>150% LR)..."
                               threshold=80)]

"What do guidelines say      Detects: knowledge      ChromaDB semantic       Reads guideline        "Per UW-003:
 about construction?"        query only              search only.            sections. Summarizes   Construction requires
                             Intent: guideline_search No data needed.        key rules and          enhanced scrutiny
                             Plan: [search_kb(       -> Returns 2-5          thresholds.            for LR above 60%.
                               "construction")]      guideline sections                             UW-007 sets aggregate
                                                                                                    exposure limits..."

"Are we compliant            Detects: batch          Compute metrics for     Reads summary.         "13 policies
 across the portfolio?"      compliance for all      every policy. Compare   Lists compliant vs     compliant. 8
                             Intent: portfolio_audit each vs guidelines.     breaching. Trends.     breaching. 3 of
                             Plan:                   -> Returns summary:                            the breaches are
                             [batch_comply(all)]     X compliant, Y breach                          new since last
                                                                                                    quarter."
```

**Engine pattern:** Data metrics + guideline matching. Two sources combined. AI explains the gap.

---

### Category 10: Document Generation & Actions

```
USER QUESTION                LLM LAYER              EXECUTOR AGENT           LLM ANALYSIS            RESPONSE
-------------------------    --------------------    ---------------------    --------------------    ---------------------
"Draft a memo for            Detects: document       Fetches ALL context:    Reads full context.    Formatted memo:
 COMM-2024-016"              generation              - Policy details        Generates structured   Exec Summary, Claims
                             Intent: memo            - All claims            memo with sections.    History, Risk, Guide-
                             Plan:                   - Past decisions                               line Alignment,
                             [fetch_all(policy),     - Matching guidelines                          Recommendation...
                              search_guidelines()]   -> Full context

"Should we renew             Detects: decision       Decision rules + data   Reads policy context   "RECOMMEND: REFER.
 COMM-2024-016?"             support                 + guidelines.           + guidelines.          LR is 52.8% (below
                             Intent: decision        Computes recommendation Explains reasoning     80% decline thresh)
                             Plan:                   -> Returns context +    with evidence.         but trend is rising.
                             [evaluate_decision()]   decision logic                                 3 claims in 8
                                                                                                    months warrants
                                                                                                    further review."

"Export all high-risk        Detects: export         Backend generates file  AI writes summary.     "Export ready: 8
 policies to CSV"            action                  SERVER-SIDE. Streams    Does NOT process       high-risk policies,
                             Intent: data_export     to CSV.                 the rows.              $1.2M premium.
                             Plan:                   -> File on server +                            [Download CSV]"
                             [export(risk=HIGH)]     1 summary stat row

"Save this analysis"         Detects: save action    Frontend stores to      No LLM needed.         Analysis saved to
                             Intent: save            localStorage.                                  Saved Intelligence.
                             Plan: client-side only  PDF export available.                          [View Saved]
```

**Engine pattern:** Action-oriented. Data + AI produce actionable output.

---

### Category 11: Multi-Modal Evidence

```
USER QUESTION                LLM LAYER              EXECUTOR AGENT           LLM ANALYSIS            RESPONSE
-------------------------    --------------------    ---------------------    --------------------    ---------------------
*Uploads flood damage        Detects: image file     Saves file. Sends to   Reads image analysis   "Significant water
 photo*                      Intent: evidence        vision model. Fetches   + claim data.          damage to structural
                             Plan:                   linked claim context.   Combines visual with   supports. Given
                             [analyze_image(),       -> Returns: image       underwriting context.  existing $95K in
                              fetch_claim()]         summary + claim data                           claims, risk
                                                                                                    elevates to HIGH."

*Uploads PDF loss            Detects: PDF file       PDF extraction + AI     Reads extracted        "Loss report shows
 report*                     Intent: document_analysis analysis.             content + policy.      3 prior incidents
                             Plan:                   Fetches policy context. Identifies key         unreported in our
                             [analyze_pdf(),         -> Returns: PDF summary findings vs known      system. Total
                              fetch_policy()]        + policy data           claim history.         exposure may be
                                                                                                    higher than
                                                                                                    recorded..."

*Uploads video               Detects: video file     Samples frames. Vision  Reads video analysis   "Site inspection
 inspection*                 Intent: evidence        model analyzes.         + claim context.       shows active water
                             Plan:                   Fetches claim context.  Notes underwriting-    intrusion in
                             [analyze_video(),       -> Returns: video       relevant hazards.      basement. Recommend
                              fetch_claim()]         summary + claim data                           immediate
                                                                                                    engineering review."
```

**Engine pattern:** Multi-modal AI. Visual/document understanding added to data context.

---

## Panel Q&A Ready Answers

### "How does your AI handle large datasets?"
"The AI never sees raw data. We run statistical analysis first — grouping, trending, outlier detection, correlations — all in code. The AI only sees summary findings, typically 30-50 data points regardless of whether the underlying dataset is 50 rows or 50 million. The AI's job is to turn those findings into a narrative the underwriter can act on."

### "What if the database goes down?"
"Four layers of resilience. Cache buffer serves data during outages. LLM fallback chain tries multiple providers. The system degrades gracefully — it gives the best answer possible with whatever is available. And the Glass Box always shows real numbers so users can verify."

### "How is this different from ChatGPT on a database?"
"Three things. First, Glass Box transparency — every response shows exactly what data and guidelines were used. Second, the agentic pipeline — it doesn't just answer, it decides what information to gather, checks its own confidence, and asks for clarification when unsure. Third, it combines structured data with unstructured knowledge — claims numbers AND underwriting guidelines AND past decisions AND uploaded evidence, all in one response."

### "Can it handle any question?"
"The engine has a toolkit of pre-built analysis functions — aggregations, trends, outliers, comparisons, correlations, scenario simulations. The AI reads the user's question and picks which functions to run. Different question, different function calls, same pipeline. Whether the user asks about a single policy or wants a full portfolio driver analysis, the four-box flow is identical."

### "What about data security and user access?"
"Every query is automatically scoped to the logged-in user's assigned policies. Sarah sees her 10 policies. James sees his 11. The filtering happens at the data layer before the AI ever sees anything. No data leakage, no manual filtering needed."

### "How do you prevent AI hallucination?"
"Two safeguards. First, the AI reasons over pre-computed data, not raw tables — it can't invent numbers that don't exist in the analysis results. Second, the Glass Box displays the actual metrics on the canvas alongside the narrative. If the AI says 'loss ratio is 84%' but the KPI card shows 84.8%, the user sees both. The data is always the source of truth."
