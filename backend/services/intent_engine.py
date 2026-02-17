"""
Intent-based orchestration: intent routing, SQL planning, execution,
analysis object creation, and renderer output.
"""
import re
import os
import json
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from services.join_context import JOIN_GRAPH, ENTITY_TABLES
from services.vector_store import search_similar

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
UPLOAD_DIR = os.path.join(BASE_DIR, "data", "uploads")

POLICY_REGEX = re.compile(r"(COMM-\d{4}-\d{3}|P-\d{4})", re.IGNORECASE)
CLAIM_REGEX = re.compile(r"(CLM-\d{4}-\d{3})", re.IGNORECASE)

CANONICAL_INTENTS = {
    "understand": "Understand",
    "analyze": "Analyze",
    "decide": "Decide",
    "document": "Document",
}


def _route_intent(message: str) -> Dict[str, Any]:
    lower = message.lower()
    policy_match = POLICY_REGEX.search(message)
    claim_match = CLAIM_REGEX.search(message)

    entity = "portfolio"
    if policy_match:
        entity = "policy"
    elif claim_match:
        entity = "claim"

    intent = "portfolio_summary"
    if entity == "policy":
        intent = "policy_risk_summary"
    elif entity == "claim":
        intent = "claim_summary"

    keep_portfolio = False
    if entity == "portfolio":
        if any(phrase in lower for phrase in [
            "how many policies",
            "total policies",
            "number of policies",
            "policy count",
        ]):
            intent = "portfolio_summary"
            keep_portfolio = True

    if any(word in lower for word in ["evidence", "photo", "video", "image", "pdf", "document", "report"]):
        intent = "policy_risk_summary" if policy_match else intent

    if not policy_match and not claim_match and intent == "portfolio_summary" and not keep_portfolio:
        if any(word in lower for word in ["list", "show", "count", "average", "total", "top", "highest", "lowest", "group", "by", "trend", "compare", "how many", "max", "most"]):
            intent = "ad_hoc_query"

    # Override: If specific visualization/trend keywords are used, force ad_hoc_query even for specific entities
    if any(word in lower for word in ["trend", "chart", "plot", "graph", "timeline", "over time", "by month", "by year", "scatter", "map", "geo"]):
        intent = "ad_hoc_query"

    required_metrics = ["claim_count", "total_amount", "avg_amount", "max_claim"]
    evidence_needed = intent in {"claim_summary", "policy_risk_summary"}

    canonical_intent = CANONICAL_INTENTS["understand"]
    output_type = "analysis"

    if any(word in lower for word in ["memo", "draft", "document", "write", "underwriting memo"]):
        canonical_intent = CANONICAL_INTENTS["document"]
        output_type = "memo"
    elif any(word in lower for word in ["should we", "renew", "accept", "decline", "refer", "decision"]):
        canonical_intent = CANONICAL_INTENTS["decide"]
        output_type = "card" if "card" in lower else "decision"
    elif any(word in lower for word in ["trend", "compare", "breakdown", "chart", "dashboard", "analysis", "analyze", "by "]):
        canonical_intent = CANONICAL_INTENTS["analyze"]
        output_type = "dashboard"
    elif intent == "ad_hoc_query":
        canonical_intent = CANONICAL_INTENTS["analyze"]
        output_type = "dashboard"

    recommended_modes: List[str] = []
    default_mode = output_type

    if canonical_intent == CANONICAL_INTENTS["understand"]:
        recommended_modes = ["analysis", "card", "memo"]
    elif canonical_intent == CANONICAL_INTENTS["analyze"]:
        recommended_modes = ["dashboard", "analysis", "card"]
    elif canonical_intent == CANONICAL_INTENTS["decide"]:
        recommended_modes = ["card", "decision", "memo"]
    elif canonical_intent == CANONICAL_INTENTS["document"]:
        recommended_modes = ["memo", "analysis", "card"]

    return {
        "intent": intent,
        "entities": {
            "policy_number": policy_match.group(1).upper() if policy_match else None,
            "claim_number": claim_match.group(1).upper() if claim_match else None,
            "entity": entity,
        },
        "required_metrics": required_metrics,
        "evidence_needed": evidence_needed,
        "recommended_modes": recommended_modes,
        "default_mode": default_mode,
        "canonical_intent": canonical_intent,
        "output_type": output_type,
    }


def _sql_plan(intent: str, entities: Dict[str, Any]) -> Dict[str, Any]:
    plans: List[Dict[str, Any]] = []
    tables_used: List[str] = []
    join_paths: List[str] = []

    policy_number = entities.get("policy_number")
    claim_number = entities.get("claim_number")

    if intent in {"policy_risk_summary", "evidence_blend"} and policy_number:
        plans.append({
            "id": "policy_summary",
            "sql": """
                SELECT p.policy_number, p.policyholder_name, p.industry_type, p.premium,
                       COUNT(c.id) as claim_count,
                       COALESCE(SUM(c.claim_amount), 0) as total_amount,
                       COALESCE(AVG(c.claim_amount), 0) as avg_amount,
                       COALESCE(MAX(c.claim_amount), 0) as max_claim
                FROM policies p
                LEFT JOIN claims c ON p.id = c.policy_id
                WHERE p.policy_number = :policy_number
                GROUP BY p.id
            """,
            "params": {"policy_number": policy_number},
        })
        plans.append({
            "id": "policy_claims",
            "sql": """
                SELECT c.claim_number, c.claim_date, c.claim_amount, c.claim_type, c.status, c.evidence_files
                FROM claims c
                JOIN policies p ON p.id = c.policy_id
                WHERE p.policy_number = :policy_number
                ORDER BY c.claim_date DESC
            """,
            "params": {"policy_number": policy_number},
        })
        tables_used.extend(["policies", "claims"])
        join_paths.append(JOIN_GRAPH["policies"]["claims"])

    if intent == "claim_summary" and claim_number:
        plans.append({
            "id": "claim_detail",
            "sql": """
                SELECT c.claim_number, c.claim_date, c.claim_amount, c.claim_type, c.status, c.evidence_files,
                       p.policy_number, p.policyholder_name, p.premium
                FROM claims c
                JOIN policies p ON p.id = c.policy_id
                WHERE c.claim_number = :claim_number
            """,
            "params": {"claim_number": claim_number},
        })
        tables_used.extend(["claims", "policies"])
        join_paths.append(JOIN_GRAPH["claims"]["policies"])

    if intent == "portfolio_summary":
        plans.append({
            "id": "portfolio_summary",
            "sql": """
                SELECT COUNT(*) as policy_count,
                       COALESCE(SUM(premium), 0) as total_premium
                FROM policies
            """,
            "params": {},
        })
        plans.append({
            "id": "portfolio_claims",
            "sql": """
                SELECT COUNT(*) as claim_count,
                       COALESCE(SUM(claim_amount), 0) as total_amount,
                       COALESCE(AVG(claim_amount), 0) as avg_amount,
                       COALESCE(MAX(claim_amount), 0) as max_claim
                FROM claims
            """,
            "params": {},
        })
        tables_used.extend(["policies", "claims"])

    if intent == "geo_risk":
        plans.append({
            "id": "geo_policies",
            "sql": """
                SELECT policy_number, policyholder_name, industry_type, premium,
                       latitude, longitude, risk_level
                FROM policies
                WHERE latitude IS NOT NULL AND longitude IS NOT NULL
            """,
            "params": {},
        })
        tables_used.extend(["policies"])

    provenance = {
        "tables_used": sorted(set(tables_used)),
        "join_paths": sorted(set(join_paths)),
        "query_ids": [p["id"] for p in plans],
    }

    return {"sql_plan": plans, "provenance": provenance}


def _extract_tables(sql: str) -> List[str]:
    tables = re.findall(r"\bfrom\s+([a-zA-Z_][a-zA-Z0-9_]*)|\bjoin\s+([a-zA-Z_][a-zA-Z0-9_]*)", sql, re.IGNORECASE)
    extracted = []
    for a, b in tables:
        if a:
            extracted.append(a.lower())
        if b:
            extracted.append(b.lower())
    return list(dict.fromkeys(extracted))


def _clean_sql(raw: str) -> str:
    if not raw:
        return ""

    cleaned = raw.strip()
    if "```" in cleaned:
        parts = re.split(r"```(?:sql)?", cleaned, flags=re.IGNORECASE)
        cleaned = "".join(parts).strip()

    match = re.search(r"select\b.*", cleaned, re.IGNORECASE | re.DOTALL)
    if not match:
        return cleaned

    sql = match.group(0)
    if "```" in sql:
        sql = sql.split("```")[0]
    if ";" in sql:
        sql = sql.split(";")[0] + ";"

    return sql.strip()


def _validate_sql(sql: str) -> Tuple[bool, str, List[str]]:
    sql_clean = sql.strip().strip(";")
    if not sql_clean.lower().startswith("select"):
        return False, "Only SELECT statements are allowed.", []
    forbidden = ["insert", "update", "delete", "drop", "alter", "pragma", "attach"]
    if any(word in sql_clean.lower() for word in forbidden):
        return False, "Unsafe SQL detected.", []

    tables = _extract_tables(sql_clean)
    allowed = set(JOIN_GRAPH.keys())
    if any(t not in allowed for t in tables):
        return False, f"Disallowed tables: {', '.join([t for t in tables if t not in allowed])}", tables

    return True, "", tables


def _resolve_local_path(item: Dict[str, Any]) -> Optional[str]:
    local_path = item.get("local_path")
    if local_path:
        return os.path.join(BASE_DIR, local_path)

    url = item.get("url")
    if url and url.startswith("/api/uploads/"):
        relative = url.replace("/api/uploads/", "")
        return os.path.join(UPLOAD_DIR, relative)

    return None


def _should_analyze_evidence(message: str, evidence: List[Dict[str, Any]]) -> bool:
    if not evidence:
        return False
    lower = message.lower()
    evidence_keywords = ["evidence", "photo", "video", "image", "pdf", "document", "report"]
    analysis_keywords = ["analyze", "explain", "what does", "what shows", "summarize", "describe", "findings"]
    return any(k in lower for k in evidence_keywords) and any(k in lower for k in analysis_keywords)


async def _auto_analyze_evidence(evidence: List[Dict[str, Any]], max_items: int = 2) -> None:
    # Local import to avoid circular dependency with routers.chat
    from routers.chat import _analyze_video, _analyze_image, _analyze_pdf
    analyzed = 0
    for item in evidence:
        if analyzed >= max_items:
            break

        item_type = (item.get("type") or "").lower()
        if item.get("analysis_summary"):
            continue

        local_file = _resolve_local_path(item)
        if not local_file or not os.path.exists(local_file):
            if item.get("url") and item.get("url").startswith("http"):
                item["analysis_summary"] = "External evidence requires upload for AI analysis."
            continue

        try:
            if item_type == "video":
                item["analysis_summary"] = await _analyze_video(local_file, "Analyze this video for underwriting risks and notable hazards.")
            elif item_type in {"image", "photo"}:
                item["analysis_summary"] = await _analyze_image(local_file, "Analyze this image for underwriting risk context.", is_file=True)
            elif item_type == "pdf" or local_file.lower().endswith(".pdf"):
                item["analysis_summary"] = await _analyze_pdf(local_file)
            else:
                item["analysis_summary"] = "Unsupported evidence type for auto analysis."
        except Exception as e:
            item["analysis_summary"] = f"Evidence analysis failed: {str(e)}"

        analyzed += 1


def _try_simple_query_pattern(message: str) -> Optional[str]:
    """
    Handle common simple queries with pre-built SQL patterns.
    This provides fallback for when LLM is unavailable or fails.
    """
    lower = message.lower()
    
    # Simple list/show queries
    if re.match(r'^(show|list|get|display|view|give\s+me|what\s+are).*claims?.*$', lower):
        return "SELECT * FROM claims ORDER BY claim_date DESC LIMIT 50"
    
    if re.match(r'^(show|list|get|display|view|give\s+me|what\s+are).*polic(y|ies).*$', lower):
        return "SELECT * FROM policies ORDER BY effective_date DESC LIMIT 50"
    
    if re.match(r'^(show|list|get|display|view|give\s+me|what\s+are).*guideline.*$', lower):
        return "SELECT * FROM guidelines ORDER BY section_code LIMIT 50"
    
    if re.match(r'^(show|list|get|display|view|give\s+me|what\s+are).*decision.*$', lower):
        return "SELECT * FROM decisions ORDER BY created_at DESC LIMIT 50"
    
    # Specific field queries
    if any(pattern in lower for pattern in ['all claims', 'every claim', 'claims list']):
        return "SELECT * FROM claims ORDER BY claim_date DESC LIMIT 50"
    
    if any(pattern in lower for pattern in ['all policies', 'every policy', 'policies list']):
        return "SELECT * FROM policies ORDER BY effective_date DESC LIMIT 50"
    
    if 'high risk' in lower and 'polic' in lower:
        return "SELECT * FROM policies WHERE risk_level = 'high' ORDER BY premium DESC LIMIT 50"
    
    # Count queries
    if 'count' in lower and 'claim' in lower and 'by' in lower and ('policy' in lower or 'policyholder' in lower):
        return "SELECT policy_number, COUNT(claims.id) as claim_count FROM claims LEFT JOIN policies ON claims.policy_id = policies.id GROUP BY policy_number ORDER BY claim_count DESC"
    
    if 'total' in lower and 'claim' in lower and ('amount' in lower or 'value' in lower):
        return "SELECT SUM(claim_amount) as total_amount, COUNT(*) as claim_count FROM claims"
    
    if ('how many' in lower or 'count' in lower) and 'claim' in lower:
        return "SELECT COUNT(*) as total_claims FROM claims"
    
    if ('how many' in lower or 'count' in lower) and 'polic' in lower:
        return "SELECT COUNT(*) as total_policies FROM policies"
    
    return None


# In-memory cache for SQL generation (reduces API calls)
_sql_cache: Dict[str, str] = {}
_cache_max_size = 100

async def _generate_sql_llm(message: str) -> Optional[str]:
    # Tier 0: Dashboard / Analytic deterministic patterns (LLM Bypass)
    dashboard_sql = _try_dashboard_query_pattern(message)
    if dashboard_sql:
        print(f"[intent_engine] TIER-0 deterministic dashboard SQL: {message[:60]}")
        return dashboard_sql

    # Tier 0b: Simple pattern matching
    simple_sql = _try_simple_query_pattern(message)
    if simple_sql:
        print(f"[intent_engine] TIER-0b pattern-matched SQL: {message[:60]}")
        return simple_sql

    # Tier 1: Query Library — 100 golden pre-built queries (ZERO LLM cost)
    try:
        from services.query_library import get_library_sql
        library_result = get_library_sql(message)
        if library_result:
            qid, lib_sql, chart_type = library_result
            print(f"[intent_engine] TIER-1 query library match [{qid}]: {message[:60]}")
            return lib_sql.strip()
    except Exception as lib_err:
        print(f"[intent_engine] Query library lookup failed: {lib_err}")

    # Check cache (similar queries won't hit API)
    cache_key = message.lower().strip()
    if cache_key in _sql_cache:
        print(f"[intent_engine] Using cached SQL for: {message}")
        return _sql_cache[cache_key]
    
    api_key_g = os.getenv("GOOGLE_API_KEY", "")
    api_key_o = os.getenv("OPENAI_API_KEY", "")
    tables = ", ".join(sorted(JOIN_GRAPH.keys()))
    joins = "; ".join([f"{a}->{b}: {cond}" for a, rel in JOIN_GRAPH.items() for b, cond in rel.items()])

    prompt = f"""
You are an SQL assistant for SQLite.
Return ONLY a SQL SELECT statement.
Allowed tables: {tables}
Allowed join paths: {joins}
User question: {message}
"""

    if api_key_g:
        import google.generativeai as genai
        import asyncio
        
        genai.configure(api_key=api_key_g)
        model_name = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
        model = genai.GenerativeModel(model_name)
        
        # Retry logic with exponential backoff for rate limits
        max_retries = 3
        for attempt in range(max_retries):
            try:
                response = model.generate_content(prompt)
                sql = _clean_sql((response.text or "").strip())
                
                # Cache the result (LRU: remove oldest if full)
                if sql:
                    if len(_sql_cache) >= _cache_max_size:
                        # Remove first (oldest) item
                        _sql_cache.pop(next(iter(_sql_cache)))
                    _sql_cache[cache_key] = sql
                    print(f"[intent_engine] Cached SQL for future use")
                
                return sql
            except Exception as exc:
                error_str = str(exc)
                
                # Check if it's a rate limit error (429)
                if "429" in error_str or "quota" in error_str.lower() or "rate" in error_str.lower():
                    if attempt < max_retries - 1:
                        # Exponential backoff: 2s, 4s, 8s
                        wait_time = 2 ** (attempt + 1)
                        print(f"[intent_engine] Gemini rate limit hit, retrying in {wait_time}s (attempt {attempt + 1}/{max_retries})")
                        await asyncio.sleep(wait_time)
                        continue
                    else:
                        print(f"[intent_engine] Gemini rate limit exhausted after {max_retries} retries")
                        return None
                else:
                    # Non-rate-limit error, don't retry
                    print(f"[intent_engine] Gemini SQL generation failed: {exc}")
                    return None
        
        return None

    if api_key_o:
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=api_key_o)
            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
            )
            sql = _clean_sql((response.choices[0].message.content or "").strip())
            
            # Cache the result
            if sql:
                if len(_sql_cache) >= _cache_max_size:
                    _sql_cache.pop(next(iter(_sql_cache)))
                _sql_cache[cache_key] = sql
                print(f"[intent_engine] Cached SQL for future use")
            
            return sql
        except Exception as exc:
            print(f"[intent_engine] OpenAI SQL generation failed: {exc}")
            return None

    print("[intent_engine] SQL generation skipped: no AI provider configured.")

    return None


async def _execute_plan(db: AsyncSession, plan: Dict[str, Any]) -> Dict[str, Any]:
    results: Dict[str, Any] = {}
    for item in plan["sql_plan"]:
        result = await db.execute(text(item["sql"]), item.get("params") or {})
        rows = result.fetchall()
        results[item["id"]] = [dict(row._mapping) for row in rows]
    return results


async def _search_documents(db: AsyncSession, query: str) -> List[Dict[str, Any]]:
    result = await db.execute(text("""
        SELECT filename, file_path, analysis_summary
        FROM documents
        WHERE filename LIKE :q OR analysis_summary LIKE :q
        ORDER BY created_at DESC
        LIMIT 5
    """), {"q": f"%{query}%"})
    rows = result.fetchall()
    return [dict(row._mapping) for row in rows]


def _build_analysis_object(intent: str, entities: Dict[str, Any], sql_results: Dict[str, Any], provenance: Dict[str, Any]) -> Dict[str, Any]:
    metrics: Dict[str, Any] = {}
    dimensions: Dict[str, Any] = {}
    evidence: List[Dict[str, Any]] = []

    if "policy_summary" in sql_results and sql_results["policy_summary"]:
        row = sql_results["policy_summary"][0]
        metrics = {
            "claim_count": row.get("claim_count", 0),
            "total_amount": row.get("total_amount", 0),
            "avg_amount": row.get("avg_amount", 0),
            "max_claim": row.get("max_claim", 0),
            "premium": row.get("premium", 0),
        }
        premium = row.get("premium") or 0
        metrics["loss_ratio"] = round((metrics["total_amount"] / premium) * 100, 2) if premium else 0
        dimensions = {
            "policy_number": row.get("policy_number"),
            "policyholder_name": row.get("policyholder_name"),
            "industry_type": row.get("industry_type"),
        }

    if "portfolio_summary" in sql_results and sql_results["portfolio_summary"]:
        row = sql_results["portfolio_summary"][0]
        metrics["policy_count"] = row.get("policy_count", 0)
        metrics["total_premium"] = row.get("total_premium", 0)

    if "portfolio_claims" in sql_results and sql_results["portfolio_claims"]:
        row = sql_results["portfolio_claims"][0]
        metrics["claim_count"] = row.get("claim_count", 0)
        metrics["total_amount"] = row.get("total_amount", 0)
        metrics["avg_amount"] = row.get("avg_amount", 0)
        metrics["max_claim"] = row.get("max_claim", 0)

    if "policy_claims" in sql_results:
        for row in sql_results["policy_claims"]:
            evidence_files = row.get("evidence_files")
            if not evidence_files:
                continue
            try:
                parsed = json.loads(evidence_files)
                if isinstance(parsed, list):
                    for item in parsed:
                        if not item.get("url"):
                            continue
                        evidence.append({
                            "type": item.get("type", "image"),
                            "url": item.get("url"),
                            "local_path": item.get("local_path"),
                            "description": item.get("description"),
                            "claim_number": row.get("claim_number"),
                            "claim_date": row.get("claim_date"),
                        })
            except Exception:
                continue

    if "claim_detail" in sql_results and sql_results["claim_detail"]:
        row = sql_results["claim_detail"][0]
        metrics = {
            "claim_amount": row.get("claim_amount", 0),
            "claim_type": row.get("claim_type"),
            "status": row.get("status"),
            "premium": row.get("premium", 0),
        }
        dimensions = {
            "claim_number": row.get("claim_number"),
            "policy_number": row.get("policy_number"),
            "policyholder_name": row.get("policyholder_name"),
        }
        evidence_files = row.get("evidence_files")
        if evidence_files:
            try:
                parsed = json.loads(evidence_files)
                if isinstance(parsed, list):
                    evidence = parsed
            except Exception:
                evidence = []

    if "geo_policies" in sql_results:
        dimensions["geo_policies"] = sql_results["geo_policies"]

    if "ad_hoc_query" in sql_results:
        rows = sql_results["ad_hoc_query"]
        dimensions["rows"] = rows
        dimensions["columns"] = list(rows[0].keys()) if rows else []

    return {
        "context": {
            "intent": intent,
            "entity": entities.get("entity"),
            "policy_number": entities.get("policy_number"),
            "claim_number": entities.get("claim_number"),
        },
        "metrics": metrics,
        "dimensions": dimensions,
        "evidence": evidence,
        "provenance": provenance,
    }


def _build_citations(evidence: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    citations: List[Dict[str, Any]] = []
    for item in evidence:
        item_type = (item.get("type") or "").lower()
        if item_type == "guideline":
            snippet = (item.get("content") or "")[:240]
            citations.append({
                "type": "guideline",
                "title": item.get("title") or item.get("section") or "Guideline",
                "ref": item.get("section"),
                "snippet": snippet,
                "policy_number": item.get("policy_number"),
            })
            continue
        if item_type == "document":
            snippet = (item.get("summary") or "")[:240]
            citations.append({
                "type": "document",
                "title": item.get("filename") or "Document",
                "ref": item.get("file_path"),
                "snippet": snippet,
            })
            continue

        if item.get("url"):
            citations.append({
                "type": item.get("type") or "evidence",
                "title": item.get("description") or item.get("title") or item.get("filename") or "Evidence",
                "ref": item.get("claim_number"),
                "url": item.get("url"),
            })

    return citations


def _estimate_confidence(intent: str, analysis_object: Dict[str, Any], message: str, entities: Dict[str, Any]) -> Tuple[int, List[str]]:
    metrics = analysis_object.get("metrics", {})
    evidence = analysis_object.get("evidence", [])
    reason_codes: List[str] = []

    confidence = 72
    if metrics:
        confidence += 6
        reason_codes.append("metrics_present")
    if evidence:
        confidence += 6
        reason_codes.append("evidence_present")
    if intent == "ad_hoc_query":
        confidence -= 6
        reason_codes.append("ad_hoc_query")

    if len(message.split()) <= 3:
        confidence -= 14
        reason_codes.append("short_prompt")
    if not entities.get("policy_number") and not entities.get("claim_number"):
        confidence -= 8
        reason_codes.append("no_entity")

    keyword_boost = any(word in message.lower() for word in ["summarize", "trend", "dashboard", "memo", "renew", "decision", "recommend"])
    if keyword_boost:
        confidence += 4
        reason_codes.append("keyword_match")

    return max(45, min(confidence, 95)), reason_codes


def _render_analysis_text(analysis_object: Dict[str, Any], output_type: str = "analysis") -> str:
    """
    Render analysis text for chat response.
    For 'understand' intent, this will be conversational (use LLM).
    For other intents, use templates.
    """
    context = analysis_object.get("context", {})
    metrics = analysis_object.get("metrics", {})
    dims = analysis_object.get("dimensions", {})
    intent = context.get("intent")
    canonical_intent = context.get("canonical_intent", "Understand")

    # For dashboard/visualization intents, keep it brief
    if output_type == "dashboard":
        if intent == "portfolio_summary":
            return (
                f"I've prepared your dashboard with cached data from {metrics.get('policy_count', 0)} policies. "
                f"The intelligence canvas now shows your requested visualization."
            )
        if intent == "ad_hoc_query":
            rows = analysis_object.get("dimensions", {}).get("rows", [])
            return (
                f"I've created your visualization with {len(rows)} data point(s). "
                f"The intelligence canvas now shows your requested chart."
            )

    # For UNDERSTAND intent, return conversational placeholder (LLM will generate actual response)
    if canonical_intent == "Understand":
        # This is a placeholder - the actual conversational response will come from LLM
        # We'll implement LLM chat in the next step
        if intent == "portfolio_summary":
            return (
                f"You have {metrics.get('policy_count', 0)} policies in the portfolio. "
                f"Total premium is ${metrics.get('total_premium', 0):,.0f}, and total claims are "
                f"${metrics.get('total_amount', 0):,.0f}."
            )
        if intent in {"policy_risk_summary", "evidence_blend"}:
            return (
                f"Policy {dims.get('policy_number', 'N/A')} for {dims.get('policyholder_name', 'N/A')} has "
                f"{metrics.get('claim_count', 0)} claims totaling ${metrics.get('total_amount', 0):,.0f}. "
                f"Loss ratio is {metrics.get('loss_ratio', 0)}%."
            )
        if intent == "claim_summary":
            return (
                f"Claim {dims.get('claim_number', 'N/A')} on policy {dims.get('policy_number', 'N/A')} "
                f"reported ${metrics.get('claim_amount', 0):,.0f} in {metrics.get('claim_type', 'unknown')} "
                f"status {metrics.get('status', 'unknown')}."
            )
        # Generic fallback for conversational queries
        return "Let me analyze that for you..."

    if intent == "geo_risk":
        return "Geo risk summary generated from policies with mapped locations."

    if intent == "ad_hoc_query":
        rows = analysis_object.get("dimensions", {}).get("rows", [])
        columns = analysis_object.get("dimensions", {}).get("columns", [])
        
        # Dashboard mode: provide a visualization-friendly message
        if output_type == "dashboard" and len(rows) > 0:
            return (
                f"I've created your visualization with {len(rows)} data point(s). "
                f"The intelligence canvas now shows your requested chart."
            )
        
        if len(rows) == 1 and columns:
            row = rows[0]
            if len(columns) == 1:
                value = row.get(columns[0])
                if isinstance(value, (int, float)):
                    return f"The result is {value:,}."
                return f"The result is {value}."
            if "policy_count" in row:
                return f"You have {int(row.get('policy_count', 0)):,} policies in total."
            if "claim_count" in row:
                return f"You have {int(row.get('claim_count', 0)):,} total claims."
        
        # Multi-row results: return conversational message with Markdown table
        if len(rows) > 1 and columns:
            intro = f"Here are the {len(rows)} results:\n\n"
            header = "| " + " | ".join(str(col) for col in columns) + " |"
            separator = "| " + " | ".join("---" for _ in columns) + " |"
            table_rows = []
            for row in rows:
                values = [str(row.get(col, "")) for col in columns]
                table_rows.append("| " + " | ".join(values) + " |")
            table = "\n".join([header, separator] + table_rows)
            return intro + table
        
        return f"I found {len(rows)} result(s) from your query."

    return "RiskMind analyzed your request using available portfolio data."


async def run_intent_pipeline(message: str, db: AsyncSession, history: List[Dict[str, str]] = None) -> Dict[str, Any]:
    """Run intent-based analysis pipeline with conversation history for context."""
    if history is None:
        history = []
    
    # Extract context from recent history (last 5 messages)
    context_message = message
    if history:
        recent_history = history[-5:]
        # Look for policy/claim references in recent messages
        for msg in reversed(recent_history):
            if msg["role"] == "user":
                policy_match = POLICY_REGEX.search(msg["content"])
                claim_match = CLAIM_REGEX.search(msg["content"])
                if policy_match or claim_match:
                    # Append previous context to current message for intent routing
                    context_message = f"{msg['content']} {message}"
                    break
    
    intent_payload = _route_intent(context_message)
    output_type = intent_payload["output_type"]
    canonical_intent = intent_payload["canonical_intent"]

    if intent_payload["intent"] == "ad_hoc_query":
        # 1. Try Cached Data Cube (Pandas) - Implementation of "Query Once" architecture
        from services.data_cube import DataCube
        cube_result = DataCube.try_query(message)
        if cube_result:
             # Map cube result to full response format
             return {
                "analysis_object": cube_result["analysis_object"],
                "analysis_text": cube_result["analysis_text"],
                "recommended_modes": ["dashboard", "analysis"],
                "default_mode": "dashboard",
                "provenance": cube_result["analysis_object"]["provenance"],
                "inferred_intent": canonical_intent,
                "output_type": "dashboard",
                "suggested_outputs": ["dashboard"],
                "artifact": {"type": "analysis_object", "data": cube_result["analysis_object"]},
            }

        sql = await _generate_sql_llm(message)
        if not sql:
            empty_provenance = {"tables_used": [], "join_paths": [], "query_ids": []}
            analysis_object = {
                "context": {"intent": "ad_hoc_query"},
                "metrics": {},
                "dimensions": {},
                "evidence": [],
                "provenance": empty_provenance,
            }
            provenance_detail = {
                **empty_provenance,
                "sql_plan": [],
                "citations": [],
                "confidence": 52,
                "confidence_reason_codes": ["no_sql", "no_provider"],
                "generated_at": datetime.utcnow().isoformat(),
            }
            return {
                "analysis_object": analysis_object,
                "analysis_text": "Unable to generate SQL without an AI provider. Configure an API key to enable ad-hoc queries.",
                "recommended_modes": intent_payload["recommended_modes"],
                "default_mode": intent_payload["default_mode"],
                "provenance": provenance_detail,
                "inferred_intent": canonical_intent,
                "output_type": output_type,
                "suggested_outputs": intent_payload["recommended_modes"],
                "artifact": {"type": "analysis_object", "data": analysis_object},
            }

        is_valid, error, tables = _validate_sql(sql)
        if not is_valid:
            base_provenance = {"tables_used": tables, "join_paths": [], "query_ids": ["ad_hoc_query"]}
            analysis_object = {
                "context": {"intent": "ad_hoc_query"},
                "metrics": {},
                "dimensions": {},
                "evidence": [],
                "provenance": base_provenance,
            }
            provenance_detail = {
                **base_provenance,
                "sql_plan": [],
                "citations": [],
                "confidence": 56,
                "confidence_reason_codes": ["sql_rejected"],
                "generated_at": datetime.utcnow().isoformat(),
            }
            return {
                "analysis_object": analysis_object,
                "analysis_text": f"SQL rejected: {error}",
                "recommended_modes": intent_payload["recommended_modes"],
                "default_mode": intent_payload["default_mode"],
                "provenance": provenance_detail,
                "inferred_intent": canonical_intent,
                "output_type": output_type,
                "suggested_outputs": intent_payload["recommended_modes"],
                "artifact": {"type": "analysis_object", "data": analysis_object},
            }

        plan = {
            "sql_plan": [{"id": "ad_hoc_query", "sql": sql, "params": {}}],
            "provenance": {
                "tables_used": tables,
                "join_paths": [JOIN_GRAPH[a][b] for a in JOIN_GRAPH for b in JOIN_GRAPH[a] if a in tables and b in tables],
                "query_ids": ["ad_hoc_query"],
            },
        }
    else:
        plan = _sql_plan(intent_payload["intent"], intent_payload["entities"])

    results = await _execute_plan(db, plan)
    analysis_object = _build_analysis_object(
        intent_payload["intent"],
        intent_payload["entities"],
        results,
        plan["provenance"],
    )
    analysis_object["glass_box"] = {"sql_plan": plan.get("sql_plan", [])}

    # Attach unstructured evidence if relevant
    if any(word in message.lower() for word in ["guideline", "document", "report", "pdf", "evidence", "inspection"]):
        guidelines = search_similar(message, k=3, policy_number=analysis_object["context"].get("policy_number"))
        for g in guidelines:
            analysis_object["evidence"].append({
                "type": "guideline",
                "section": g.get("section"),
                "title": g.get("title"),
                "content": g.get("content"),
                "score": g.get("score"),
                "policy_number": g.get("policy_number"),
            })

        documents = await _search_documents(db, message)
        for doc in documents:
            analysis_object["evidence"].append({
                "type": "document",
                "filename": doc.get("filename"),
                "file_path": doc.get("file_path"),
                "summary": doc.get("analysis_summary"),
            })

    if _should_analyze_evidence(message, analysis_object["evidence"]):
        await _auto_analyze_evidence(analysis_object["evidence"], max_items=2)

    confidence, reason_codes = _estimate_confidence(intent_payload["intent"], analysis_object, message, intent_payload["entities"])

    # Don't override dashboard mode for chart/visualization requests even if confidence is low
    # Include all keywords that trigger dashboard mode (from line 81-83)
    explicit_dashboard_request = any(word in message.lower() for word in [
        "chart", "dashboard", "plot", "graph", "visualization", "widget",
        "trend", "compare", "breakdown", "analysis", "analyze", " by "
    ])

    # Confusion detection: When confidence is very low, ask for clarification
    clarification_needed = confidence < 50
    suggested_intents = []

    if confidence < 60:
        reason_codes.append("low_confidence")
        if not explicit_dashboard_request:
            canonical_intent = CANONICAL_INTENTS["understand"]
            output_type = "analysis"

        # Generate clickable intent suggestions when confused
        if clarification_needed:
            suggested_intents = [
                {
                    "label": "📊 Analyze with Dashboard",
                    "intent": "Analyze",
                    "output_type": "dashboard",
                    "example": "Show me trends and visualizations",
                    "keywords": ["chart", "trend", "compare", "breakdown"]
                },
                {
                    "label": "📝 Understand Details",
                    "intent": "Understand",
                    "output_type": "analysis",
                    "example": "Explain this policy or claim",
                    "keywords": ["why", "what", "explain", "tell me"]
                },
                {
                    "label": "✅ Make a Decision",
                    "intent": "Decide",
                    "output_type": "decision",
                    "example": "Should we accept or decline?",
                    "keywords": ["should we", "decision", "recommend"]
                },
                {
                    "label": "📄 Generate Memo",
                    "intent": "Document",
                    "output_type": "memo",
                    "example": "Create underwriting memo",
                    "keywords": ["memo", "document", "draft"]
                }
            ]

    recommended_modes = intent_payload["recommended_modes"]
    if confidence < 60:
        recommended_modes = recommended_modes[:2]

    # Generate clarifying suggestions when confidence is low
    suggested_prompts = []
    if confidence < 60:
        lower = message.lower()
        if "claim" in lower and not intent_payload["entities"]["claim_number"]:
            suggested_prompts = [
                "Show me claims for COMM-2024-016",
                "List all claims with high severity",
                "What's the total claim amount?"
            ]
        elif "policy" in lower and not intent_payload["entities"]["policy_number"]:
            suggested_prompts = [
                "Show me policy COMM-2024-016",
                "List policies by industry type",
                "What's the total premium?"
            ]
        elif "chart" in lower or "dashboard" in lower:
            suggested_prompts = [
                "Bar chart of claim count by policy number",
                "Pie chart of policies by industry type",
                "Line chart showing claim trends"
            ]
        else:
            suggested_prompts = [
                "Show me the portfolio overview",
                "Analyze policy COMM-2024-016",
                "Create a dashboard with key metrics"
            ]

    provenance_detail = {
        **plan["provenance"],
        "sql_plan": plan.get("sql_plan", []),
        "citations": _build_citations(analysis_object.get("evidence", [])),
        "confidence": confidence,
        "confidence_reason_codes": reason_codes,
        "generated_at": datetime.utcnow().isoformat(),
    }
    analysis_object["provenance"] = provenance_detail

    # Determine if canvas summary should be shown
    # For UNDERSTAND intent, only show canvas summary if there's rich data to display
    show_canvas_summary = True
    analysis_text = _render_analysis_text(analysis_object, output_type)

    if canonical_intent == "Understand":
        # Check if there's enough data to warrant a visual summary
        metrics = analysis_object.get("metrics", {})
        has_metrics = len(metrics) > 2  # More than just basic counts
        has_evidence = len(analysis_object.get("evidence", [])) > 0
        has_multiple_claims = metrics.get("claim_count", 0) >= 3

        # Only show canvas summary if there's rich structured data
        show_canvas_summary = (has_metrics and has_multiple_claims) or has_evidence

        # Always show summary for policy/claim-specific queries with data
        if intent_payload["intent"] in {"policy_risk_summary", "claim_summary"} and has_metrics:
            show_canvas_summary = True

        # ALWAYS let LLM generate the conversational response for Understand intent.
        # The analysis_object (with metrics) is still returned for the canvas.
        # Setting analysis_text=None triggers the LLM fallback in chat.py which
        # calls Gemini with the real data context → rich explanation in chat panel.
        analysis_text = None

    # Detect if response is long and should suggest viewing intelligent canvas
    suggest_canvas_view = False
    if analysis_text and len(analysis_text) > 500:  # Response is verbose
        suggest_canvas_view = True
        # For long responses, always show canvas summary
        if canonical_intent == "Understand":
            show_canvas_summary = True

    # If clarification needed and no explicit prompt given, suggest checking canvas
    if clarification_needed and not analysis_text:
        suggest_canvas_view = False  # Don't suggest canvas when we need clarification first

    return {
        "analysis_object": analysis_object,
        "analysis_text": analysis_text,  # None for conversational UNDERSTAND intent
        "recommended_modes": recommended_modes,
        "default_mode": output_type,
        "provenance": provenance_detail,
        "inferred_intent": canonical_intent,
        "output_type": output_type,
        "suggested_outputs": recommended_modes,
        "suggested_prompts": suggested_prompts,
        "artifact": {"type": "analysis_object", "data": analysis_object},
        "show_canvas_summary": show_canvas_summary,  # Flag to control canvas display
        "clarification_needed": clarification_needed,  # NEW: Indicates confusion, needs user clarification
        "suggested_intents": suggested_intents,  # NEW: Clickable intent options when confused
        "suggest_canvas_view": suggest_canvas_view,  # NEW: Prompt user to check intelligent canvas for long responses
    }


def _try_dashboard_query_pattern(message: str) -> Optional[str]:
    """
    Deterministic SQL generation for common dashboard widgets.
    Bypasses LLM for standard trends, distributions, and top-lists.
    """
    import re
    lower = message.lower()
    
    # 1. Claim Trend over time (monthly) - GLOBAL ONLY
    # Ensure we don't capture "Trend for Policy X" by checking for specific entity markers
    if any(x in lower for x in ['trend', 'over time', 'timeline', 'history']) and 'claim' in lower:
        # If user specifies a filter (e.g. "for policy", "where", or specific ID like "2024-"), skip deterministic
        if ' for ' in lower or 'where' in lower or re.search(r'\d', lower):
             return None
        return "SELECT strftime('%Y-%m', claim_date) as month, SUM(claim_amount) as total_amount, COUNT(*) as claim_count FROM claims GROUP BY month ORDER BY month"

    # 2. Claims by Type (Distribution) - GLOBAL ONLY
    if 'claim' in lower and ('by type' in lower or 'breakdown' in lower or 'distribution' in lower):
        if ' for ' in lower or 'where' in lower or re.search(r'\d', lower):
             return None
        return "SELECT claim_type, COUNT(*) as claim_count, SUM(claim_amount) as total_amount FROM claims GROUP BY claim_type ORDER BY total_amount DESC"

    # 3. Policies by Industry - GLOBAL ONLY
    if 'polic' in lower and 'industry' in lower:
        if ' for ' in lower or 'where' in lower or re.search(r'\d', lower):
             return None
        return "SELECT industry_type, COUNT(*) as policy_count, SUM(premium) as total_premium FROM policies GROUP BY industry_type ORDER BY total_premium DESC"

    # 4. Policies by Risk Level - GLOBAL ONLY
    if 'polic' in lower and ('risk' in lower or 'level' in lower) and ('by' in lower or 'distribution' in lower):
        if ' for ' in lower or 'where' in lower or re.search(r'\d', lower):
             return None
        return "SELECT risk_level, COUNT(*) as policy_count, AVG(premium) as avg_premium FROM policies GROUP BY risk_level ORDER BY policy_count DESC"

    # 5. Top Claims by Amount
    if 'top' in lower and 'claim' in lower:
        try:
            limit = int(re.search(r'\d+', lower).group())
        except:
            limit = 5
        return f"SELECT * FROM claims ORDER BY claim_amount DESC LIMIT {limit}"

    return None
