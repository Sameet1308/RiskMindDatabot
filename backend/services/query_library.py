"""
RiskMind Query Library - 100 Pre-built Underwriting Queries
============================================================

Architecture: Tiered Query Strategy
  Tier 0 - KPI Cache     : Pre-computed portfolio metrics (refreshed hourly)
  Tier 1 - Query Library : THIS FILE - 100 golden queries, zero LLM cost
  Tier 2 - Template SQL  : Parameterized queries in _sql_plan() (intent_engine)
  Tier 3 - LLM SQL       : For novel/complex queries only, result is cached
  Tier 4 - LLM Reasoning : Pure language responses, no SQL (always needed)

Coverage: ~80% of real underwriter queries hit Tier 1 or below.
LLM SQL generation (Tier 3) is reserved for genuinely novel ad-hoc queries.

Schema Reference:
  policies  : id, policy_number, policyholder_name, industry_type, premium,
               effective_date, expiration_date, latitude, longitude, created_at
  claims    : id, claim_number, policy_id, claim_date, claim_amount, claim_type,
               status, description, evidence_files, created_at
  decisions : id, policy_number, decision (accept/refer/decline), reason,
               risk_level, decided_by, created_at
  guidelines: id, section_code, title, content, category, policy_number,
               threshold_type, threshold_value, action
  documents : id, filename, file_path, file_type, file_size, uploaded_by,
               analysis_summary, created_at
  users     : id, email, full_name, role, is_active, created_at, last_login

Risk Level Convention (computed, not stored on policies):
  HIGH   : 5+ claims OR total_claims >= $100,000
  MEDIUM : 2-4 claims OR total_claims $50k-$100k
  LOW    : 0-1 claims AND total_claims < $50,000
  (Also stored in decisions.risk_level after underwriter decision)

Loss Ratio = (SUM(claim_amount) / premium) * 100
"""

from typing import Any, Dict, List, Optional, Tuple
import re


# ---------------------------------------------------------------------------
# Query Library: 100 Golden Queries
# ---------------------------------------------------------------------------
# Each entry:
#   id           : Unique identifier (category-number)
#   description  : Human-readable description of what this query returns
#   sql          : SQLite-compatible SELECT statement
#                  Use :param_name for parameterized slots
#   params       : Dict of required parameter names → descriptions
#   category     : Logical grouping
#   triggers     : List of phrase patterns that should route to this query
#                  These are checked against the lowercased user message
#   chart_type   : Suggested chart type for visualization (optional)
#   is_aggregate : True if result is a single summary row
# ---------------------------------------------------------------------------

QUERY_LIBRARY: Dict[str, Dict[str, Any]] = {

    # =========================================================================
    # PORTFOLIO OVERVIEW (PF) - Overall portfolio health
    # =========================================================================

    "PF-001": {
        "id": "PF-001",
        "description": "Total number of policies in the portfolio",
        "sql": "SELECT COUNT(*) AS total_policies FROM policies",
        "params": {},
        "category": "Portfolio Overview",
        "triggers": [
            "how many policies", "total policies", "policy count",
            "number of policies", "count policies", "policies total"
        ],
        "chart_type": "metric",
        "is_aggregate": True,
    },

    "PF-002": {
        "id": "PF-002",
        "description": "Total premium across entire portfolio",
        "sql": "SELECT SUM(premium) AS total_premium, AVG(premium) AS avg_premium, MIN(premium) AS min_premium, MAX(premium) AS max_premium FROM policies",
        "params": {},
        "category": "Portfolio Overview",
        "triggers": [
            "total premium", "portfolio premium", "sum of premium",
            "premium total", "how much premium", "overall premium"
        ],
        "chart_type": "metric",
        "is_aggregate": True,
    },

    "PF-003": {
        "id": "PF-003",
        "description": "Portfolio-wide loss ratio (claims paid vs premium)",
        "sql": """
            SELECT
                SUM(p.premium)                                     AS total_premium,
                COALESCE(SUM(c.claim_amount), 0)                   AS total_claims,
                ROUND(COALESCE(SUM(c.claim_amount), 0)
                      / NULLIF(SUM(p.premium), 0) * 100, 2)        AS loss_ratio_pct
            FROM policies p
            LEFT JOIN claims c ON p.id = c.policy_id
        """,
        "params": {},
        "category": "Portfolio Overview",
        "triggers": [
            "loss ratio", "portfolio loss ratio", "overall loss ratio",
            "claims to premium", "claims ratio", "loss percentage"
        ],
        "chart_type": "metric",
        "is_aggregate": True,
    },

    "PF-004": {
        "id": "PF-004",
        "description": "Active policies (expiration date in the future)",
        "sql": """
            SELECT COUNT(*) AS active_policies, SUM(premium) AS active_premium
            FROM policies
            WHERE expiration_date > date('now')
        """,
        "params": {},
        "category": "Portfolio Overview",
        "triggers": [
            "active policies", "current policies", "in-force policies",
            "live policies", "policies still active"
        ],
        "chart_type": "metric",
        "is_aggregate": True,
    },

    "PF-005": {
        "id": "PF-005",
        "description": "Expired policies",
        "sql": """
            SELECT COUNT(*) AS expired_policies, SUM(premium) AS expired_premium
            FROM policies
            WHERE expiration_date <= date('now')
        """,
        "params": {},
        "category": "Portfolio Overview",
        "triggers": [
            "expired policies", "lapsed policies", "policies expired",
            "inactive policies"
        ],
        "chart_type": "metric",
        "is_aggregate": True,
    },

    "PF-006": {
        "id": "PF-006",
        "description": "Full portfolio exposure summary - all key KPIs in one view",
        "sql": """
            SELECT
                COUNT(DISTINCT p.id)                                        AS policy_count,
                SUM(p.premium)                                              AS total_premium,
                COUNT(c.id)                                                 AS claim_count,
                COALESCE(SUM(c.claim_amount), 0)                           AS total_claims,
                COALESCE(AVG(c.claim_amount), 0)                           AS avg_claim,
                COALESCE(MAX(c.claim_amount), 0)                           AS max_claim,
                ROUND(COALESCE(SUM(c.claim_amount), 0)
                      / NULLIF(SUM(p.premium), 0) * 100, 2)                AS loss_ratio_pct,
                COUNT(DISTINCT p.industry_type)                            AS industry_count
            FROM policies p
            LEFT JOIN claims c ON p.id = c.policy_id
        """,
        "params": {},
        "category": "Portfolio Overview",
        "triggers": [
            "portfolio overview", "portfolio summary", "show me the portfolio",
            "portfolio health", "tell me about portfolio", "insurance portfolio",
            "full portfolio", "all metrics", "key metrics", "kpi", "dashboard overview"
        ],
        "chart_type": "metric",
        "is_aggregate": True,
    },

    "PF-007": {
        "id": "PF-007",
        "description": "Premium breakdown by industry type",
        "sql": """
            SELECT
                industry_type,
                COUNT(*) AS policy_count,
                SUM(premium) AS total_premium,
                ROUND(AVG(premium), 2) AS avg_premium
            FROM policies
            GROUP BY industry_type
            ORDER BY total_premium DESC
        """,
        "params": {},
        "category": "Portfolio Overview",
        "triggers": [
            "premium by industry", "industry premium", "premium distribution",
            "premium breakdown industry", "which industry pays most"
        ],
        "chart_type": "bar",
        "is_aggregate": False,
    },

    "PF-008": {
        "id": "PF-008",
        "description": "Top 10 policies by premium amount",
        "sql": """
            SELECT
                policy_number, policyholder_name, industry_type,
                premium, effective_date, expiration_date
            FROM policies
            ORDER BY premium DESC
            LIMIT 10
        """,
        "params": {},
        "category": "Portfolio Overview",
        "triggers": [
            "top policies by premium", "highest premium policies",
            "largest policies", "biggest premium", "top 10 premium"
        ],
        "chart_type": "bar",
        "is_aggregate": False,
    },

    "PF-009": {
        "id": "PF-009",
        "description": "Average premium across the portfolio",
        "sql": "SELECT ROUND(AVG(premium), 2) AS avg_premium FROM policies",
        "params": {},
        "category": "Portfolio Overview",
        "triggers": [
            "average premium", "mean premium", "typical premium",
            "avg premium", "average policy size"
        ],
        "chart_type": "metric",
        "is_aggregate": True,
    },

    "PF-010": {
        "id": "PF-010",
        "description": "Policies added this calendar year",
        "sql": """
            SELECT COUNT(*) AS new_policies, SUM(premium) AS new_premium
            FROM policies
            WHERE strftime('%Y', created_at) = strftime('%Y', 'now')
        """,
        "params": {},
        "category": "Portfolio Overview",
        "triggers": [
            "policies this year", "new policies this year", "added this year",
            "policies added 2024", "policies added 2025", "new business this year"
        ],
        "chart_type": "metric",
        "is_aggregate": True,
    },


    # =========================================================================
    # CLAIMS ANALYSIS (CL) - Understanding claims data
    # =========================================================================

    "CL-001": {
        "id": "CL-001",
        "description": "Total number of claims across portfolio",
        "sql": "SELECT COUNT(*) AS total_claims FROM claims",
        "params": {},
        "category": "Claims Analysis",
        "triggers": [
            "how many claims", "total claims", "claim count", "number of claims",
            "count claims", "claims total"
        ],
        "chart_type": "metric",
        "is_aggregate": True,
    },

    "CL-002": {
        "id": "CL-002",
        "description": "Total amount paid out across all claims",
        "sql": """
            SELECT
                SUM(claim_amount) AS total_paid,
                COUNT(*) AS claim_count,
                ROUND(AVG(claim_amount), 2) AS avg_paid
            FROM claims
        """,
        "params": {},
        "category": "Claims Analysis",
        "triggers": [
            "total claims amount", "total paid claims", "claims amount",
            "total claim value", "how much paid in claims", "sum of claims"
        ],
        "chart_type": "metric",
        "is_aggregate": True,
    },

    "CL-003": {
        "id": "CL-003",
        "description": "Average claim amount",
        "sql": "SELECT ROUND(AVG(claim_amount), 2) AS avg_claim_amount FROM claims",
        "params": {},
        "category": "Claims Analysis",
        "triggers": [
            "average claim", "avg claim", "mean claim", "typical claim amount",
            "average claim amount", "average claim size"
        ],
        "chart_type": "metric",
        "is_aggregate": True,
    },

    "CL-004": {
        "id": "CL-004",
        "description": "Claims breakdown by status (open, settled, denied, pending)",
        "sql": """
            SELECT
                status,
                COUNT(*) AS claim_count,
                SUM(claim_amount) AS total_amount,
                ROUND(AVG(claim_amount), 2) AS avg_amount
            FROM claims
            GROUP BY status
            ORDER BY claim_count DESC
        """,
        "params": {},
        "category": "Claims Analysis",
        "triggers": [
            "claims by status", "claim status breakdown", "open claims",
            "claims status", "pending vs settled", "claim status distribution"
        ],
        "chart_type": "pie",
        "is_aggregate": False,
    },

    "CL-005": {
        "id": "CL-005",
        "description": "Claims breakdown by claim type",
        "sql": """
            SELECT
                claim_type,
                COUNT(*) AS claim_count,
                SUM(claim_amount) AS total_amount,
                ROUND(AVG(claim_amount), 2) AS avg_amount
            FROM claims
            GROUP BY claim_type
            ORDER BY total_amount DESC
        """,
        "params": {},
        "category": "Claims Analysis",
        "triggers": [
            "claims by type", "claim type breakdown", "claim types",
            "type of claims", "claims by category", "claim category"
        ],
        "chart_type": "bar",
        "is_aggregate": False,
    },

    "CL-006": {
        "id": "CL-006",
        "description": "Top 10 largest claims by amount",
        "sql": """
            SELECT
                c.claim_number, c.claim_date, c.claim_amount, c.claim_type,
                c.status, p.policy_number, p.policyholder_name, p.industry_type
            FROM claims c
            JOIN policies p ON p.id = c.policy_id
            ORDER BY c.claim_amount DESC
            LIMIT 10
        """,
        "params": {},
        "category": "Claims Analysis",
        "triggers": [
            "top claims", "largest claims", "biggest claims", "highest claims",
            "most expensive claims", "top 10 claims", "largest claim amounts"
        ],
        "chart_type": "bar",
        "is_aggregate": False,
    },

    "CL-007": {
        "id": "CL-007",
        "description": "Claims filed in the current calendar year",
        "sql": """
            SELECT COUNT(*) AS claims_this_year, SUM(claim_amount) AS amount_this_year
            FROM claims
            WHERE strftime('%Y', claim_date) = strftime('%Y', 'now')
        """,
        "params": {},
        "category": "Claims Analysis",
        "triggers": [
            "claims this year", "ytd claims", "year to date claims",
            "claims in current year", "this year's claims"
        ],
        "chart_type": "metric",
        "is_aggregate": True,
    },

    "CL-008": {
        "id": "CL-008",
        "description": "Claims filed in the current calendar month",
        "sql": """
            SELECT COUNT(*) AS claims_this_month, SUM(claim_amount) AS amount_this_month
            FROM claims
            WHERE strftime('%Y-%m', claim_date) = strftime('%Y-%m', 'now')
        """,
        "params": {},
        "category": "Claims Analysis",
        "triggers": [
            "claims this month", "monthly claims", "current month claims",
            "this month's claims"
        ],
        "chart_type": "metric",
        "is_aggregate": True,
    },

    "CL-009": {
        "id": "CL-009",
        "description": "Monthly claims trend for the last 12 months",
        "sql": """
            SELECT
                strftime('%Y-%m', claim_date) AS month,
                COUNT(*) AS claim_count,
                SUM(claim_amount) AS total_amount
            FROM claims
            WHERE claim_date >= date('now', '-12 months')
            GROUP BY month
            ORDER BY month ASC
        """,
        "params": {},
        "category": "Claims Analysis",
        "triggers": [
            "claims trend", "monthly claims trend", "claims by month",
            "claim trend over time", "claims over last 12 months",
            "monthly claim volume", "claims timeline"
        ],
        "chart_type": "line",
        "is_aggregate": False,
    },

    "CL-010": {
        "id": "CL-010",
        "description": "Quarterly claims trend",
        "sql": """
            SELECT
                strftime('%Y', claim_date) || '-Q' ||
                    CASE
                        WHEN strftime('%m', claim_date) <= '03' THEN '1'
                        WHEN strftime('%m', claim_date) <= '06' THEN '2'
                        WHEN strftime('%m', claim_date) <= '09' THEN '3'
                        ELSE '4'
                    END AS quarter,
                COUNT(*) AS claim_count,
                SUM(claim_amount) AS total_amount
            FROM claims
            GROUP BY quarter
            ORDER BY quarter ASC
        """,
        "params": {},
        "category": "Claims Analysis",
        "triggers": [
            "claims by quarter", "quarterly claims", "quarterly trend",
            "quarter over quarter claims", "claims per quarter"
        ],
        "chart_type": "bar",
        "is_aggregate": False,
    },

    "CL-011": {
        "id": "CL-011",
        "description": "Open and pending claims that need attention",
        "sql": """
            SELECT
                c.claim_number, c.claim_date, c.claim_amount, c.claim_type,
                c.status, p.policy_number, p.policyholder_name
            FROM claims c
            JOIN policies p ON p.id = c.policy_id
            WHERE LOWER(c.status) IN ('open', 'pending', 'under review', 'in progress')
            ORDER BY c.claim_amount DESC
        """,
        "params": {},
        "category": "Claims Analysis",
        "triggers": [
            "open claims", "pending claims", "claims open",
            "unresolved claims", "claims in progress", "claims under review",
            "outstanding claims"
        ],
        "chart_type": "table",
        "is_aggregate": False,
    },

    "CL-012": {
        "id": "CL-012",
        "description": "Settled / closed claims",
        "sql": """
            SELECT COUNT(*) AS settled_count, SUM(claim_amount) AS settled_amount
            FROM claims
            WHERE LOWER(status) IN ('settled', 'closed', 'resolved', 'paid')
        """,
        "params": {},
        "category": "Claims Analysis",
        "triggers": [
            "settled claims", "closed claims", "resolved claims",
            "paid claims", "claims settled"
        ],
        "chart_type": "metric",
        "is_aggregate": True,
    },

    "CL-013": {
        "id": "CL-013",
        "description": "Denied or rejected claims",
        "sql": """
            SELECT COUNT(*) AS denied_count, SUM(claim_amount) AS denied_amount
            FROM claims
            WHERE LOWER(status) IN ('denied', 'rejected', 'declined')
        """,
        "params": {},
        "category": "Claims Analysis",
        "triggers": [
            "denied claims", "rejected claims", "declined claims",
            "claims denied", "claims rejected"
        ],
        "chart_type": "metric",
        "is_aggregate": True,
    },

    "CL-014": {
        "id": "CL-014",
        "description": "High-value claims exceeding $50,000",
        "sql": """
            SELECT
                c.claim_number, c.claim_date, c.claim_amount, c.claim_type,
                c.status, p.policy_number, p.policyholder_name, p.industry_type
            FROM claims c
            JOIN policies p ON p.id = c.policy_id
            WHERE c.claim_amount > 50000
            ORDER BY c.claim_amount DESC
        """,
        "params": {},
        "category": "Claims Analysis",
        "triggers": [
            "high value claims", "large claims", "claims over 50000",
            "big claims", "significant claims", "claims above 50k",
            "major claims"
        ],
        "chart_type": "table",
        "is_aggregate": False,
    },

    "CL-015": {
        "id": "CL-015",
        "description": "Claims filed in the last 30 days",
        "sql": """
            SELECT
                c.claim_number, c.claim_date, c.claim_amount, c.claim_type,
                c.status, p.policy_number, p.policyholder_name
            FROM claims c
            JOIN policies p ON p.id = c.policy_id
            WHERE c.claim_date >= date('now', '-30 days')
            ORDER BY c.claim_date DESC
        """,
        "params": {},
        "category": "Claims Analysis",
        "triggers": [
            "recent claims", "last 30 days claims", "claims last month",
            "new claims", "latest claims", "claims recently filed"
        ],
        "chart_type": "table",
        "is_aggregate": False,
    },

    "CL-016": {
        "id": "CL-016",
        "description": "Claims that have evidence files attached",
        "sql": """
            SELECT
                c.claim_number, c.claim_date, c.claim_amount, c.claim_type,
                c.status, c.evidence_files, p.policy_number
            FROM claims c
            JOIN policies p ON p.id = c.policy_id
            WHERE c.evidence_files IS NOT NULL AND c.evidence_files != '[]' AND c.evidence_files != ''
            ORDER BY c.claim_date DESC
        """,
        "params": {},
        "category": "Claims Analysis",
        "triggers": [
            "claims with evidence", "claims with documents", "claims with photos",
            "evidence attached", "claims with files"
        ],
        "chart_type": "table",
        "is_aggregate": False,
    },

    "CL-017": {
        "id": "CL-017",
        "description": "Claims without any evidence files (needs follow-up)",
        "sql": """
            SELECT
                c.claim_number, c.claim_date, c.claim_amount, c.claim_type,
                c.status, p.policy_number, p.policyholder_name
            FROM claims c
            JOIN policies p ON p.id = c.policy_id
            WHERE c.evidence_files IS NULL OR c.evidence_files = '[]' OR c.evidence_files = ''
            ORDER BY c.claim_amount DESC
        """,
        "params": {},
        "category": "Claims Analysis",
        "triggers": [
            "claims without evidence", "missing evidence", "no documents claims",
            "claims missing files", "evidence missing"
        ],
        "chart_type": "table",
        "is_aggregate": False,
    },

    "CL-018": {
        "id": "CL-018",
        "description": "Average claim amount by claim type",
        "sql": """
            SELECT
                claim_type,
                COUNT(*) AS count,
                ROUND(AVG(claim_amount), 2) AS avg_amount,
                SUM(claim_amount) AS total_amount
            FROM claims
            GROUP BY claim_type
            ORDER BY avg_amount DESC
        """,
        "params": {},
        "category": "Claims Analysis",
        "triggers": [
            "average claim by type", "claim type average", "avg claim per type",
            "which type costs most", "claim type cost"
        ],
        "chart_type": "bar",
        "is_aggregate": False,
    },

    "CL-019": {
        "id": "CL-019",
        "description": "Claim count per policy (policies with most claims)",
        "sql": """
            SELECT
                p.policy_number, p.policyholder_name, p.industry_type,
                COUNT(c.id) AS claim_count,
                SUM(c.claim_amount) AS total_amount
            FROM policies p
            LEFT JOIN claims c ON p.id = c.policy_id
            GROUP BY p.id
            HAVING claim_count > 0
            ORDER BY claim_count DESC
            LIMIT 20
        """,
        "params": {},
        "category": "Claims Analysis",
        "triggers": [
            "claims per policy", "most claims", "policies with most claims",
            "claim frequency", "claim count by policy", "frequent claimers"
        ],
        "chart_type": "bar",
        "is_aggregate": False,
    },

    "CL-020": {
        "id": "CL-020",
        "description": "20 most recent claims",
        "sql": """
            SELECT
                c.claim_number, c.claim_date, c.claim_amount, c.claim_type,
                c.status, p.policy_number, p.policyholder_name
            FROM claims c
            JOIN policies p ON p.id = c.policy_id
            ORDER BY c.claim_date DESC
            LIMIT 20
        """,
        "params": {},
        "category": "Claims Analysis",
        "triggers": [
            "latest claims", "most recent claims", "newest claims",
            "all recent claims", "show recent claims", "last claims"
        ],
        "chart_type": "table",
        "is_aggregate": False,
    },


    # =========================================================================
    # RISK ANALYSIS (RK) - Policy and portfolio risk assessment
    # =========================================================================

    "RK-001": {
        "id": "RK-001",
        "description": "Policies classified as HIGH risk (5+ claims or total claims >= $100k)",
        "sql": """
            SELECT
                p.policy_number, p.policyholder_name, p.industry_type,
                p.premium,
                COUNT(c.id) AS claim_count,
                COALESCE(SUM(c.claim_amount), 0) AS total_claims,
                ROUND(COALESCE(SUM(c.claim_amount), 0) / NULLIF(p.premium, 0) * 100, 2) AS loss_ratio_pct,
                'HIGH' AS risk_level
            FROM policies p
            LEFT JOIN claims c ON p.id = c.policy_id
            GROUP BY p.id
            HAVING claim_count >= 5 OR total_claims >= 100000
            ORDER BY total_claims DESC
        """,
        "params": {},
        "category": "Risk Analysis",
        "triggers": [
            "high risk policies", "high risk", "risky policies",
            "most at risk", "problematic policies", "high risk portfolio",
            "risk policies", "policies with high risk"
        ],
        "chart_type": "table",
        "is_aggregate": False,
    },

    "RK-002": {
        "id": "RK-002",
        "description": "Policies classified as MEDIUM risk (2-4 claims or $50k-$100k total claims)",
        "sql": """
            SELECT
                p.policy_number, p.policyholder_name, p.industry_type,
                p.premium,
                COUNT(c.id) AS claim_count,
                COALESCE(SUM(c.claim_amount), 0) AS total_claims,
                ROUND(COALESCE(SUM(c.claim_amount), 0) / NULLIF(p.premium, 0) * 100, 2) AS loss_ratio_pct,
                'MEDIUM' AS risk_level
            FROM policies p
            LEFT JOIN claims c ON p.id = c.policy_id
            GROUP BY p.id
            HAVING (claim_count BETWEEN 2 AND 4) OR
                   (total_claims BETWEEN 50000 AND 99999)
            ORDER BY total_claims DESC
        """,
        "params": {},
        "category": "Risk Analysis",
        "triggers": [
            "medium risk policies", "moderate risk", "medium risk",
            "borderline risk policies"
        ],
        "chart_type": "table",
        "is_aggregate": False,
    },

    "RK-003": {
        "id": "RK-003",
        "description": "Policies classified as LOW risk (0-1 claims and total claims < $50k)",
        "sql": """
            SELECT
                p.policy_number, p.policyholder_name, p.industry_type,
                p.premium,
                COUNT(c.id) AS claim_count,
                COALESCE(SUM(c.claim_amount), 0) AS total_claims,
                'LOW' AS risk_level
            FROM policies p
            LEFT JOIN claims c ON p.id = c.policy_id
            GROUP BY p.id
            HAVING claim_count <= 1 AND total_claims < 50000
            ORDER BY p.premium DESC
        """,
        "params": {},
        "category": "Risk Analysis",
        "triggers": [
            "low risk policies", "clean policies", "safe policies",
            "low risk", "best risk policies"
        ],
        "chart_type": "table",
        "is_aggregate": False,
    },

    "RK-004": {
        "id": "RK-004",
        "description": "Policies with 5 or more claims (frequency risk)",
        "sql": """
            SELECT
                p.policy_number, p.policyholder_name, p.industry_type,
                p.premium,
                COUNT(c.id) AS claim_count,
                COALESCE(SUM(c.claim_amount), 0) AS total_claims
            FROM policies p
            JOIN claims c ON p.id = c.policy_id
            GROUP BY p.id
            HAVING claim_count >= 5
            ORDER BY claim_count DESC
        """,
        "params": {},
        "category": "Risk Analysis",
        "triggers": [
            "policies with 5 claims", "5 or more claims", "frequent claims",
            "high frequency claims", "policies many claims"
        ],
        "chart_type": "table",
        "is_aggregate": False,
    },

    "RK-005": {
        "id": "RK-005",
        "description": "Policies with 3 or more claims",
        "sql": """
            SELECT
                p.policy_number, p.policyholder_name, p.industry_type,
                p.premium,
                COUNT(c.id) AS claim_count,
                COALESCE(SUM(c.claim_amount), 0) AS total_claims
            FROM policies p
            JOIN claims c ON p.id = c.policy_id
            GROUP BY p.id
            HAVING claim_count >= 3
            ORDER BY claim_count DESC
        """,
        "params": {},
        "category": "Risk Analysis",
        "triggers": [
            "policies with 3 claims", "3 or more claims", "multiple claims policies"
        ],
        "chart_type": "table",
        "is_aggregate": False,
    },

    "RK-006": {
        "id": "RK-006",
        "description": "Policies with loss ratio above 80% (decline territory)",
        "sql": """
            SELECT
                p.policy_number, p.policyholder_name, p.industry_type,
                p.premium,
                COALESCE(SUM(c.claim_amount), 0) AS total_claims,
                ROUND(COALESCE(SUM(c.claim_amount), 0) / NULLIF(p.premium, 0) * 100, 2) AS loss_ratio_pct
            FROM policies p
            LEFT JOIN claims c ON p.id = c.policy_id
            GROUP BY p.id
            HAVING loss_ratio_pct > 80
            ORDER BY loss_ratio_pct DESC
        """,
        "params": {},
        "category": "Risk Analysis",
        "triggers": [
            "loss ratio above 80", "high loss ratio", "loss ratio over 80",
            "loss ratio greater than 80", "decline candidates", "unprofitable policies",
            "policies to decline"
        ],
        "chart_type": "table",
        "is_aggregate": False,
    },

    "RK-007": {
        "id": "RK-007",
        "description": "Policies with loss ratio 60-80% (refer for review)",
        "sql": """
            SELECT
                p.policy_number, p.policyholder_name, p.industry_type,
                p.premium,
                COALESCE(SUM(c.claim_amount), 0) AS total_claims,
                ROUND(COALESCE(SUM(c.claim_amount), 0) / NULLIF(p.premium, 0) * 100, 2) AS loss_ratio_pct
            FROM policies p
            LEFT JOIN claims c ON p.id = c.policy_id
            GROUP BY p.id
            HAVING loss_ratio_pct BETWEEN 60 AND 80
            ORDER BY loss_ratio_pct DESC
        """,
        "params": {},
        "category": "Risk Analysis",
        "triggers": [
            "loss ratio 60 to 80", "borderline loss ratio", "refer candidates",
            "policies to refer", "medium loss ratio"
        ],
        "chart_type": "table",
        "is_aggregate": False,
    },

    "RK-008": {
        "id": "RK-008",
        "description": "Policies with loss ratio below 60% (profitable, accept)",
        "sql": """
            SELECT
                p.policy_number, p.policyholder_name, p.industry_type,
                p.premium,
                COALESCE(SUM(c.claim_amount), 0) AS total_claims,
                ROUND(COALESCE(SUM(c.claim_amount), 0) / NULLIF(p.premium, 0) * 100, 2) AS loss_ratio_pct
            FROM policies p
            LEFT JOIN claims c ON p.id = c.policy_id
            GROUP BY p.id
            HAVING loss_ratio_pct < 60 OR total_claims = 0
            ORDER BY loss_ratio_pct ASC
        """,
        "params": {},
        "category": "Risk Analysis",
        "triggers": [
            "loss ratio below 60", "profitable policies", "accept candidates",
            "good loss ratio", "low loss ratio policies", "policies to accept"
        ],
        "chart_type": "table",
        "is_aggregate": False,
    },

    "RK-009": {
        "id": "RK-009",
        "description": "Policies expiring within the next 30 days",
        "sql": """
            SELECT
                p.policy_number, p.policyholder_name, p.industry_type,
                p.premium, p.expiration_date,
                CAST(julianday(p.expiration_date) - julianday('now') AS INTEGER) AS days_to_expiry
            FROM policies p
            WHERE p.expiration_date BETWEEN date('now') AND date('now', '+30 days')
            ORDER BY p.expiration_date ASC
        """,
        "params": {},
        "category": "Risk Analysis",
        "triggers": [
            "expiring soon", "expiring in 30 days", "renewal due", "policies due",
            "renewals this month", "expiring next 30 days", "upcoming renewals",
            "policies expiring soon"
        ],
        "chart_type": "table",
        "is_aggregate": False,
    },

    "RK-010": {
        "id": "RK-010",
        "description": "Policies expiring within the next 60 days",
        "sql": """
            SELECT
                p.policy_number, p.policyholder_name, p.industry_type,
                p.premium, p.expiration_date,
                CAST(julianday(p.expiration_date) - julianday('now') AS INTEGER) AS days_to_expiry
            FROM policies p
            WHERE p.expiration_date BETWEEN date('now') AND date('now', '+60 days')
            ORDER BY p.expiration_date ASC
        """,
        "params": {},
        "category": "Risk Analysis",
        "triggers": [
            "expiring in 60 days", "renewals next 60 days", "next 2 months renewals"
        ],
        "chart_type": "table",
        "is_aggregate": False,
    },

    "RK-011": {
        "id": "RK-011",
        "description": "Policies expiring within the next 90 days",
        "sql": """
            SELECT
                p.policy_number, p.policyholder_name, p.industry_type,
                p.premium, p.expiration_date,
                CAST(julianday(p.expiration_date) - julianday('now') AS INTEGER) AS days_to_expiry
            FROM policies p
            WHERE p.expiration_date BETWEEN date('now') AND date('now', '+90 days')
            ORDER BY p.expiration_date ASC
        """,
        "params": {},
        "category": "Risk Analysis",
        "triggers": [
            "expiring in 90 days", "renewals next quarter", "next 3 months renewals",
            "quarterly renewals"
        ],
        "chart_type": "table",
        "is_aggregate": False,
    },

    "RK-012": {
        "id": "RK-012",
        "description": "Policies ranked by their single largest claim",
        "sql": """
            SELECT
                p.policy_number, p.policyholder_name, p.industry_type,
                p.premium,
                MAX(c.claim_amount) AS largest_claim,
                COUNT(c.id) AS claim_count
            FROM policies p
            JOIN claims c ON p.id = c.policy_id
            GROUP BY p.id
            ORDER BY largest_claim DESC
            LIMIT 15
        """,
        "params": {},
        "category": "Risk Analysis",
        "triggers": [
            "largest single claim", "biggest single claim", "max claim per policy",
            "worst claim", "catastrophic claims"
        ],
        "chart_type": "bar",
        "is_aggregate": False,
    },

    "RK-013": {
        "id": "RK-013",
        "description": "Policies with zero claims (clean record)",
        "sql": """
            SELECT
                p.policy_number, p.policyholder_name, p.industry_type,
                p.premium, p.effective_date, p.expiration_date
            FROM policies p
            LEFT JOIN claims c ON p.id = c.policy_id
            WHERE c.id IS NULL
            ORDER BY p.premium DESC
        """,
        "params": {},
        "category": "Risk Analysis",
        "triggers": [
            "no claims policies", "clean record", "zero claims",
            "policies without claims", "claim-free policies", "no claim history"
        ],
        "chart_type": "table",
        "is_aggregate": False,
    },

    "RK-014": {
        "id": "RK-014",
        "description": "Policies where total claims paid exceed the annual premium",
        "sql": """
            SELECT
                p.policy_number, p.policyholder_name, p.industry_type,
                p.premium,
                COALESCE(SUM(c.claim_amount), 0) AS total_claims,
                ROUND((COALESCE(SUM(c.claim_amount), 0) - p.premium), 2) AS loss_exposure
            FROM policies p
            LEFT JOIN claims c ON p.id = c.policy_id
            GROUP BY p.id
            HAVING total_claims > p.premium
            ORDER BY loss_exposure DESC
        """,
        "params": {},
        "category": "Risk Analysis",
        "triggers": [
            "claims exceed premium", "loss exceeds premium", "underwater policies",
            "negative policies", "claims more than premium"
        ],
        "chart_type": "table",
        "is_aggregate": False,
    },

    "RK-015": {
        "id": "RK-015",
        "description": "Risk distribution summary - count of HIGH / MEDIUM / LOW risk policies",
        "sql": """
            SELECT
                risk_level,
                COUNT(*) AS policy_count
            FROM (
                SELECT
                    p.id,
                    CASE
                        WHEN COUNT(c.id) >= 5 OR COALESCE(SUM(c.claim_amount), 0) >= 100000
                            THEN 'HIGH'
                        WHEN COUNT(c.id) BETWEEN 2 AND 4 OR
                             COALESCE(SUM(c.claim_amount), 0) BETWEEN 50000 AND 99999
                            THEN 'MEDIUM'
                        ELSE 'LOW'
                    END AS risk_level
                FROM policies p
                LEFT JOIN claims c ON p.id = c.policy_id
                GROUP BY p.id
            ) risk_calc
            GROUP BY risk_level
            ORDER BY CASE risk_level WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END
        """,
        "params": {},
        "category": "Risk Analysis",
        "triggers": [
            "risk distribution", "risk breakdown", "high medium low",
            "risk summary", "risk levels", "risk categorization",
            "how many high risk", "risk portfolio breakdown"
        ],
        "chart_type": "pie",
        "is_aggregate": False,
    },


    # =========================================================================
    # INDUSTRY ANALYSIS (IN) - Segment-level insights
    # =========================================================================

    "IN-001": {
        "id": "IN-001",
        "description": "Claim count and total amount by industry type",
        "sql": """
            SELECT
                p.industry_type,
                COUNT(c.id) AS claim_count,
                COALESCE(SUM(c.claim_amount), 0) AS total_amount,
                ROUND(COALESCE(AVG(c.claim_amount), 0), 2) AS avg_amount
            FROM policies p
            LEFT JOIN claims c ON p.id = c.policy_id
            GROUP BY p.industry_type
            ORDER BY total_amount DESC
        """,
        "params": {},
        "category": "Industry Analysis",
        "triggers": [
            "claims by industry", "industry claims", "which industry has most claims",
            "claims per industry", "industry claim breakdown", "claims industry wise"
        ],
        "chart_type": "bar",
        "is_aggregate": False,
    },

    "IN-002": {
        "id": "IN-002",
        "description": "Loss ratio by industry type",
        "sql": """
            SELECT
                p.industry_type,
                COUNT(DISTINCT p.id) AS policy_count,
                SUM(p.premium) AS total_premium,
                COALESCE(SUM(c.claim_amount), 0) AS total_claims,
                ROUND(COALESCE(SUM(c.claim_amount), 0) / NULLIF(SUM(p.premium), 0) * 100, 2) AS loss_ratio_pct
            FROM policies p
            LEFT JOIN claims c ON p.id = c.policy_id
            GROUP BY p.industry_type
            ORDER BY loss_ratio_pct DESC
        """,
        "params": {},
        "category": "Industry Analysis",
        "triggers": [
            "loss ratio by industry", "industry loss ratio", "which industry worst loss",
            "industry performance", "loss ratio industry", "industry loss analysis"
        ],
        "chart_type": "bar",
        "is_aggregate": False,
    },

    "IN-003": {
        "id": "IN-003",
        "description": "Total premium written by industry type",
        "sql": """
            SELECT
                industry_type,
                COUNT(*) AS policy_count,
                SUM(premium) AS total_premium,
                ROUND(SUM(premium) * 100.0 / (SELECT SUM(premium) FROM policies), 2) AS premium_share_pct
            FROM policies
            GROUP BY industry_type
            ORDER BY total_premium DESC
        """,
        "params": {},
        "category": "Industry Analysis",
        "triggers": [
            "premium by industry", "industry premium share", "top industries premium",
            "industry revenue", "which industry most premium"
        ],
        "chart_type": "pie",
        "is_aggregate": False,
    },

    "IN-004": {
        "id": "IN-004",
        "description": "Policy count by industry type",
        "sql": """
            SELECT
                industry_type,
                COUNT(*) AS policy_count,
                ROUND(AVG(premium), 2) AS avg_premium
            FROM policies
            GROUP BY industry_type
            ORDER BY policy_count DESC
        """,
        "params": {},
        "category": "Industry Analysis",
        "triggers": [
            "policies by industry", "industry policy count",
            "how many policies per industry", "policy distribution industry"
        ],
        "chart_type": "bar",
        "is_aggregate": False,
    },

    "IN-005": {
        "id": "IN-005",
        "description": "Average claim amount by industry type",
        "sql": """
            SELECT
                p.industry_type,
                COUNT(c.id) AS claim_count,
                ROUND(AVG(c.claim_amount), 2) AS avg_claim,
                MAX(c.claim_amount) AS max_claim
            FROM policies p
            JOIN claims c ON p.id = c.policy_id
            GROUP BY p.industry_type
            ORDER BY avg_claim DESC
        """,
        "params": {},
        "category": "Industry Analysis",
        "triggers": [
            "average claim by industry", "industry avg claim", "claim cost by industry",
            "which industry expensive claims"
        ],
        "chart_type": "bar",
        "is_aggregate": False,
    },

    "IN-006": {
        "id": "IN-006",
        "description": "Industries ranked by highest loss ratio (worst performers first)",
        "sql": """
            SELECT
                p.industry_type,
                SUM(p.premium) AS total_premium,
                COALESCE(SUM(c.claim_amount), 0) AS total_claims,
                ROUND(COALESCE(SUM(c.claim_amount), 0) / NULLIF(SUM(p.premium), 0) * 100, 2) AS loss_ratio_pct
            FROM policies p
            LEFT JOIN claims c ON p.id = c.policy_id
            GROUP BY p.industry_type
            ORDER BY loss_ratio_pct DESC
            LIMIT 5
        """,
        "params": {},
        "category": "Industry Analysis",
        "triggers": [
            "worst industry loss ratio", "highest risk industry", "riskiest industry",
            "which industry performs worst", "top risk industries"
        ],
        "chart_type": "bar",
        "is_aggregate": False,
    },

    "IN-007": {
        "id": "IN-007",
        "description": "Industries with zero claims",
        "sql": """
            SELECT
                p.industry_type,
                COUNT(DISTINCT p.id) AS policy_count,
                SUM(p.premium) AS total_premium
            FROM policies p
            LEFT JOIN claims c ON p.id = c.policy_id
            WHERE c.id IS NULL
            GROUP BY p.industry_type
        """,
        "params": {},
        "category": "Industry Analysis",
        "triggers": [
            "industries no claims", "claim-free industries",
            "which industry no claims"
        ],
        "chart_type": "table",
        "is_aggregate": False,
    },

    "IN-008": {
        "id": "IN-008",
        "description": "Total claims exposure (paid out) by industry",
        "sql": """
            SELECT
                p.industry_type,
                COALESCE(SUM(c.claim_amount), 0) AS total_exposure,
                COUNT(c.id) AS claim_count
            FROM policies p
            LEFT JOIN claims c ON p.id = c.policy_id
            GROUP BY p.industry_type
            ORDER BY total_exposure DESC
        """,
        "params": {},
        "category": "Industry Analysis",
        "triggers": [
            "industry exposure", "total exposure by industry",
            "claims exposure industry"
        ],
        "chart_type": "bar",
        "is_aggregate": False,
    },

    "IN-009": {
        "id": "IN-009",
        "description": "Top 5 industries by total premium written",
        "sql": """
            SELECT industry_type, SUM(premium) AS total_premium
            FROM policies
            GROUP BY industry_type
            ORDER BY total_premium DESC
            LIMIT 5
        """,
        "params": {},
        "category": "Industry Analysis",
        "triggers": [
            "top industries", "top 5 industries", "leading industries",
            "biggest industry segments"
        ],
        "chart_type": "bar",
        "is_aggregate": False,
    },

    "IN-010": {
        "id": "IN-010",
        "description": "Full industry risk ranking table",
        "sql": """
            SELECT
                p.industry_type,
                COUNT(DISTINCT p.id) AS policy_count,
                SUM(p.premium) AS total_premium,
                COUNT(c.id) AS claim_count,
                COALESCE(SUM(c.claim_amount), 0) AS total_claims,
                ROUND(COALESCE(SUM(c.claim_amount), 0) / NULLIF(SUM(p.premium), 0) * 100, 2) AS loss_ratio_pct,
                CASE
                    WHEN COALESCE(SUM(c.claim_amount), 0) / NULLIF(SUM(p.premium), 0) > 0.8 THEN 'HIGH'
                    WHEN COALESCE(SUM(c.claim_amount), 0) / NULLIF(SUM(p.premium), 0) > 0.6 THEN 'MEDIUM'
                    ELSE 'LOW'
                END AS industry_risk
            FROM policies p
            LEFT JOIN claims c ON p.id = c.policy_id
            GROUP BY p.industry_type
            ORDER BY loss_ratio_pct DESC
        """,
        "params": {},
        "category": "Industry Analysis",
        "triggers": [
            "industry risk ranking", "industry analysis", "analyze by industry",
            "industry performance table", "industry scorecard"
        ],
        "chart_type": "table",
        "is_aggregate": False,
    },


    # =========================================================================
    # FINANCIAL ANALYSIS (FI) - Premium and claims financials
    # =========================================================================

    "FI-001": {
        "id": "FI-001",
        "description": "Total premium collected across all time",
        "sql": "SELECT SUM(premium) AS total_premium_ever FROM policies",
        "params": {},
        "category": "Financial Analysis",
        "triggers": [
            "total premium ever", "all time premium", "gross premium written",
            "gwp", "total revenue"
        ],
        "chart_type": "metric",
        "is_aggregate": True,
    },

    "FI-002": {
        "id": "FI-002",
        "description": "Total claims paid out across all time",
        "sql": "SELECT SUM(claim_amount) AS total_claims_paid FROM claims",
        "params": {},
        "category": "Financial Analysis",
        "triggers": [
            "total claims paid", "total losses", "all time claims",
            "gross claims", "total incurred"
        ],
        "chart_type": "metric",
        "is_aggregate": True,
    },

    "FI-003": {
        "id": "FI-003",
        "description": "Net underwriting position (total premium minus total claims)",
        "sql": """
            SELECT
                SUM(p.premium) AS total_premium,
                COALESCE(SUM(c.claim_amount), 0) AS total_claims,
                SUM(p.premium) - COALESCE(SUM(c.claim_amount), 0) AS net_position
            FROM policies p
            LEFT JOIN claims c ON p.id = c.policy_id
        """,
        "params": {},
        "category": "Financial Analysis",
        "triggers": [
            "net position", "profit loss", "underwriting profit",
            "premium minus claims", "net underwriting result",
            "financial position", "net income underwriting"
        ],
        "chart_type": "metric",
        "is_aggregate": True,
    },

    "FI-004": {
        "id": "FI-004",
        "description": "Overall portfolio loss ratio",
        "sql": """
            SELECT
                ROUND(COALESCE(SUM(c.claim_amount), 0) / NULLIF(SUM(p.premium), 0) * 100, 2) AS loss_ratio_pct
            FROM policies p
            LEFT JOIN claims c ON p.id = c.policy_id
        """,
        "params": {},
        "category": "Financial Analysis",
        "triggers": [
            "overall loss ratio", "portfolio loss ratio", "total loss ratio",
            "combined ratio"
        ],
        "chart_type": "metric",
        "is_aggregate": True,
    },

    "FI-005": {
        "id": "FI-005",
        "description": "Monthly premium trend for the last 12 months",
        "sql": """
            SELECT
                strftime('%Y-%m', effective_date) AS month,
                COUNT(*) AS new_policies,
                SUM(premium) AS total_premium
            FROM policies
            WHERE effective_date >= date('now', '-12 months')
            GROUP BY month
            ORDER BY month ASC
        """,
        "params": {},
        "category": "Financial Analysis",
        "triggers": [
            "premium trend", "monthly premium", "premium over time",
            "premium by month", "premium growth"
        ],
        "chart_type": "line",
        "is_aggregate": False,
    },

    "FI-006": {
        "id": "FI-006",
        "description": "Quarterly loss ratio trend",
        "sql": """
            SELECT
                strftime('%Y', c.claim_date) || '-Q' ||
                    CASE
                        WHEN strftime('%m', c.claim_date) <= '03' THEN '1'
                        WHEN strftime('%m', c.claim_date) <= '06' THEN '2'
                        WHEN strftime('%m', c.claim_date) <= '09' THEN '3'
                        ELSE '4'
                    END AS quarter,
                COUNT(c.id) AS claim_count,
                SUM(c.claim_amount) AS claims_amount
            FROM claims c
            GROUP BY quarter
            ORDER BY quarter ASC
        """,
        "params": {},
        "category": "Financial Analysis",
        "triggers": [
            "quarterly loss ratio", "quarter loss ratio trend",
            "loss ratio by quarter", "quarterly financial trend"
        ],
        "chart_type": "line",
        "is_aggregate": False,
    },

    "FI-007": {
        "id": "FI-007",
        "description": "Year-to-date premium written",
        "sql": """
            SELECT
                COUNT(*) AS ytd_policies,
                SUM(premium) AS ytd_premium
            FROM policies
            WHERE strftime('%Y', effective_date) = strftime('%Y', 'now')
        """,
        "params": {},
        "category": "Financial Analysis",
        "triggers": [
            "ytd premium", "year to date premium", "this year premium",
            "premium this year"
        ],
        "chart_type": "metric",
        "is_aggregate": True,
    },

    "FI-008": {
        "id": "FI-008",
        "description": "Year-to-date claims paid",
        "sql": """
            SELECT
                COUNT(*) AS ytd_claims,
                SUM(claim_amount) AS ytd_claims_amount
            FROM claims
            WHERE strftime('%Y', claim_date) = strftime('%Y', 'now')
        """,
        "params": {},
        "category": "Financial Analysis",
        "triggers": [
            "ytd claims", "year to date claims paid", "this year claims",
            "claims this year amount"
        ],
        "chart_type": "metric",
        "is_aggregate": True,
    },

    "FI-009": {
        "id": "FI-009",
        "description": "Financial exposure from open/pending claims",
        "sql": """
            SELECT
                COUNT(*) AS open_claim_count,
                SUM(claim_amount) AS open_claim_exposure
            FROM claims
            WHERE LOWER(status) IN ('open', 'pending', 'under review')
        """,
        "params": {},
        "category": "Financial Analysis",
        "triggers": [
            "pending exposure", "open claim exposure", "financial exposure",
            "outstanding liability", "claims liability"
        ],
        "chart_type": "metric",
        "is_aggregate": True,
    },

    "FI-010": {
        "id": "FI-010",
        "description": "Revenue at risk from policies expiring in the next 90 days",
        "sql": """
            SELECT
                COUNT(*) AS expiring_count,
                SUM(premium) AS premium_at_risk
            FROM policies
            WHERE expiration_date BETWEEN date('now') AND date('now', '+90 days')
        """,
        "params": {},
        "category": "Financial Analysis",
        "triggers": [
            "revenue at risk", "premium at risk", "expiring revenue",
            "renewal revenue", "premium renewal risk"
        ],
        "chart_type": "metric",
        "is_aggregate": True,
    },


    # =========================================================================
    # DECISIONS ANALYSIS (DE) - Underwriting decisions tracking
    # =========================================================================

    "DE-001": {
        "id": "DE-001",
        "description": "Summary count of all decisions by type (accept/refer/decline)",
        "sql": """
            SELECT
                decision,
                COUNT(*) AS count,
                ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM decisions), 2) AS percentage
            FROM decisions
            GROUP BY decision
            ORDER BY count DESC
        """,
        "params": {},
        "category": "Decisions Analysis",
        "triggers": [
            "decision summary", "decisions breakdown", "accept decline refer",
            "underwriting decisions", "decision counts", "how many accepted declined"
        ],
        "chart_type": "pie",
        "is_aggregate": False,
    },

    "DE-002": {
        "id": "DE-002",
        "description": "List of all accepted policies with their risk levels",
        "sql": """
            SELECT
                d.policy_number, d.decision, d.risk_level,
                d.reason, d.decided_by, d.created_at,
                p.policyholder_name, p.industry_type, p.premium
            FROM decisions d
            JOIN policies p ON p.policy_number = d.policy_number
            WHERE LOWER(d.decision) = 'accept'
            ORDER BY d.created_at DESC
        """,
        "params": {},
        "category": "Decisions Analysis",
        "triggers": [
            "accepted policies", "accepted decisions", "list accepted",
            "which policies accepted"
        ],
        "chart_type": "table",
        "is_aggregate": False,
    },

    "DE-003": {
        "id": "DE-003",
        "description": "List of all declined policies with reasons",
        "sql": """
            SELECT
                d.policy_number, d.decision, d.risk_level,
                d.reason, d.decided_by, d.created_at,
                p.policyholder_name, p.industry_type, p.premium
            FROM decisions d
            JOIN policies p ON p.policy_number = d.policy_number
            WHERE LOWER(d.decision) = 'decline'
            ORDER BY d.created_at DESC
        """,
        "params": {},
        "category": "Decisions Analysis",
        "triggers": [
            "declined policies", "declined decisions", "list declined",
            "which policies declined", "rejected policies"
        ],
        "chart_type": "table",
        "is_aggregate": False,
    },

    "DE-004": {
        "id": "DE-004",
        "description": "List of all referred policies awaiting senior review",
        "sql": """
            SELECT
                d.policy_number, d.decision, d.risk_level,
                d.reason, d.decided_by, d.created_at,
                p.policyholder_name, p.industry_type, p.premium
            FROM decisions d
            JOIN policies p ON p.policy_number = d.policy_number
            WHERE LOWER(d.decision) = 'refer'
            ORDER BY d.created_at DESC
        """,
        "params": {},
        "category": "Decisions Analysis",
        "triggers": [
            "referred policies", "refer decisions", "list referred",
            "policies for review", "under review policies"
        ],
        "chart_type": "table",
        "is_aggregate": False,
    },

    "DE-005": {
        "id": "DE-005",
        "description": "Decisions made this calendar month",
        "sql": """
            SELECT
                d.policy_number, d.decision, d.risk_level,
                d.decided_by, d.created_at, p.policyholder_name
            FROM decisions d
            JOIN policies p ON p.policy_number = d.policy_number
            WHERE strftime('%Y-%m', d.created_at) = strftime('%Y-%m', 'now')
            ORDER BY d.created_at DESC
        """,
        "params": {},
        "category": "Decisions Analysis",
        "triggers": [
            "decisions this month", "monthly decisions", "recent decisions",
            "decisions in current month"
        ],
        "chart_type": "table",
        "is_aggregate": False,
    },

    "DE-006": {
        "id": "DE-006",
        "description": "Decisions grouped by risk level",
        "sql": """
            SELECT
                risk_level,
                COUNT(*) AS count,
                GROUP_CONCAT(DISTINCT decision) AS decision_types
            FROM decisions
            GROUP BY risk_level
            ORDER BY count DESC
        """,
        "params": {},
        "category": "Decisions Analysis",
        "triggers": [
            "decisions by risk level", "risk level decisions",
            "decisions risk breakdown"
        ],
        "chart_type": "bar",
        "is_aggregate": False,
    },

    "DE-007": {
        "id": "DE-007",
        "description": "10 most recent underwriting decisions",
        "sql": """
            SELECT
                d.policy_number, d.decision, d.risk_level,
                d.reason, d.decided_by, d.created_at
            FROM decisions d
            ORDER BY d.created_at DESC
            LIMIT 10
        """,
        "params": {},
        "category": "Decisions Analysis",
        "triggers": [
            "recent decisions", "latest decisions", "last 10 decisions",
            "most recent decisions", "newest decisions"
        ],
        "chart_type": "table",
        "is_aggregate": False,
    },

    "DE-008": {
        "id": "DE-008",
        "description": "Acceptance rate as a percentage of all decisions",
        "sql": """
            SELECT
                COUNT(*) AS total_decisions,
                SUM(CASE WHEN LOWER(decision) = 'accept' THEN 1 ELSE 0 END) AS accepted,
                ROUND(SUM(CASE WHEN LOWER(decision) = 'accept' THEN 1 ELSE 0 END) * 100.0
                      / COUNT(*), 2) AS acceptance_rate_pct
            FROM decisions
        """,
        "params": {},
        "category": "Decisions Analysis",
        "triggers": [
            "acceptance rate", "how many accepted percentage",
            "accept rate", "approval rate"
        ],
        "chart_type": "metric",
        "is_aggregate": True,
    },

    "DE-009": {
        "id": "DE-009",
        "description": "Decisions made by each underwriter",
        "sql": """
            SELECT
                decided_by,
                COUNT(*) AS total_decisions,
                SUM(CASE WHEN LOWER(decision) = 'accept' THEN 1 ELSE 0 END) AS accepted,
                SUM(CASE WHEN LOWER(decision) = 'decline' THEN 1 ELSE 0 END) AS declined,
                SUM(CASE WHEN LOWER(decision) = 'refer' THEN 1 ELSE 0 END) AS referred
            FROM decisions
            GROUP BY decided_by
            ORDER BY total_decisions DESC
        """,
        "params": {},
        "category": "Decisions Analysis",
        "triggers": [
            "decisions by user", "who made decisions", "underwriter decisions",
            "decisions by underwriter", "user decision stats"
        ],
        "chart_type": "table",
        "is_aggregate": False,
    },

    "DE-010": {
        "id": "DE-010",
        "description": "Policies that have not yet received any underwriting decision",
        "sql": """
            SELECT
                p.policy_number, p.policyholder_name, p.industry_type,
                p.premium, p.effective_date
            FROM policies p
            LEFT JOIN decisions d ON p.policy_number = d.policy_number
            WHERE d.id IS NULL
            ORDER BY p.premium DESC
        """,
        "params": {},
        "category": "Decisions Analysis",
        "triggers": [
            "policies awaiting decision", "no decision yet", "undecided policies",
            "policies without decision", "pending underwriting"
        ],
        "chart_type": "table",
        "is_aggregate": False,
    },


    # =========================================================================
    # GEOGRAPHIC RISK (GE) - Location-based analysis
    # =========================================================================

    "GE-001": {
        "id": "GE-001",
        "description": "All policies with geographic coordinates (for map rendering)",
        "sql": """
            SELECT
                p.policy_number, p.policyholder_name, p.industry_type,
                p.premium, p.latitude, p.longitude,
                COUNT(c.id) AS claim_count,
                COALESCE(SUM(c.claim_amount), 0) AS total_claims,
                CASE
                    WHEN COUNT(c.id) >= 5 OR COALESCE(SUM(c.claim_amount), 0) >= 100000 THEN 'high'
                    WHEN COUNT(c.id) BETWEEN 2 AND 4 THEN 'medium'
                    ELSE 'low'
                END AS risk_level
            FROM policies p
            LEFT JOIN claims c ON p.id = c.policy_id
            WHERE p.latitude IS NOT NULL AND p.longitude IS NOT NULL
            GROUP BY p.id
        """,
        "params": {},
        "category": "Geographic Risk",
        "triggers": [
            "map", "geographic risk", "risk map", "policy locations",
            "geo risk", "risk geography", "map view", "location risk",
            "where are policies", "geographic distribution"
        ],
        "chart_type": "map",
        "is_aggregate": False,
    },

    "GE-002": {
        "id": "GE-002",
        "description": "High-premium policies with location data (for risk map focus)",
        "sql": """
            SELECT
                p.policy_number, p.policyholder_name, p.industry_type,
                p.premium, p.latitude, p.longitude
            FROM policies p
            WHERE p.latitude IS NOT NULL AND p.longitude IS NOT NULL
              AND p.premium > 50000
            ORDER BY p.premium DESC
        """,
        "params": {},
        "category": "Geographic Risk",
        "triggers": [
            "high premium location", "large policy locations",
            "premium geographic", "high value policy map"
        ],
        "chart_type": "map",
        "is_aggregate": False,
    },

    "GE-003": {
        "id": "GE-003",
        "description": "Policies missing geographic location data",
        "sql": """
            SELECT policy_number, policyholder_name, industry_type, premium
            FROM policies
            WHERE latitude IS NULL OR longitude IS NULL
            ORDER BY premium DESC
        """,
        "params": {},
        "category": "Geographic Risk",
        "triggers": [
            "missing location", "no coordinates", "policies without location",
            "location data missing"
        ],
        "chart_type": "table",
        "is_aggregate": False,
    },

    "GE-004": {
        "id": "GE-004",
        "description": "High-risk policies with location (for risk heat map)",
        "sql": """
            SELECT
                p.policy_number, p.policyholder_name,
                p.latitude, p.longitude, p.premium,
                COUNT(c.id) AS claim_count,
                COALESCE(SUM(c.claim_amount), 0) AS total_claims
            FROM policies p
            JOIN claims c ON p.id = c.policy_id
            WHERE p.latitude IS NOT NULL AND p.longitude IS NOT NULL
            GROUP BY p.id
            HAVING claim_count >= 3 OR total_claims >= 50000
            ORDER BY total_claims DESC
        """,
        "params": {},
        "category": "Geographic Risk",
        "triggers": [
            "risk heat map", "high risk locations", "risky areas",
            "where are high risk policies"
        ],
        "chart_type": "map",
        "is_aggregate": False,
    },

    "GE-005": {
        "id": "GE-005",
        "description": "Portfolio coverage - policies with vs without location data",
        "sql": """
            SELECT
                CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL
                     THEN 'Has Location' ELSE 'No Location' END AS location_status,
                COUNT(*) AS policy_count,
                SUM(premium) AS total_premium
            FROM policies
            GROUP BY location_status
        """,
        "params": {},
        "category": "Geographic Risk",
        "triggers": [
            "location data coverage", "how many policies have location",
            "geo data completeness"
        ],
        "chart_type": "pie",
        "is_aggregate": False,
    },


    # =========================================================================
    # TIME TRENDS (TR) - Temporal analysis
    # =========================================================================

    "TR-001": {
        "id": "TR-001",
        "description": "Claims trend by year",
        "sql": """
            SELECT
                strftime('%Y', claim_date) AS year,
                COUNT(*) AS claim_count,
                SUM(claim_amount) AS total_amount
            FROM claims
            GROUP BY year
            ORDER BY year ASC
        """,
        "params": {},
        "category": "Time Trends",
        "triggers": [
            "claims by year", "yearly claims", "annual claims trend",
            "claims year over year"
        ],
        "chart_type": "bar",
        "is_aggregate": False,
    },

    "TR-002": {
        "id": "TR-002",
        "description": "Monthly claim volume for the last 12 months",
        "sql": """
            SELECT
                strftime('%Y-%m', claim_date) AS month,
                COUNT(*) AS claim_count
            FROM claims
            WHERE claim_date >= date('now', '-12 months')
            GROUP BY month
            ORDER BY month ASC
        """,
        "params": {},
        "category": "Time Trends",
        "triggers": [
            "monthly claim volume", "claim volume trend", "claims per month"
        ],
        "chart_type": "line",
        "is_aggregate": False,
    },

    "TR-003": {
        "id": "TR-003",
        "description": "Monthly claims amount for the last 12 months",
        "sql": """
            SELECT
                strftime('%Y-%m', claim_date) AS month,
                SUM(claim_amount) AS total_amount
            FROM claims
            WHERE claim_date >= date('now', '-12 months')
            GROUP BY month
            ORDER BY month ASC
        """,
        "params": {},
        "category": "Time Trends",
        "triggers": [
            "monthly claims amount", "claim amount trend", "claims dollars by month"
        ],
        "chart_type": "line",
        "is_aggregate": False,
    },

    "TR-004": {
        "id": "TR-004",
        "description": "Quarterly comparison of premium vs claims",
        "sql": """
            SELECT
                strftime('%Y', claim_date) || '-Q' ||
                    CASE
                        WHEN strftime('%m', claim_date) <= '03' THEN '1'
                        WHEN strftime('%m', claim_date) <= '06' THEN '2'
                        WHEN strftime('%m', claim_date) <= '09' THEN '3'
                        ELSE '4'
                    END AS quarter,
                COUNT(id) AS claims,
                SUM(claim_amount) AS total_claims
            FROM claims
            GROUP BY quarter
            ORDER BY quarter ASC
        """,
        "params": {},
        "category": "Time Trends",
        "triggers": [
            "quarterly comparison", "premium vs claims quarterly",
            "quarter by quarter", "quarterly financial"
        ],
        "chart_type": "bar",
        "is_aggregate": False,
    },

    "TR-005": {
        "id": "TR-005",
        "description": "New policies added per month this year",
        "sql": """
            SELECT
                strftime('%Y-%m', created_at) AS month,
                COUNT(*) AS new_policies,
                SUM(premium) AS new_premium
            FROM policies
            WHERE strftime('%Y', created_at) = strftime('%Y', 'now')
            GROUP BY month
            ORDER BY month ASC
        """,
        "params": {},
        "category": "Time Trends",
        "triggers": [
            "new policies per month", "policies added monthly",
            "policy growth this year", "monthly new business"
        ],
        "chart_type": "bar",
        "is_aggregate": False,
    },

    "TR-006": {
        "id": "TR-006",
        "description": "Claims filed by day of the week (pattern analysis)",
        "sql": """
            SELECT
                CASE strftime('%w', claim_date)
                    WHEN '0' THEN 'Sunday'
                    WHEN '1' THEN 'Monday'
                    WHEN '2' THEN 'Tuesday'
                    WHEN '3' THEN 'Wednesday'
                    WHEN '4' THEN 'Thursday'
                    WHEN '5' THEN 'Friday'
                    WHEN '6' THEN 'Saturday'
                END AS day_of_week,
                COUNT(*) AS claim_count
            FROM claims
            GROUP BY strftime('%w', claim_date)
            ORDER BY strftime('%w', claim_date)
        """,
        "params": {},
        "category": "Time Trends",
        "triggers": [
            "claims by day", "day of week claims", "which day most claims",
            "claim day pattern", "weekly claims pattern"
        ],
        "chart_type": "bar",
        "is_aggregate": False,
    },

    "TR-007": {
        "id": "TR-007",
        "description": "Year-over-year claim count comparison",
        "sql": """
            SELECT
                strftime('%Y', claim_date) AS year,
                COUNT(*) AS claim_count,
                SUM(claim_amount) AS total_amount,
                ROUND(AVG(claim_amount), 2) AS avg_amount
            FROM claims
            GROUP BY year
            ORDER BY year DESC
        """,
        "params": {},
        "category": "Time Trends",
        "triggers": [
            "year over year", "yoy comparison", "annual comparison",
            "compare years", "year comparison claims"
        ],
        "chart_type": "bar",
        "is_aggregate": False,
    },

    "TR-008": {
        "id": "TR-008",
        "description": "Loss ratio trend by quarter",
        "sql": """
            SELECT
                strftime('%Y', c.claim_date) || '-Q' ||
                    CASE
                        WHEN strftime('%m', c.claim_date) <= '03' THEN '1'
                        WHEN strftime('%m', c.claim_date) <= '06' THEN '2'
                        WHEN strftime('%m', c.claim_date) <= '09' THEN '3'
                        ELSE '4'
                    END AS quarter,
                SUM(c.claim_amount) AS claims_in_quarter,
                COUNT(c.id) AS claim_count
            FROM claims c
            GROUP BY quarter
            ORDER BY quarter ASC
        """,
        "params": {},
        "category": "Time Trends",
        "triggers": [
            "loss ratio trend", "quarterly loss ratio", "loss ratio over time",
            "loss trend"
        ],
        "chart_type": "line",
        "is_aggregate": False,
    },

    "TR-009": {
        "id": "TR-009",
        "description": "YTD metrics compared to full previous year",
        "sql": """
            SELECT
                'Current YTD' AS period,
                COUNT(*) AS claim_count,
                SUM(claim_amount) AS total_amount
            FROM claims
            WHERE strftime('%Y', claim_date) = strftime('%Y', 'now')
            UNION ALL
            SELECT
                'Previous Year' AS period,
                COUNT(*) AS claim_count,
                SUM(claim_amount) AS total_amount
            FROM claims
            WHERE strftime('%Y', claim_date) = CAST(strftime('%Y', 'now') AS INTEGER) - 1
        """,
        "params": {},
        "category": "Time Trends",
        "triggers": [
            "ytd comparison", "current year vs last year",
            "this year vs previous", "year comparison"
        ],
        "chart_type": "bar",
        "is_aggregate": False,
    },

    "TR-010": {
        "id": "TR-010",
        "description": "Monthly decisions trend",
        "sql": """
            SELECT
                strftime('%Y-%m', created_at) AS month,
                COUNT(*) AS total_decisions,
                SUM(CASE WHEN LOWER(decision) = 'accept' THEN 1 ELSE 0 END) AS accepted,
                SUM(CASE WHEN LOWER(decision) = 'decline' THEN 1 ELSE 0 END) AS declined,
                SUM(CASE WHEN LOWER(decision) = 'refer' THEN 1 ELSE 0 END) AS referred
            FROM decisions
            GROUP BY month
            ORDER BY month ASC
        """,
        "params": {},
        "category": "Time Trends",
        "triggers": [
            "decisions trend", "monthly decisions", "decision trend over time",
            "decisions by month"
        ],
        "chart_type": "line",
        "is_aggregate": False,
    },


    # =========================================================================
    # ENTITY LOOKUPS (EN) - Specific entity queries (parameterized)
    # =========================================================================

    "EN-001": {
        "id": "EN-001",
        "description": "Full policy detail for a specific policy number",
        "sql": """
            SELECT
                p.policy_number, p.policyholder_name, p.industry_type,
                p.premium, p.effective_date, p.expiration_date,
                p.latitude, p.longitude,
                COUNT(c.id) AS claim_count,
                COALESCE(SUM(c.claim_amount), 0) AS total_claims,
                ROUND(COALESCE(SUM(c.claim_amount), 0) / NULLIF(p.premium, 0) * 100, 2) AS loss_ratio_pct
            FROM policies p
            LEFT JOIN claims c ON p.id = c.policy_id
            WHERE p.policy_number = :policy_number
            GROUP BY p.id
        """,
        "params": {"policy_number": "Policy number (e.g. COMM-2024-016)"},
        "category": "Entity Lookups",
        "triggers": [
            "policy detail", "show policy", "tell me about policy"
        ],
        "chart_type": "card",
        "is_aggregate": True,
    },

    "EN-002": {
        "id": "EN-002",
        "description": "All claims for a specific policy number",
        "sql": """
            SELECT
                c.claim_number, c.claim_date, c.claim_amount,
                c.claim_type, c.status, c.description, c.evidence_files
            FROM claims c
            JOIN policies p ON p.id = c.policy_id
            WHERE p.policy_number = :policy_number
            ORDER BY c.claim_date DESC
        """,
        "params": {"policy_number": "Policy number (e.g. COMM-2024-016)"},
        "category": "Entity Lookups",
        "triggers": [
            "claims for policy", "policy claims history"
        ],
        "chart_type": "table",
        "is_aggregate": False,
    },

    "EN-003": {
        "id": "EN-003",
        "description": "Decision history for a specific policy",
        "sql": """
            SELECT
                d.decision, d.risk_level, d.reason,
                d.decided_by, d.created_at
            FROM decisions d
            WHERE d.policy_number = :policy_number
            ORDER BY d.created_at DESC
        """,
        "params": {"policy_number": "Policy number (e.g. COMM-2024-016)"},
        "category": "Entity Lookups",
        "triggers": [],
        "chart_type": "table",
        "is_aggregate": False,
    },

    "EN-004": {
        "id": "EN-004",
        "description": "Full claim detail for a specific claim number",
        "sql": """
            SELECT
                c.claim_number, c.claim_date, c.claim_amount, c.claim_type,
                c.status, c.description, c.evidence_files,
                p.policy_number, p.policyholder_name, p.industry_type, p.premium
            FROM claims c
            JOIN policies p ON p.id = c.policy_id
            WHERE c.claim_number = :claim_number
        """,
        "params": {"claim_number": "Claim number (e.g. CLM-2024-001)"},
        "category": "Entity Lookups",
        "triggers": [],
        "chart_type": "card",
        "is_aggregate": True,
    },

    "EN-005": {
        "id": "EN-005",
        "description": "Underwriting guidelines by category",
        "sql": """
            SELECT section_code, title, content, category, action
            FROM guidelines
            WHERE category = :category
            ORDER BY section_code
        """,
        "params": {"category": "Guideline category"},
        "category": "Entity Lookups",
        "triggers": [],
        "chart_type": "table",
        "is_aggregate": False,
    },

    "EN-006": {
        "id": "EN-006",
        "description": "All underwriting guidelines (full list)",
        "sql": """
            SELECT section_code, title, category, threshold_type, threshold_value, action
            FROM guidelines
            ORDER BY category, section_code
        """,
        "params": {},
        "category": "Entity Lookups",
        "triggers": [
            "all guidelines", "underwriting guidelines", "show guidelines",
            "list guidelines", "guidelines"
        ],
        "chart_type": "table",
        "is_aggregate": False,
    },

    "EN-007": {
        "id": "EN-007",
        "description": "Claims with evidence files for a specific policy",
        "sql": """
            SELECT
                c.claim_number, c.claim_date, c.claim_amount,
                c.claim_type, c.status, c.evidence_files
            FROM claims c
            JOIN policies p ON p.id = c.policy_id
            WHERE p.policy_number = :policy_number
              AND c.evidence_files IS NOT NULL
              AND c.evidence_files != '[]'
            ORDER BY c.claim_date DESC
        """,
        "params": {"policy_number": "Policy number"},
        "category": "Entity Lookups",
        "triggers": [],
        "chart_type": "table",
        "is_aggregate": False,
    },

    "EN-008": {
        "id": "EN-008",
        "description": "All users and their roles",
        "sql": """
            SELECT full_name, email, role, is_active, created_at, last_login
            FROM users
            ORDER BY role, full_name
        """,
        "params": {},
        "category": "Entity Lookups",
        "triggers": [
            "list users", "all users", "team members", "who has access"
        ],
        "chart_type": "table",
        "is_aggregate": False,
    },

    "EN-009": {
        "id": "EN-009",
        "description": "Recently uploaded documents",
        "sql": """
            SELECT filename, file_type, file_size, uploaded_by,
                   analysis_summary, created_at
            FROM documents
            ORDER BY created_at DESC
            LIMIT 20
        """,
        "params": {},
        "category": "Entity Lookups",
        "triggers": [
            "uploaded documents", "recent documents", "files uploaded",
            "documents list"
        ],
        "chart_type": "table",
        "is_aggregate": False,
    },

    "EN-010": {
        "id": "EN-010",
        "description": "Full join: policies + claims summary + decisions (complete portfolio view)",
        "sql": """
            SELECT
                p.policy_number, p.policyholder_name, p.industry_type,
                p.premium, p.effective_date, p.expiration_date,
                COUNT(c.id) AS claim_count,
                COALESCE(SUM(c.claim_amount), 0) AS total_claims,
                ROUND(COALESCE(SUM(c.claim_amount), 0) / NULLIF(p.premium, 0) * 100, 2) AS loss_ratio_pct,
                d.decision, d.risk_level, d.decided_by
            FROM policies p
            LEFT JOIN claims c ON p.id = c.policy_id
            LEFT JOIN decisions d ON p.policy_number = d.policy_number
            GROUP BY p.id
            ORDER BY total_claims DESC
        """,
        "params": {},
        "category": "Entity Lookups",
        "triggers": [
            "full portfolio view", "complete portfolio", "all policies with claims and decisions",
            "portfolio with decisions"
        ],
        "chart_type": "table",
        "is_aggregate": False,
    },
}


# ---------------------------------------------------------------------------
# Trigger Matcher — Tier 1 Query Library lookup
# ---------------------------------------------------------------------------

def match_query(message: str) -> Optional[Tuple[str, Dict[str, Any]]]:
    """
    Match a user message to the best query in the library.
    Returns (query_id, query_entry) or None if no match found.

    Matching strategy:
      1. Exact trigger phrase match (highest confidence)
      2. Multi-word keyword overlap scoring
      3. Return best match above threshold score
    """
    lower = message.lower().strip()

    # Pass 1: Exact trigger phrase match
    for qid, entry in QUERY_LIBRARY.items():
        for trigger in entry["triggers"]:
            if trigger in lower:
                return qid, entry

    # Pass 2: Keyword overlap scoring
    best_score = 0
    best_match = None
    msg_words = set(re.findall(r'\b\w+\b', lower))

    for qid, entry in QUERY_LIBRARY.items():
        all_trigger_words: set = set()
        for trigger in entry["triggers"]:
            all_trigger_words.update(re.findall(r'\b\w+\b', trigger))

        if not all_trigger_words:
            continue

        overlap = len(msg_words & all_trigger_words)
        score = overlap / len(all_trigger_words)

        if score > best_score and overlap >= 2:
            best_score = score
            best_match = (qid, entry)

    # Threshold: at least 40% keyword overlap with 2+ matching words
    if best_match and best_score >= 0.4:
        return best_match

    return None


def get_library_sql(message: str) -> Optional[Tuple[str, str, str]]:
    """
    High-level API: match message → return (query_id, sql, chart_type).
    Returns None if no match. Does NOT execute — caller executes SQL.
    Parameterized queries (with :param slots) returned as-is;
    caller must extract params from message via regex.
    """
    result = match_query(message)
    if result is None:
        return None
    qid, entry = result
    return qid, entry["sql"], entry.get("chart_type", "table")


def get_query_by_id(query_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve a query entry directly by its ID."""
    return QUERY_LIBRARY.get(query_id)


def list_queries_by_category() -> Dict[str, List[str]]:
    """Return a dict of category → list of query IDs, for documentation."""
    result: Dict[str, List[str]] = {}
    for qid, entry in QUERY_LIBRARY.items():
        cat = entry["category"]
        result.setdefault(cat, []).append(qid)
    return result
