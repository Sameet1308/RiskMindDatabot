
import pandas as pd
import sqlite3
import os
import re
from typing import Optional, Dict, Any, List

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "risk_mind.db")
# Fallback to data dir if needed
if not os.path.exists(DB_PATH):
    DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "riskmind.db")

class DataCube:
    _df: Optional[pd.DataFrame] = None
    _loaded = False

    @classmethod
    def load_data(cls):
        if cls._loaded:
            return

        try:
            conn = sqlite3.connect(DB_PATH)
            
            # Load Policies
            policies = pd.read_sql("SELECT * FROM policies", conn)
            # Load Claims
            claims = pd.read_sql("SELECT * FROM claims", conn)
            
            # Join (Left Join Policies -> Claims)
            # Ensure ID columns match. claims.policy_id -> policies.id
            if not policies.empty and not claims.empty:
                # Rename id to avoid collision
                policies = policies.rename(columns={"id": "policy_id_pk"})
                cls._df = pd.merge(claims, policies, left_on="policy_id", right_on="policy_id_pk", how="left")
                
                # Convert dates
                cls._df['claim_date'] = pd.to_datetime(cls._df['claim_date'], errors='coerce')
                cls._df['effective_date'] = pd.to_datetime(cls._df['effective_date'], errors='coerce')
            
            cls._loaded = True
            print(f"[DataCube] Loaded {len(cls._df) if cls._df is not None else 0} rows into memory.")
        except Exception as e:
            print(f"[DataCube] Error loading data: {e}")
            cls._df = pd.DataFrame()

    @classmethod
    def get_df(cls):
        if not cls._loaded:
            cls.load_data()
        return cls._df

    @classmethod
    def try_query(cls, message: str) -> Optional[Dict[str, Any]]:
        """
        Attempts to answer the query using cached DataFrames.
        Returns a dictionary matching the AnalysisObject structure if successful, else None.
        """
        df = cls.get_df()
        if df is None or df.empty:
            return None
            
        lower = message.lower()
        
        # 1. Trend of Claims (over time)
        if 'trend' in lower and 'claim' in lower:
            # Group by Month
            # df['month'] = df['claim_date'].dt.to_period('M') # Parsing might be tricky with SQLite strings
            # Use string slicing for speed if format is YYYY-MM-DD
            try:
                # Ensure datetime
                time_series = df.set_index('claim_date').resample('ME')['claim_amount'].sum().reset_index()
                time_series['month'] = time_series['claim_date'].dt.strftime('%Y-%m')
                time_series = time_series.sort_values('month')
                
                rows = time_series[['month', 'claim_amount']].rename(columns={'claim_amount': 'total_amount'}).to_dict('records')
                return cls._build_response(rows, ["month", "total_amount"], "Claim Trend (Cached)")
            except Exception as e:
                print(f"[DataCube] Trend error: {e}")
                return None

        # 2. Claims by Type
        if 'claim' in lower and ('type' in lower or 'distribution' in lower):
            summary = df.groupby('claim_type').agg(
                claim_count=('id', 'count'),
                total_amount=('claim_amount', 'sum')
            ).reset_index().sort_values('total_amount', ascending=False)
            
            rows = summary.to_dict('records')
            return cls._build_response(rows, ["claim_type", "claim_count", "total_amount"], "Claims by Type (Cached)")

        # 3. Policies by Industry
        if 'polic' in lower and 'industry' in lower:
            # We need to drop duplicates if we joined claims (as one policy has many claims)
            # So queries on policies should use the unique policy DF or dedup
            unique_policies = df.drop_duplicates(subset=['policy_number'])
            summary = unique_policies.groupby('industry_type').agg(
                policy_count=('policy_number', 'count'),
                total_premium=('premium', 'sum')
            ).reset_index().sort_values('total_premium', ascending=False)
            
            rows = summary.to_dict('records')
            return cls._build_response(rows, ["industry_type", "policy_count", "total_premium"], "Policies by Industry (Cached)")

        return None

    @staticmethod
    def _build_response(rows: List[Dict[str, Any]], columns: List[str], intent_desc: str) -> Dict[str, Any]:
        return {
            "analysis_object": {
                "context": {"intent": "ad_hoc_query", "source": "data_cube"},
                "metrics": {},
                "dimensions": {
                    "rows": rows,
                    "columns": columns
                },
                "evidence": [],
                "provenance": {
                     "tables_used": ["data_cube"],
                     "join_paths": [],
                     "query_ids": ["cached_dataframe"],
                     "generated_at": "now"
                }
            },
            "analysis_text": f"Generated {intent_desc} from cached data cube.",
            "output_type": "dashboard"
        }
