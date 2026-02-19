"""
LangGraph Agent Pipeline — 8-node state machine for RiskMind.

Graph:
    START → route_intent → fetch_data → fetch_guidelines → fetch_knowledge
         → check_confidence ─┬─ (conf < 50) → clarify ──────┐
                             └─ (conf ≥ 50) → reason ───────┤
                                                   validate_output → format_output → END
"""
import re
import traceback
from typing import TypedDict, Any, List, Optional

from langgraph.graph import StateGraph, START, END

from services.intent_engine import (
    _route_intent,
    _format_data_snapshot,
    _build_lightweight_analysis,
    _estimate_confidence,
    _should_analyze_evidence,
    _auto_analyze_evidence,
    _build_citations,
)
from services.vector_store import search_similar, search_knowledge
from services.llm_providers import get_all_available, build_messages, build_mock_response
from services.prompts import SYSTEM_PROMPT


# ── State Schema ──────────────────────────────────────────────

class AgentState(TypedDict, total=False):
    # inputs
    message: str
    history: list
    dashboard_data: dict
    # after route_intent
    intent_payload: dict
    entities: dict
    canonical_intent: str
    output_type: str
    # after fetch_data
    data_context: str
    analysis_object: dict
    # after fetch_guidelines
    guideline_context: str
    sources: list
    # after fetch_knowledge
    knowledge_context: str
    # after check_confidence
    confidence: int
    clarification_needed: bool
    suggested_intents: list
    suggest_canvas_view: bool
    show_canvas_summary: bool
    show_evidence: bool
    # after reason / clarify
    response_text: str
    provider: str
    # after validate_output
    guardrail_passed: bool
    # terminal
    final_response: dict


# ══════════════════════════════════════════════════════════════
# NODE  1 — Route Intent
# ══════════════════════════════════════════════════════════════

def route_intent_node(state: AgentState) -> dict:
    """Keyword-based intent classification (no LLM)."""
    payload = _route_intent(state["message"])
    return {
        "intent_payload": payload,
        "entities": payload["entities"],
        "canonical_intent": payload["canonical_intent"],
        "output_type": payload["output_type"],
    }


# ══════════════════════════════════════════════════════════════
# NODE  2 — Fetch Data
# ══════════════════════════════════════════════════════════════

async def fetch_data_node(state: AgentState) -> dict:
    """Format data snapshot + build analysis_object (no LLM)."""
    dashboard_data = state["dashboard_data"]
    intent_payload = state["intent_payload"]

    data_context = _format_data_snapshot(dashboard_data, intent_payload)
    analysis_object = _build_lightweight_analysis(dashboard_data, intent_payload)

    # Evidence analysis (only when explicitly requested — calls vision models)
    evidence = analysis_object.get("evidence", [])
    if _should_analyze_evidence(state["message"], evidence):
        await _auto_analyze_evidence(evidence)

    return {
        "data_context": data_context,
        "analysis_object": analysis_object,
    }


# ══════════════════════════════════════════════════════════════
# NODE  3 — Fetch Guidelines (ChromaDB RAG)
# ══════════════════════════════════════════════════════════════

def fetch_guidelines_node(state: AgentState) -> dict:
    """Search ChromaDB for relevant underwriting guidelines."""
    message = state["message"]
    analysis_object = dict(state["analysis_object"])           # shallow copy
    evidence = list(analysis_object.get("evidence", []))       # shallow copy

    guideline_results = []
    try:
        guideline_results = search_similar(message, k=5)
    except Exception:
        pass

    sources = [
        {"section": r["section"], "title": r["title"]}
        for r in guideline_results
    ] if guideline_results else []

    guideline_context = "\n".join(
        f"- [{r['section']}] {r['content']}" for r in guideline_results
    ) if guideline_results else ""

    # Append guidelines to evidence list
    for g in guideline_results:
        evidence.append({
            "type": "guideline",
            "section": g.get("section", ""),
            "title": g.get("title", ""),
            "content": g.get("content", "")[:300],
            "policy_number": g.get("policy_number"),
        })

    # Rebuild citations with guideline evidence included
    provenance = dict(analysis_object.get("provenance", {}))
    provenance["citations"] = _build_citations(evidence)
    analysis_object["provenance"] = provenance
    analysis_object["evidence"] = evidence

    return {
        "guideline_context": guideline_context,
        "sources": sources,
        "analysis_object": analysis_object,
    }


# ══════════════════════════════════════════════════════════════
# NODE  4 — Fetch Knowledge (semantic search)
# ══════════════════════════════════════════════════════════════

def fetch_knowledge_node(state: AgentState) -> dict:
    """Semantic search over past claims and decisions."""
    message = state["message"]
    sources = list(state.get("sources", []))

    knowledge_results = search_knowledge(message, k=4)
    knowledge_context = ""
    if knowledge_results:
        claims_ctx = [r for r in knowledge_results if r.get("type") == "claim"]
        decisions_ctx = [r for r in knowledge_results if r.get("type") == "decision"]
        parts = []
        if claims_ctx:
            parts.append("SIMILAR PAST CLAIMS:\n" + "\n".join(f"- {r['content']}" for r in claims_ctx))
        if decisions_ctx:
            parts.append("SIMILAR PAST DECISIONS:\n" + "\n".join(f"- {r['content']}" for r in decisions_ctx))
            for r in decisions_ctx:
                pnum = r.get("policy_number", "")
                if pnum:
                    sources.append({"section": pnum, "title": f"{r.get('decision', '').upper()} decision"})
        knowledge_context = "\n\n".join(parts)

    return {
        "knowledge_context": knowledge_context,
        "sources": sources,
    }


# ══════════════════════════════════════════════════════════════
# NODE  5 — Check Confidence
# ══════════════════════════════════════════════════════════════

def check_confidence_node(state: AgentState) -> dict:
    """Score confidence and decide whether to clarify or reason."""
    intent = state["intent_payload"]["intent"]
    analysis_object = dict(state["analysis_object"])
    message = state["message"]
    entities = state["entities"]

    confidence, reason_codes = _estimate_confidence(intent, analysis_object, message, entities)

    provenance = dict(analysis_object.get("provenance", {}))
    provenance["confidence"] = confidence
    provenance["confidence_reason_codes"] = reason_codes
    analysis_object["provenance"] = provenance

    clarification_needed = confidence < 50
    suggested_intents = []
    if clarification_needed:
        suggested_intents = [
            {"label": "Analyze",    "intent": "analyze",   "icon": "chart"},
            {"label": "Understand", "intent": "understand","icon": "info"},
            {"label": "Decide",     "intent": "decide",    "icon": "check"},
            {"label": "Document",   "intent": "document",  "icon": "file"},
        ]

    # Detect simple greetings/conversational queries — no canvas for these
    _GREETINGS = {
        "hello", "hi", "hey", "good morning", "good afternoon", "good evening",
        "thanks", "thank you", "ok", "okay", "sure", "bye", "goodbye", "help",
        "what can you do", "who are you", "how are you", "yo", "sup",
    }
    msg_stripped = message.lower().strip().rstrip("!?.,:;")
    is_greeting = msg_stripped in _GREETINGS

    # Detect geo queries — override output_type to geo_map
    _GEO_KEYWORDS = {"map", "geo", "geography", "spatial", "geospatial", "location", "region"}
    output_type = state.get("output_type", "analysis")
    if any(kw in message.lower() for kw in _GEO_KEYWORDS):
        output_type = "geo_map"

    # Canvas KPI summary — only for entity-specific queries (policy/claim)
    # Portfolio-level queries get the narrative view (in sync with chat)
    show_canvas_summary = False
    if not is_greeting:
        m = analysis_object.get("metrics", {})
        if entities.get("policy_number") or entities.get("claim_number"):
            if m.get("claim_count", 0) >= 1 or m.get("total_amount", 0) > 0:
                show_canvas_summary = True
        # Geo map always shows canvas
        if output_type == "geo_map":
            show_canvas_summary = True

    suggest_canvas_view = not is_greeting and len(state.get("data_context", "")) > 300

    # Evidence panel — only when user explicitly asks
    _EVIDENCE_KEYWORDS = {
        "evidence", "proof", "citation", "citations", "provenance",
        "lineage", "source", "sources", "reference", "references",
        "transparency", "audit trail", "data lineage",
    }
    msg_lower = message.lower()
    show_evidence = any(kw in msg_lower for kw in _EVIDENCE_KEYWORDS)

    # If user asked for evidence but no specific entity → lower confidence to trigger clarification
    if show_evidence and not entities.get("policy_number") and not entities.get("claim_number"):
        evidence_items = analysis_object.get("evidence", [])
        if not evidence_items or all(
            (e.get("type") == "evidence" and not e.get("url")) for e in evidence_items
        ):
            confidence = max(confidence - 25, 30)
            clarification_needed = True
            suggested_intents = [
                {
                    "label": "Policy evidence",
                    "intent": "policy_risk_summary",
                    "output_type": "analysis",
                    "example": "Show evidence for COMM-2024-016",
                    "keywords": ["evidence", "policy"],
                },
                {
                    "label": "Claim evidence",
                    "intent": "claim_summary",
                    "output_type": "analysis",
                    "example": "Show evidence for CLM-2024-005",
                    "keywords": ["evidence", "claim"],
                },
                {
                    "label": "Portfolio evidence trail",
                    "intent": "portfolio_summary",
                    "output_type": "analysis",
                    "example": "Show audit trail for my portfolio",
                    "keywords": ["audit trail", "portfolio"],
                },
            ]
            show_canvas_summary = False

    return {
        "confidence": confidence,
        "clarification_needed": clarification_needed,
        "suggested_intents": suggested_intents,
        "show_canvas_summary": show_canvas_summary,
        "suggest_canvas_view": suggest_canvas_view,
        "show_evidence": show_evidence,
        "analysis_object": analysis_object,
        "output_type": output_type,
    }


# ══════════════════════════════════════════════════════════════
# NODE  6a — Clarify  (confidence < 50, no LLM)
# ══════════════════════════════════════════════════════════════

def clarify_node(state: AgentState) -> dict:
    return {
        "response_text": (
            "I'm not entirely sure what you're looking for. "
            "Could you help me understand better?\n\n"
            "You can click one of the options below, or rephrase your question with more details."
        ),
        "provider": "intent-engine",
    }


# ══════════════════════════════════════════════════════════════
# NODE  6b — Reason  (LLM call via LangChain)
# ══════════════════════════════════════════════════════════════

async def reason_node(state: AgentState) -> dict:
    """Call LLM with full context.  Tries each available provider in order."""
    providers = get_all_available()

    if not providers:
        mock = build_mock_response(
            state["message"],
            state.get("data_context", ""),
            state.get("guideline_context", ""),
        )
        return {"response_text": mock, "provider": "mock"}

    messages = build_messages(
        system_prompt=SYSTEM_PROMPT,
        message=state["message"],
        history=state.get("history", []),
        data_context=state.get("data_context", ""),
        guideline_context=state.get("guideline_context", ""),
        knowledge_context=state.get("knowledge_context", ""),
    )

    for llm, name in providers:
        try:
            result = await llm.ainvoke(messages)
            return {"response_text": result.content, "provider": name}
        except Exception as e:
            print(f"[LLM] {name} error: {e}")
            continue

    # All providers failed — fall back to mock
    mock = build_mock_response(
        state["message"],
        state.get("data_context", ""),
        state.get("guideline_context", ""),
    )
    return {"response_text": mock, "provider": "mock"}


# ══════════════════════════════════════════════════════════════
# NODE  7 — Validate Output  (Guardrails)
# ══════════════════════════════════════════════════════════════

def validate_output_node(state: AgentState) -> dict:
    """Post-processing guardrails: empty check, length cap, hallucination detection."""
    response = state.get("response_text", "")
    dashboard_data = state.get("dashboard_data", {})
    show_canvas = state.get("show_canvas_summary", False)

    # 1. Empty response check (skip for greetings — short replies are fine)
    if len(response.strip()) < 10 and show_canvas:
        return {
            "guardrail_passed": False,
            "response_text": "I couldn't generate a meaningful response. Please try rephrasing your question.",
            "provider": "guardrail",
        }

    # 2. Length cap (5 000 chars)
    if len(response) > 5000:
        response = response[:5000] + "\n\n*[Response truncated for brevity]*"

    # 3. Entity hallucination detection
    mentioned_policies = set(re.findall(r"COMM-\d{4}-\d{3}", response))
    mentioned_claims = set(re.findall(r"CLM-\d{4}-\d{3}", response))
    known_policies = {p.get("policy_number", "") for p in dashboard_data.get("policies", [])}
    known_claims = {c.get("claim_number", "") for c in dashboard_data.get("claims", [])}

    fake_ids = (mentioned_policies - known_policies) | (mentioned_claims - known_claims)
    if fake_ids:
        for fid in fake_ids:
            response = response.replace(fid, "[REDACTED]")
        response += "\n\n*Note: Some entity references were corrected for accuracy.*"

    # 4. Canvas hint for long responses
    suggest_canvas_view = state.get("suggest_canvas_view", False)
    if len(response) > 500:
        suggest_canvas_view = True

    return {
        "guardrail_passed": True,
        "response_text": response,
        "suggest_canvas_view": suggest_canvas_view,
    }


# ══════════════════════════════════════════════════════════════
# NODE  8 — Format Output
# ══════════════════════════════════════════════════════════════

def format_output_node(state: AgentState) -> dict:
    """Assemble the final ChatResponse-compatible dict."""
    show_canvas = state.get("show_canvas_summary", False)
    show_evidence = state.get("show_evidence", False)
    analysis_object = state.get("analysis_object") or {}

    # Strip evidence/provenance unless user explicitly asked for it
    if not show_evidence and analysis_object:
        analysis_object = {k: v for k, v in analysis_object.items()
                          if k not in ("evidence", "provenance")}

    # For greetings, strip entire analysis_object
    if not show_canvas and not state.get("suggest_canvas_view", False):
        analysis_object = {}

    # Inject analytics playground link when intent matches
    response_text = state.get("response_text", "")
    intent_payload = state.get("intent_payload") or {}
    if intent_payload.get("intent") == "analytics_playground":
        response_text += "\n\n**[Open Analytics Playground](/analytics)** -- Slice and dice your portfolio data interactively."

    return {
        "final_response": {
            "response": response_text,
            "sources": state.get("sources", []),
            "provider": state.get("provider", "mock"),
            "analysis_object": analysis_object if analysis_object else None,
            "provenance": analysis_object.get("provenance") if show_evidence else None,
            "inferred_intent": state.get("canonical_intent"),
            "output_type": state.get("output_type"),
            "clarification_needed": state.get("clarification_needed", False),
            "suggested_intents": state.get("suggested_intents", []),
            "suggest_canvas_view": state.get("suggest_canvas_view", False),
            "show_canvas_summary": state.get("show_canvas_summary", True),
        }
    }


# ══════════════════════════════════════════════════════════════
# Graph Assembly
# ══════════════════════════════════════════════════════════════

def _build_graph():
    graph = StateGraph(AgentState)

    graph.add_node("route_intent",    route_intent_node)
    graph.add_node("fetch_data",      fetch_data_node)
    graph.add_node("fetch_guidelines", fetch_guidelines_node)
    graph.add_node("fetch_knowledge", fetch_knowledge_node)
    graph.add_node("check_confidence", check_confidence_node)
    graph.add_node("clarify",         clarify_node)
    graph.add_node("reason",          reason_node)
    graph.add_node("validate_output", validate_output_node)
    graph.add_node("format_output",   format_output_node)

    # Linear pipeline
    graph.add_edge(START,              "route_intent")
    graph.add_edge("route_intent",     "fetch_data")
    graph.add_edge("fetch_data",       "fetch_guidelines")
    graph.add_edge("fetch_guidelines", "fetch_knowledge")
    graph.add_edge("fetch_knowledge",  "check_confidence")

    # Conditional branch: clarify or reason
    graph.add_conditional_edges(
        "check_confidence",
        lambda s: "clarify" if s.get("clarification_needed") else "reason",
    )

    # Both paths converge at validate → format → END
    graph.add_edge("clarify",          "validate_output")
    graph.add_edge("reason",           "validate_output")
    graph.add_edge("validate_output",  "format_output")
    graph.add_edge("format_output",    END)

    return graph.compile()


# Lazily compiled graph singleton
_agent = None


def _get_agent():
    global _agent
    if _agent is None:
        _agent = _build_graph()
    return _agent


# ══════════════════════════════════════════════════════════════
# Public Entry Point
# ══════════════════════════════════════════════════════════════

async def run_agent_pipeline(
    message: str,
    dashboard_data: dict,
    history: Optional[List[dict]] = None,
) -> dict:
    """Run the full LangGraph agent and return a ChatResponse-compatible dict."""
    initial_state: AgentState = {
        "message": message,
        "history": history or [],
        "dashboard_data": dashboard_data,
        "intent_payload": {},
        "entities": {},
        "canonical_intent": "Understand",
        "output_type": "analysis",
        "data_context": "",
        "analysis_object": {},
        "guideline_context": "",
        "knowledge_context": "",
        "sources": [],
        "confidence": 0,
        "clarification_needed": False,
        "suggested_intents": [],
        "suggest_canvas_view": False,
        "show_canvas_summary": True,
        "show_evidence": False,
        "response_text": "",
        "provider": "mock",
        "guardrail_passed": True,
        "final_response": {},
    }

    try:
        agent = _get_agent()
        result = await agent.ainvoke(initial_state)
        return result.get("final_response", {})
    except Exception as e:
        traceback.print_exc()
        return {
            "response": f"Agent pipeline error: {e}",
            "sources": [],
            "provider": "error",
            "analysis_object": None,
            "provenance": None,
            "inferred_intent": None,
            "output_type": "analysis",
            "clarification_needed": False,
            "suggested_intents": [],
            "suggest_canvas_view": False,
            "show_canvas_summary": False,
        }
