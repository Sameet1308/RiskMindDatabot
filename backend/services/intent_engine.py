"""
Intent-based orchestration: intent routing, SQL planning, execution,
analysis object creation, and renderer output.
"""
import re
import os
import json
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from services.join_context import JOIN_GRAPH, ENTITY_TABLES
from services.vector_store import search_similar

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
UPLOAD_DIR = os.path.join(BASE_DIR, "data", "uploads")

POLICY_REGEX = re.compile(r"(COMM-\d{4}-\d{3})", re.IGNORECASE)
CLAIM_REGEX = re.compile(r"(CLM-\d{4}-\d{3})", re.IGNORECASE)


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

    if any(word in lower for word in ["evidence", "photo", "video", "image", "pdf", "document", "report"]):
        intent = "evidence_blend"

    if any(word in lower for word in ["geo", "map", "location", "region", "geospatial"]):
        intent = "geo_risk"

    if not policy_match and not claim_match and intent == "portfolio_summary":
        if any(word in lower for word in ["list", "show", "count", "average", "total", "top", "highest", "lowest", "group", "by", "trend", "compare", "how many", "max", "most"]):
            intent = "ad_hoc_query"

    required_metrics = ["claim_count", "total_amount", "avg_amount", "max_claim"]
    evidence_needed = intent in {"evidence_blend", "claim_summary"}

    recommended_modes = []
    default_mode = "analysis"

    if intent == "portfolio_summary":
        recommended_modes = ["dashboard", "insight_card"]
        default_mode = "dashboard"
    elif intent == "policy_risk_summary":
        recommended_modes = ["insight_card", "memo", "decision_draft", "evidence_blend"]
        default_mode = "analysis"
    elif intent == "claim_summary" or intent == "evidence_blend":
        recommended_modes = ["evidence_blend", "recommendation", "decision_draft"]
        default_mode = "evidence_blend"
    elif intent == "geo_risk":
        recommended_modes = ["dashboard", "insight_card"]
        default_mode = "geo_risk"
    elif intent == "ad_hoc_query":
        recommended_modes = ["insight_card", "dashboard", "memo"]
        default_mode = "analysis"

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


async def _generate_sql_llm(message: str) -> Optional[str]:
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
        try:
            import google.generativeai as genai
            genai.configure(api_key=api_key_g)
            model_name = os.getenv("GEMINI_MODEL", "gemini-1.5-flash-latest")
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(prompt)
            return _clean_sql((response.text or "").strip())
        except Exception as exc:
            print(f"[intent_engine] Gemini SQL generation failed: {exc}")
            return None

    if api_key_o:
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=api_key_o)
            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
            )
            return _clean_sql((response.choices[0].message.content or "").strip())
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


def _render_analysis_text(analysis_object: Dict[str, Any]) -> str:
    context = analysis_object.get("context", {})
    metrics = analysis_object.get("metrics", {})
    dims = analysis_object.get("dimensions", {})
    intent = context.get("intent")

    if intent == "portfolio_summary":
        return (
            f"Portfolio summary: {metrics.get('policy_count', 0)} policies, total premium "
            f"${metrics.get('total_premium', 0):,.0f}, total claims "
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

    if intent == "geo_risk":
        return "Geo risk summary generated from policies with mapped locations."

    if intent == "ad_hoc_query":
        rows = analysis_object.get("dimensions", {}).get("rows", [])
        return f"Returned {len(rows)} row(s) from the requested query."

    return "RiskMind analyzed your request using available portfolio data."


async def run_intent_pipeline(message: str, db: AsyncSession) -> Dict[str, Any]:
    intent_payload = _route_intent(message)

    if intent_payload["intent"] == "ad_hoc_query":
        sql = await _generate_sql_llm(message)
        if not sql:
            return {
                "analysis_object": {
                    "context": {"intent": "ad_hoc_query"},
                    "metrics": {},
                    "dimensions": {},
                    "evidence": [],
                    "provenance": {"tables_used": [], "join_paths": [], "query_ids": []}
                },
                "analysis_text": "Unable to generate SQL without an AI provider. Configure an API key to enable ad-hoc queries.",
                "recommended_modes": intent_payload["recommended_modes"],
                "default_mode": intent_payload["default_mode"],
                "provenance": {"tables_used": [], "join_paths": [], "query_ids": []}
            }

        is_valid, error, tables = _validate_sql(sql)
        if not is_valid:
            return {
                "analysis_object": {
                    "context": {"intent": "ad_hoc_query"},
                    "metrics": {},
                    "dimensions": {},
                    "evidence": [],
                    "provenance": {"tables_used": tables, "join_paths": [], "query_ids": ["ad_hoc_query"]}
                },
                "analysis_text": f"SQL rejected: {error}",
                "recommended_modes": intent_payload["recommended_modes"],
                "default_mode": intent_payload["default_mode"],
                "provenance": {"tables_used": tables, "join_paths": [], "query_ids": ["ad_hoc_query"]}
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

    return {
        "analysis_object": analysis_object,
        "analysis_text": _render_analysis_text(analysis_object),
        "recommended_modes": intent_payload["recommended_modes"],
        "default_mode": intent_payload["default_mode"],
        "provenance": plan["provenance"],
    }
