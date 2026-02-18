"""
Analytics Playground engine - pandas-based slice & dice over
policies + claims + decisions data.

Follows the same singleton pattern as data_cube.py.
"""
import pandas as pd
import sqlite3
import os
from typing import Any, Dict, List, Optional

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "riskmind.db")
if not os.path.exists(DB_PATH):
    DB_PATH = os.path.join(os.path.dirname(__file__), "..", "risk_mind.db")

# ── Metadata catalog ────────────────────────────────────────────

ANALYTICS_META: Dict[str, Any] = {
    "attributes": [
        {"key": "industry_type",      "label": "Industry"},
        {"key": "policyholder_name",  "label": "Policyholder"},
        {"key": "policy_number",      "label": "Policy Number"},
        {"key": "claim_type",         "label": "Claim Type"},
        {"key": "status",             "label": "Claim Status"},
        {"key": "risk_level",         "label": "Risk Level"},
        {"key": "claim_year",         "label": "Claim Year"},
        {"key": "claim_month",        "label": "Claim Month"},
        {"key": "decision",           "label": "Decision"},
    ],
    "metrics": [
        {"key": "claim_amount",  "label": "Claim Amount",    "agg": "sum"},
        {"key": "claim_count",   "label": "Claim Count",     "agg": "count"},
        {"key": "premium",       "label": "Premium",         "agg": "sum"},
        {"key": "loss_ratio",    "label": "Loss Ratio %",    "agg": "derived"},
        {"key": "avg_claim",     "label": "Avg Claim Size",  "agg": "derived"},
        {"key": "max_claim",     "label": "Max Claim",       "agg": "max"},
    ],
}


def _compute_risk(claim_count: int, total_amount: float) -> str:
    if claim_count >= 5 or total_amount >= 100_000:
        return "HIGH"
    if claim_count >= 2 or total_amount >= 50_000:
        return "MEDIUM"
    return "LOW"


class AnalyticsEngine:
    _df: Optional[pd.DataFrame] = None
    _loaded = False

    @classmethod
    def load(cls):
        if cls._loaded:
            return
        try:
            conn = sqlite3.connect(DB_PATH)

            policies = pd.read_sql("SELECT * FROM policies", conn)
            claims = pd.read_sql("SELECT * FROM claims", conn)
            decisions = pd.read_sql(
                "SELECT policy_number, decision FROM decisions", conn
            )
            conn.close()

            # Latest decision per policy
            if not decisions.empty:
                decisions = decisions.drop_duplicates(
                    subset=["policy_number"], keep="last"
                )

            # Join claims -> policies
            if not policies.empty and not claims.empty:
                policies_r = policies.rename(columns={"id": "policy_pk"})
                df = pd.merge(
                    claims,
                    policies_r,
                    left_on="policy_id",
                    right_on="policy_pk",
                    how="left",
                )
            elif not claims.empty:
                df = claims.copy()
            else:
                df = pd.DataFrame()

            # Left join latest decision
            if not df.empty and not decisions.empty:
                df = pd.merge(
                    df, decisions, on="policy_number", how="left"
                )
            elif not df.empty:
                df["decision"] = None

            # Derived columns
            if not df.empty:
                df["claim_date"] = pd.to_datetime(
                    df["claim_date"], errors="coerce"
                )
                df["claim_year"] = (
                    df["claim_date"].dt.year.fillna(0).astype(int).astype(str)
                )
                df["claim_month"] = df["claim_date"].dt.strftime("%Y-%m")

                # risk_level per row based on policy-level aggregates
                risk_map = {}
                for pn, grp in df.groupby("policy_number"):
                    cnt = len(grp)
                    total = grp["claim_amount"].sum()
                    risk_map[pn] = _compute_risk(cnt, total)
                df["risk_level"] = df["policy_number"].map(risk_map)

            cls._df = df
            cls._loaded = True
            row_count = len(df) if df is not None else 0
            print(f"[OK] Analytics engine loaded ({row_count} claim rows)")
        except Exception as e:
            print(f"[WARN] Analytics engine load failed: {e}")
            cls._df = pd.DataFrame()
            cls._loaded = True

    @classmethod
    def reload(cls):
        cls._loaded = False
        cls._df = None
        cls.load()

    @classmethod
    def get_meta(cls) -> Dict[str, Any]:
        return ANALYTICS_META

    @classmethod
    def get_filter_values(cls, field: str) -> List[str]:
        cls.load()
        if cls._df is None or cls._df.empty or field not in cls._df.columns:
            return []
        return sorted(cls._df[field].dropna().unique().astype(str).tolist())

    @classmethod
    def query(
        cls,
        dimensions: List[str],
        metrics: List[str],
        filters: Optional[List[Dict[str, Any]]] = None,
        user_email: Optional[str] = None,
    ) -> Dict[str, Any]:
        cls.load()
        if cls._df is None or cls._df.empty:
            return {"columns": [], "rows": [], "totals": {}, "row_count": 0}

        df = cls._df.copy()

        # User scoping
        if user_email and "assigned_to" in df.columns:
            df = df[df["assigned_to"] == user_email]

        # Apply filters
        if filters:
            for f in filters:
                field = f.get("field", "")
                op = f.get("op", "in")
                values = f.get("values", [])
                if field not in df.columns or not values:
                    continue
                if op == "in":
                    df = df[df[field].astype(str).isin([str(v) for v in values])]
                elif op == "not_in":
                    df = df[~df[field].astype(str).isin([str(v) for v in values])]

        if df.empty:
            return {"columns": [], "rows": [], "totals": {}, "row_count": 0}

        # Validate dimensions
        valid_dims = [d for d in dimensions if d in df.columns]
        if not valid_dims:
            return {"columns": [], "rows": [], "totals": {}, "row_count": 0}

        # Build aggregations
        agg_map = {}
        requested_base = set()
        for m in metrics:
            if m == "claim_amount":
                agg_map["claim_amount"] = ("claim_amount", "sum")
                requested_base.add("claim_amount")
            elif m == "claim_count":
                agg_map["claim_count"] = ("claim_amount", "count")
                requested_base.add("claim_count")
            elif m == "max_claim":
                agg_map["max_claim"] = ("claim_amount", "max")
                requested_base.add("max_claim")
            elif m in ("premium", "loss_ratio", "avg_claim"):
                # Need claim_amount sum for derived metrics
                if "claim_amount" not in agg_map:
                    agg_map["claim_amount"] = ("claim_amount", "sum")
                if "claim_count" not in agg_map:
                    agg_map["claim_count"] = ("claim_amount", "count")
                requested_base.add(m)

        if not agg_map:
            return {"columns": [], "rows": [], "totals": {}, "row_count": 0}

        grouped = df.groupby(valid_dims, dropna=False).agg(**agg_map).reset_index()

        # Premium: deduplicate per policy within each group
        need_premium = "premium" in requested_base or "loss_ratio" in requested_base
        if need_premium and "premium" in df.columns:
            prem_df = (
                df.drop_duplicates(subset=["policy_number"])
                .groupby(valid_dims, dropna=False)["premium"]
                .sum()
                .reset_index()
                .rename(columns={"premium": "premium"})
            )
            grouped = pd.merge(grouped, prem_df, on=valid_dims, how="left")
            grouped["premium"] = grouped["premium"].fillna(0)

        # Derived metrics
        if "loss_ratio" in requested_base:
            grouped["loss_ratio"] = grouped.apply(
                lambda r: round((r["claim_amount"] / r["premium"]) * 100, 1)
                if r.get("premium", 0) > 0
                else 0,
                axis=1,
            )

        if "avg_claim" in requested_base:
            grouped["avg_claim"] = grouped.apply(
                lambda r: round(r["claim_amount"] / r["claim_count"])
                if r.get("claim_count", 0) > 0
                else 0,
                axis=1,
            )

        # Select columns to return
        output_cols = list(valid_dims)
        metric_cols = []
        for m in metrics:
            if m in grouped.columns:
                metric_cols.append(m)
        output_cols += metric_cols

        result_df = grouped[output_cols].copy()

        # Sort by first metric descending
        if metric_cols:
            result_df = result_df.sort_values(metric_cols[0], ascending=False)

        # Compute totals
        totals = {}
        for m in metric_cols:
            if m == "loss_ratio":
                total_claims = result_df["claim_amount"].sum() if "claim_amount" in result_df.columns else 0
                total_prem = result_df["premium"].sum() if "premium" in result_df.columns else 0
                totals[m] = round((total_claims / total_prem) * 100, 1) if total_prem > 0 else 0
            elif m == "avg_claim":
                total_claims = result_df["claim_amount"].sum() if "claim_amount" in result_df.columns else 0
                total_count = result_df["claim_count"].sum() if "claim_count" in result_df.columns else 0
                totals[m] = round(total_claims / total_count) if total_count > 0 else 0
            elif m == "max_claim":
                totals[m] = float(result_df[m].max()) if not result_df.empty else 0
            else:
                totals[m] = float(result_df[m].sum()) if not result_df.empty else 0

        # Convert to records
        rows = result_df.fillna("").to_dict("records")
        # Cast numeric types for JSON serialization
        for row in rows:
            for k, v in row.items():
                if isinstance(v, (pd.Timestamp,)):
                    row[k] = str(v)
                elif hasattr(v, "item"):  # numpy scalar
                    row[k] = v.item()

        return {
            "columns": output_cols,
            "rows": rows,
            "totals": totals,
            "row_count": len(rows),
        }
