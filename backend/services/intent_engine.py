"""
Intent-based orchestration: intent routing, data snapshot formatting,
and lightweight analysis for the chat-first architecture.

Note: run_intent_pipeline() has been replaced by the LangGraph agent in
services/agent_graph.py.  This module now exports only utility functions
consumed by individual graph nodes.
"""
import re
import os
import json
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

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


# ── Intent Routing ──────────────────────────────────────────────

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
            "how many policies", "total policies",
            "number of policies", "policy count",
        ]):
            intent = "portfolio_summary"
            keep_portfolio = True

    if any(word in lower for word in ["evidence", "photo", "video", "image", "pdf", "document", "report"]):
        intent = "policy_risk_summary" if policy_match else intent

    if not policy_match and not claim_match and intent == "portfolio_summary" and not keep_portfolio:
        if any(word in lower for word in [
            "list", "show", "count", "average", "total", "top", "highest",
            "lowest", "group", "by", "trend", "compare", "how many", "max", "most"
        ]):
            intent = "ad_hoc_query"

    # Geo keywords → geo_risk intent
    _GEO_KEYWORDS = {"map", "geo", "geography", "spatial", "geospatial", "location", "region"}
    is_geo = any(word in lower for word in _GEO_KEYWORDS)

    if any(word in lower for word in [
        "trend", "chart", "plot", "graph", "timeline", "over time",
        "by month", "by year", "scatter", "map", "geo"
    ]):
        intent = "ad_hoc_query"

    if is_geo:
        intent = "geo_risk"

    # Analytics playground keywords — MUST be after ad_hoc so it wins
    _PLAYGROUND_KW = {
        "interactive", "self-service", "self service", "playground",
        "slice and dice", "slice & dice", "explore data",
        "open analytics", "analytics playground", "analytics page",
        "self service analytics", "data explorer",
    }
    if any(kw in lower for kw in _PLAYGROUND_KW):
        intent = "analytics_playground"

    canonical_intent = CANONICAL_INTENTS["understand"]
    output_type = "analysis"

    if is_geo:
        canonical_intent = CANONICAL_INTENTS["analyze"]
        output_type = "geo_map"
    elif any(word in lower for word in ["memo", "draft", "document", "write", "underwriting memo"]):
        canonical_intent = CANONICAL_INTENTS["document"]
        output_type = "memo"
    elif any(word in lower for word in ["should we", "renew", "accept", "decline", "refer", "decision"]):
        canonical_intent = CANONICAL_INTENTS["decide"]
        output_type = "decision"
    elif any(word in lower for word in ["trend", "compare", "breakdown", "chart", "dashboard", "analysis", "analyze", "by "]):
        canonical_intent = CANONICAL_INTENTS["analyze"]
        output_type = "analysis"
    elif intent == "ad_hoc_query":
        canonical_intent = CANONICAL_INTENTS["analyze"]
        output_type = "analysis"

    return {
        "intent": intent,
        "entities": {
            "policy_number": policy_match.group(1).upper() if policy_match else None,
            "claim_number": claim_match.group(1).upper() if claim_match else None,
            "entity": entity,
        },
        "canonical_intent": canonical_intent,
        "output_type": output_type,
    }


# ── Evidence Analysis ───────────────────────────────────────────

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


# ── Citations ───────────────────────────────────────────────────

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
        elif item_type == "document":
            snippet = (item.get("summary") or "")[:240]
            citations.append({
                "type": "document",
                "title": item.get("filename") or "Document",
                "ref": item.get("file_path"),
                "snippet": snippet,
            })
        elif item.get("url"):
            citations.append({
                "type": item.get("type") or "evidence",
                "title": item.get("description") or item.get("title") or item.get("filename") or "Evidence",
                "ref": item.get("claim_number"),
                "url": item.get("url"),
            })
    return citations


# ── Confidence Scoring ──────────────────────────────────────────

def _estimate_confidence(intent: str, analysis_object: Dict[str, Any], message: str, entities: Dict[str, Any]) -> Tuple[int, List[str]]:
    metrics = analysis_object.get("metrics", {})
    evidence = analysis_object.get("evidence", [])
    reason_codes: List[str] = []
    lower = message.lower()

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

    # Short prompt penalty — BUT skip if query contains known intent keywords
    _INTENT_KEYWORDS = {
        "risk", "claims", "policy", "policies", "portfolio", "loss", "ratio",
        "premium", "industry", "high", "low", "medium", "show", "list",
        "analyze", "summary", "overview", "compare", "trend", "top",
        "total", "count", "average", "breakdown", "report", "underwriting",
        "renew", "decline", "accept", "refer", "memo", "decision",
    }
    has_intent_keyword = any(kw in lower for kw in _INTENT_KEYWORDS)
    if len(message.split()) <= 3 and not has_intent_keyword:
        confidence -= 14
        reason_codes.append("short_prompt")

    if not entities.get("policy_number") and not entities.get("claim_number"):
        confidence -= 8
        reason_codes.append("no_entity")

    # Portfolio-level query boost (most common query type)
    if intent in ("portfolio_summary", "ad_hoc_query") and has_intent_keyword:
        confidence += 10
        reason_codes.append("portfolio_boost")

    keyword_boost = any(word in lower for word in [
        "summarize", "trend", "dashboard", "memo", "renew", "decision", "recommend"
    ])
    if keyword_boost:
        confidence += 4
        reason_codes.append("keyword_match")

    return max(45, min(confidence, 95)), reason_codes


# ── Data Snapshot Formatting ────────────────────────────────────

def _compute_risk(claim_count: int, total_amount: float) -> str:
    if claim_count >= 5 or total_amount >= 100000:
        return "high"
    if claim_count >= 2 or total_amount >= 50000:
        return "medium"
    return "low"


def _format_data_snapshot(dashboard_data: dict, intent_payload: dict) -> str:
    """Convert raw dashboard data to compact text context for LLM."""
    policies = dashboard_data.get("policies", [])
    claims = dashboard_data.get("claims", [])
    decisions = dashboard_data.get("decisions", [])
    guidelines = dashboard_data.get("guidelines", [])

    entities = intent_payload.get("entities", {})
    target_policy = entities.get("policy_number")
    target_claim = entities.get("claim_number")

    # ── Portfolio Summary (always included)
    total_premium = sum(p.get("premium", 0) or 0 for p in policies)
    total_loss = sum(c.get("claim_amount", 0) or 0 for c in claims)
    portfolio_lr = round((total_loss / total_premium) * 100, 1) if total_premium else 0
    open_claims = sum(1 for c in claims if c.get("status") == "open")

    active_count = sum(1 for p in policies if p.get("policy_status") == "active")
    expired_count = len(policies) - active_count

    lines = [
        f"PORTFOLIO SNAPSHOT ({len(policies)} policies, {len(claims)} claims):",
        f"- Total Premium: ${total_premium:,.0f} | Total Incurred: ${total_loss:,.0f} | Portfolio LR: {portfolio_lr}%",
        f"- Open Claims: {open_claims} | Closed: {len(claims) - open_claims}",
        f"- Active Policies: {active_count} | Expired: {expired_count}",
        "",
    ]

    # ── Claims grouped by policy
    claims_by_policy: Dict[str, list] = {}
    for c in claims:
        pn = c.get("policy_number") or ""
        claims_by_policy.setdefault(pn, []).append(c)

    # ── If a specific claim is targeted, find its policy
    if target_claim and not target_policy:
        for c in claims:
            if (c.get("claim_number") or "").upper() == target_claim:
                target_policy = c.get("policy_number")
                break

    # ── Policy-specific detail
    if target_policy:
        pol = next((p for p in policies if (p.get("policy_number") or "").upper() == target_policy.upper()), None)
        if pol:
            pol_claims = claims_by_policy.get(pol["policy_number"], [])
            pol_total = sum(c.get("claim_amount", 0) or 0 for c in pol_claims)
            pol_open = sum(1 for c in pol_claims if c.get("status") == "open")
            pol_premium = pol.get("premium", 0) or 0
            pol_lr = round((pol_total / pol_premium) * 100, 1) if pol_premium else 0
            risk = _compute_risk(len(pol_claims), pol_total)

            lines.append(f"POLICY {pol['policy_number']}:")
            lines.append(f"- Policyholder: {pol.get('policyholder_name', 'N/A')} | Industry: {pol.get('industry_type', 'N/A')}")
            lines.append(f"- Premium: ${pol_premium:,.0f} | Period: {pol.get('effective_date', '?')} to {pol.get('expiration_date', '?')}")
            lines.append(f"- Claims: {len(pol_claims)} total ({pol_open} open, {len(pol_claims) - pol_open} closed)")
            lines.append(f"- Total Loss: ${pol_total:,.0f} | Loss Ratio: {pol_lr}% | Risk: {risk.upper()}")
            pol_status = pol.get("policy_status") or "active"
            lines.append(f"- Status: {pol_status.upper()}")

            # Third-party enrichment data (if available)
            enrichment_fields = []
            if pol.get("property_address"):
                enrichment_fields.append(f"Address: {pol['property_address']}, {pol.get('property_city', '')}, {pol.get('property_state', '')} {pol.get('property_zip', '')}")
            if pol.get("insured_value"):
                enrichment_fields.append(f"Insured Value (TIV): ${pol['insured_value']:,.0f}")
            if pol.get("replacement_cost"):
                enrichment_fields.append(f"Replacement Cost: ${pol['replacement_cost']:,.0f}")
            if pol.get("fema_flood_zone"):
                fz = f"FEMA Flood Zone: {pol['fema_flood_zone']}"
                if pol.get("flood_risk_score"):
                    fz += f" (Risk Score: {pol['flood_risk_score']}/100)"
                if pol.get("flood_zone_change_flag") and pol["flood_zone_change_flag"] != "no_change":
                    fz += f" [{pol['flood_zone_change_flag']}]"
                enrichment_fields.append(fz)
            if pol.get("primary_peril"):
                cat_line = f"Primary Peril: {pol['primary_peril']}"
                if pol.get("cat_aal"):
                    cat_line += f" | AAL: ${pol['cat_aal']:,.0f}"
                if pol.get("cat_pml_250yr"):
                    cat_line += f" | PML-250yr: ${pol['cat_pml_250yr']:,.0f}"
                enrichment_fields.append(cat_line)
            if pol.get("construction_type"):
                bldg = f"Construction: {pol['construction_type']}"
                if pol.get("year_built"):
                    bldg += f" | Built: {pol['year_built']}"
                if pol.get("stories"):
                    bldg += f" | {pol['stories']} stories"
                if pol.get("roof_type"):
                    bldg += f" | Roof: {pol['roof_type']}"
                enrichment_fields.append(bldg)
            if pol.get("business_credit_score"):
                fin = f"Credit Score: {pol['business_credit_score']}"
                if pol.get("financial_stability"):
                    fin += f" | Stability: {pol['financial_stability']}"
                enrichment_fields.append(fin)
            if pol.get("wildfire_risk_score"):
                enrichment_fields.append(f"Wildfire Risk: {pol['wildfire_risk_score']}/100")
            if pol.get("cresta_zone"):
                enrichment_fields.append(f"CRESTA Zone: {pol['cresta_zone']} ({pol.get('risk_zone', '')})")
            if pol.get("protection_class"):
                enrichment_fields.append(f"Protection Class: {pol['protection_class']}")
            if enrichment_fields:
                lines.append("PROPERTY & RISK DATA:")
                for ef in enrichment_fields:
                    lines.append(f"  - {ef}")

            if pol_claims:
                lines.append("CLAIM HISTORY:")
                for c in pol_claims:
                    lines.append(f"  - {c.get('claim_number', '?')} | {c.get('claim_type', '?')} | ${c.get('claim_amount', 0):,.0f} | {c.get('status', '?')} | {c.get('claim_date', '?')}")
                    if c.get("description"):
                        lines.append(f"    {c['description'][:120]}")

            pol_decisions = [d for d in decisions if (d.get("policy_number") or "").upper() == target_policy.upper()]
            if pol_decisions:
                lines.append(f"DECISIONS FOR {pol['policy_number']}:")
                for d in pol_decisions:
                    lines.append(f"  - {(d.get('decision') or '?').upper()} (Risk: {d.get('risk_level') or '?'}) by {d.get('decided_by') or '?'} on {(d.get('created_at') or '?')[:10]}")
                    if d.get("reason"):
                        lines.append(f"    Reason: {d['reason'][:120]}")
            lines.append("")

    # ── Specific claim detail
    if target_claim:
        cl = next((c for c in claims if (c.get("claim_number") or "").upper() == target_claim.upper()), None)
        if cl:
            lines.append(f"CLAIM {target_claim}:")
            lines.append(f"- Type: {cl.get('claim_type', '?')} | Amount: ${cl.get('claim_amount', 0):,.0f} | Status: {cl.get('status', '?')}")
            lines.append(f"- Date: {cl.get('claim_date', '?')} | Policy: {cl.get('policy_number', '?')}")
            if cl.get("description"):
                lines.append(f"- Description: {cl['description'][:200]}")
            ev = cl.get("evidence_files")
            if ev and ev != "[]":
                lines.append(f"- Evidence files: {ev}")
            lines.append("")

    # ── Industry breakdown (always useful for Analyze intent)
    industry_map: Dict[str, Dict[str, float]] = {}
    for p in policies:
        ind = p.get("industry_type") or "Unknown"
        if ind not in industry_map:
            industry_map[ind] = {"premium": 0, "loss": 0, "count": 0}
        industry_map[ind]["premium"] += p.get("premium", 0) or 0
        industry_map[ind]["count"] += 1
    for c in claims:
        pn = c.get("policy_number", "")
        pol = next((p for p in policies if p.get("policy_number") == pn), None)
        if pol:
            ind = pol.get("industry_type") or "Unknown"
            industry_map.setdefault(ind, {"premium": 0, "loss": 0, "count": 0})
            industry_map[ind]["loss"] += c.get("claim_amount", 0) or 0

    lines.append("INDUSTRY BREAKDOWN:")
    for ind, vals in sorted(industry_map.items(), key=lambda x: x[1]["loss"], reverse=True):
        lr = round((vals["loss"] / vals["premium"]) * 100, 1) if vals["premium"] else 0
        lines.append(f"  - {ind}: {int(vals['count'])} policies | Premium: ${vals['premium']:,.0f} | Loss: ${vals['loss']:,.0f} | LR: {lr}%")
    lines.append("")

    # ── Pre-computed rankings (so LLM reads answers, not raw data)

    # Claim count by type
    type_counts: Dict[str, int] = {}
    type_amounts: Dict[str, float] = {}
    for c in claims:
        ct = c.get("claim_type") or "Unknown"
        type_counts[ct] = type_counts.get(ct, 0) + 1
        type_amounts[ct] = type_amounts.get(ct, 0) + (c.get("claim_amount", 0) or 0)
    lines.append("CLAIMS BY TYPE:")
    for ct, cnt in sorted(type_counts.items(), key=lambda x: x[1], reverse=True):
        lines.append(f"  - {ct}: {cnt} claims | ${type_amounts.get(ct, 0):,.0f} total")
    lines.append("")

    # Risk distribution
    risk_dist = {"high": 0, "medium": 0, "low": 0}
    for p in policies:
        pc = claims_by_policy.get(p.get("policy_number", ""), [])
        ptotal = sum(c.get("claim_amount", 0) or 0 for c in pc)
        r = _compute_risk(len(pc), ptotal)
        risk_dist[r] += 1
    lines.append(f"RISK DISTRIBUTION: HIGH: {risk_dist['high']} | MEDIUM: {risk_dist['medium']} | LOW: {risk_dist['low']}")
    lines.append("")

    # Industry ranked by loss ratio (worst first)
    lines.append("INDUSTRY RANKED BY LOSS RATIO (worst first):")
    industry_ranked = []
    for ind, vals in industry_map.items():
        lr = round((vals["loss"] / vals["premium"]) * 100, 1) if vals["premium"] else 0
        industry_ranked.append((ind, lr, int(vals["count"]), vals["premium"], vals["loss"]))
    for ind, lr, cnt, prem, loss in sorted(industry_ranked, key=lambda x: x[1], reverse=True):
        lines.append(f"  - {ind}: LR {lr}% | {cnt} policies | Premium: ${prem:,.0f} | Loss: ${loss:,.0f}")
    lines.append("")

    # ── Top risk policies
    enriched = []
    for p in policies:
        pc = claims_by_policy.get(p.get("policy_number", ""), [])
        total = sum(c.get("claim_amount", 0) or 0 for c in pc)
        prem = p.get("premium", 0) or 0
        lr = round((total / prem) * 100, 1) if prem else 0
        risk = _compute_risk(len(pc), total)
        enriched.append({"pn": p["policy_number"], "name": p.get("policyholder_name", ""), "lr": lr, "risk": risk, "claims": len(pc)})

    high_risk = [e for e in enriched if e["risk"] == "high" or e["lr"] > 60]
    if high_risk:
        high_risk.sort(key=lambda x: x["lr"], reverse=True)
        lines.append("HIGH RISK POLICIES:")
        for h in high_risk[:10]:
            lines.append(f"  - {h['pn']} ({h['name']}): LR {h['lr']}% | {h['claims']} claims | Risk: {h['risk'].upper()}")
        lines.append("")

    # ── Top 10 claims by amount
    sorted_claims = sorted(claims, key=lambda c: c.get("claim_amount", 0) or 0, reverse=True)
    if sorted_claims:
        lines.append("TOP 10 CLAIMS BY AMOUNT:")
        for c in sorted_claims[:10]:
            lines.append(
                f"  - {c.get('claim_number', '?')} | {c.get('policy_number', '?')} | "
                f"{c.get('claim_type', '?')} | ${c.get('claim_amount', 0):,.0f} | {c.get('status', '?')}"
            )
        lines.append("")

    # ── Zone accumulation (concentration risk)
    zone_accum = dashboard_data.get("zone_accumulation", [])
    if zone_accum:
        lines.append("ZONE CONCENTRATION (top zones by TIV):")
        for z in zone_accum[:10]:
            lr_str = f"LR: {z.get('avg_loss_ratio', 0):.1f}%" if z.get("avg_loss_ratio") else ""
            lines.append(
                f"  - {z.get('zone_name', '?')} ({z.get('zone_type', '')}): "
                f"TIV ${z.get('total_tiv', 0):,.0f} | {z.get('policy_count', 0)} policies | "
                f"PML-250yr ${z.get('pml_250yr', 0):,.0f} | {lr_str}"
            )
        lines.append("")

    # ── Zone thresholds (breaches)
    zone_thresholds = dashboard_data.get("zone_thresholds", [])
    if zone_thresholds and zone_accum:
        breaches = []
        for zt in zone_thresholds:
            metric = zt.get("metric", "")
            limit_val = zt.get("limit_value", 0)
            for za in zone_accum:
                actual = za.get(metric, 0) or 0
                if actual > limit_val and limit_val > 0:
                    breaches.append({
                        "zone": za.get("zone_name", "?"),
                        "metric": metric,
                        "actual": actual,
                        "limit": limit_val,
                        "action": zt.get("action", "review"),
                    })
        if breaches:
            lines.append("ZONE THRESHOLD BREACHES:")
            for b in breaches[:10]:
                lines.append(
                    f"  - {b['zone']}: {b['metric']} = {b['actual']:,.0f} "
                    f"(limit: {b['limit']:,.0f}) -> Action: {(b.get('action') or 'review').upper()}"
                )
            lines.append("")

    # ── Recent decisions
    recent_dec = sorted(decisions, key=lambda d: d.get("created_at", ""), reverse=True)[:10]
    if recent_dec:
        lines.append("RECENT DECISIONS:")
        for d in recent_dec:
            lines.append(f"  - {d.get('policy_number') or '?'}: {(d.get('decision') or '?').upper()} by {d.get('decided_by') or '?'} ({(d.get('created_at') or '?')[:10]})")
        lines.append("")

    # ── Session documents (uploaded files with AI analysis in this chat session)
    session_docs = dashboard_data.get("session_documents", [])
    if session_docs:
        lines.append("UPLOADED DOCUMENTS IN THIS SESSION:")
        for sd in session_docs:
            fname = sd.get("filename", "unknown")
            ftype = sd.get("file_type", "")
            pn = sd.get("policy_number") or ""
            cn = sd.get("claim_number") or ""
            summary = sd.get("analysis_summary", "")[:300]
            label = f"{fname} ({ftype})"
            if pn:
                label += f" [Policy: {pn}]"
            if cn:
                label += f" [Claim: {cn}]"
            lines.append(f"  - {label}")
            if summary:
                lines.append(f"    Analysis: {summary}")
        lines.append("")

    return "\n".join(lines)


# ── Lightweight Analysis Object ─────────────────────────────────

def _build_lightweight_analysis(dashboard_data: dict, intent_payload: dict) -> Dict[str, Any]:
    """Build analysis_object from data snapshot (same shape as before, no SQL)."""
    policies = dashboard_data.get("policies", [])
    claims = dashboard_data.get("claims", [])
    decisions = dashboard_data.get("decisions", [])

    entities = intent_payload.get("entities", {})
    target_policy = entities.get("policy_number")
    target_claim = entities.get("claim_number")

    # Find target claim's policy if needed
    if target_claim and not target_policy:
        for c in claims:
            if (c.get("claim_number") or "").upper() == target_claim.upper():
                target_policy = c.get("policy_number")
                break

    # Build claims by policy
    claims_by_policy: Dict[str, list] = {}
    for c in claims:
        pn = c.get("policy_number") or ""
        claims_by_policy.setdefault(pn, []).append(c)

    # Metrics
    metrics: Dict[str, Any] = {}
    dimensions: Dict[str, Any] = {}
    evidence: List[Dict[str, Any]] = []

    if target_policy:
        pol = next((p for p in policies if (p.get("policy_number") or "").upper() == target_policy.upper()), None)
        pol_claims = claims_by_policy.get(target_policy, [])
        pol_total = sum(c.get("claim_amount", 0) or 0 for c in pol_claims)
        pol_premium = (pol.get("premium", 0) or 0) if pol else 0
        pol_lr = round((pol_total / pol_premium) * 100, 1) if pol_premium else 0

        metrics = {
            "claim_count": len(pol_claims),
            "total_amount": pol_total,
            "avg_amount": round(pol_total / len(pol_claims)) if pol_claims else 0,
            "max_claim": max((c.get("claim_amount", 0) or 0 for c in pol_claims), default=0),
            "premium": pol_premium,
            "loss_ratio": pol_lr,
        }
        dimensions = {
            "policy_number": target_policy,
            "policyholder_name": pol.get("policyholder_name") if pol else None,
            "industry_type": pol.get("industry_type") if pol else None,
            "claims_detail": pol_claims,
        }
        # Extract evidence from claims
        for c in pol_claims:
            ev_raw = c.get("evidence_files")
            if ev_raw and ev_raw != "[]":
                try:
                    ev_list = json.loads(ev_raw) if isinstance(ev_raw, str) else ev_raw
                    for ev_item in ev_list:
                        if isinstance(ev_item, dict):
                            ev_item["claim_number"] = c.get("claim_number")
                            evidence.append(ev_item)
                except (json.JSONDecodeError, TypeError):
                    pass

        pol_decisions = [d for d in decisions if (d.get("policy_number") or "").upper() == target_policy.upper()]
        if pol_decisions:
            dimensions["decisions"] = pol_decisions

    else:
        # Portfolio-level metrics
        total_premium = sum(p.get("premium", 0) or 0 for p in policies)
        total_loss = sum(c.get("claim_amount", 0) or 0 for c in claims)
        metrics = {
            "policy_count": len(policies),
            "claim_count": len(claims),
            "total_amount": total_loss,
            "total_premium": total_premium,
            "loss_ratio": round((total_loss / total_premium) * 100, 1) if total_premium else 0,
            "open_claims": sum(1 for c in claims if c.get("status") == "open"),
        }

    if target_claim:
        cl = next((c for c in claims if (c.get("claim_number") or "").upper() == target_claim.upper()), None)
        if cl:
            dimensions["claim_number"] = target_claim
            dimensions["claim_detail"] = cl

    # Risk level
    risk_level = _compute_risk(metrics.get("claim_count", 0), metrics.get("total_amount", 0))

    tables_used = ["policies", "claims"]
    if decisions:
        tables_used.append("decisions")

    return {
        "context": {
            "intent": intent_payload.get("intent"),
            "entity": entities.get("entity"),
            "policy_number": target_policy,
            "claim_number": target_claim,
        },
        "metrics": metrics,
        "dimensions": dimensions,
        "evidence": evidence,
        "risk_level": risk_level,
        "provenance": {
            "tables_used": tables_used,
            "query_ids": ["data_snapshot"],
            "citations": _build_citations(evidence),
            "generated_at": datetime.utcnow().isoformat(),
        },
    }


