"""
Chat Router — Multi-LLM (Gemini FREE / OpenAI / Mock)
ChromaDB RAG, NL→SQL, Persistent Sessions, File Upload, Vision
"""
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, text, delete
from typing import List, Optional
from datetime import datetime, timedelta
import os
import json
import base64
import uuid
import re
import time

from database.connection import get_db
from models.schemas import ChatSession, ChatMessage, Document
from services.intent_engine import run_intent_pipeline
from services.vector_store import search_similar

router = APIRouter()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# DB schema info for NL→SQL
DB_SCHEMA = """
Tables in the SQLite database:
1. policies(id, policy_number, policyholder_name, industry_type, effective_date, expiration_date, premium, created_at)
2. claims(id, claim_number, policy_id FK->policies.id, claim_date, claim_amount, claim_type, status, description, created_at)
3. guidelines(id, section_code, title, content, category, threshold_type, threshold_value, action)
4. decisions(id, policy_number, decision, reason, risk_level, decided_by, created_at)
5. chat_sessions(id, user_email, title, created_at, updated_at)
6. chat_messages(id, session_id FK->chat_sessions.id, role, content, file_url, sources, created_at)
"""


# ──── Pydantic Schemas ────

class ChatMessageIn(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[int] = None
    user_email: str = "demo@ltm.com"

class ChatResponse(BaseModel):
    response: str
    sources: List[dict] = []
    provider: str = "mock"
    session_id: int = 0
    analysis_object: Optional[dict] = None
    recommended_modes: Optional[List[str]] = None
    default_mode: Optional[str] = None
    provenance: Optional[dict] = None
    inferred_intent: Optional[str] = None
    output_type: Optional[str] = None
    suggested_outputs: Optional[List[str]] = None
    artifact: Optional[dict] = None
    clarification_needed: Optional[bool] = False
    suggested_intents: Optional[List[dict]] = []
    suggest_canvas_view: Optional[bool] = False
    show_canvas_summary: Optional[bool] = True

class SessionOut(BaseModel):
    id: int
    title: str
    created_at: str
    updated_at: str
    message_count: int = 0

class MessageOut(BaseModel):
    id: int
    role: str
    content: str
    file_url: Optional[str] = None
    sources: Optional[str] = None
    created_at: str

class UploadResponse(BaseModel):
    file_url: str
    filename: str
    file_type: str
    analysis: Optional[str] = None

class VisionRequest(BaseModel):
    image_base64: str
    prompt: str = "Analyze this image in the context of commercial insurance underwriting."
    session_id: Optional[int] = None
    user_email: str = "demo@ltm.com"


# ──── System Prompt ────

SYSTEM_PROMPT = """You are RiskMind DataBot, an AI-powered underwriting co-pilot for LTM's commercial insurance.
You help underwriters with:
- Policy risk analysis and claims data interpretation
- Underwriting guideline questions with section citations
- Loss ratio calculations and industry benchmarks
- Risk assessment recommendations
- Document and image analysis for underwriting
- Answering ANY question about the structured data in the database (policies, claims, guidelines, decisions)

When you receive DATABASE CONTEXT, use it to form accurate, data-driven answers.
When you receive GUIDELINE CONTEXT from vector search, cite the relevant sections.
Always be professional and provide actionable insights.
Format responses with markdown for readability.
If asked about specific data, provide numbers, tables, and calculations."""


# ──── NL→SQL: Query any structured data ────

async def _nl_to_sql_query(message: str, db: AsyncSession) -> str:
    """Generate and execute SQL from natural language question.
    Uses the LLM to generate SQL, then runs it against SQLite.
    Falls back to keyword-based queries if no LLM available."""

    msg_lower = message.lower()
    context_parts = []

    # Policy-specific queries
    policy_match = re.search(r'(COMM-\d{4}-\d{3}|P-\d{4})', message, re.IGNORECASE)
    if policy_match:
        policy_num = policy_match.group(1).upper()
        result = await db.execute(text(f"""
            SELECT p.policy_number, p.policyholder_name, p.industry_type, p.premium,
                   p.effective_date, p.expiration_date,
                   COUNT(c.id) as claim_count,
                   COALESCE(SUM(c.claim_amount), 0) as total_claims,
                   COALESCE(AVG(c.claim_amount), 0) as avg_claim,
                   COALESCE(MAX(c.claim_amount), 0) as max_claim
            FROM policies p
            LEFT JOIN claims c ON p.id = c.policy_id
            WHERE p.policy_number = '{policy_num}'
            GROUP BY p.id
        """))
        row = result.fetchone()
        if row:
            pn, name, ind, prem, eff, exp, cnt, tot, avg, mx = row
            lr = (tot / prem * 100) if prem > 0 else 0
            context_parts.append(f"""
POLICY {pn}:
- Policyholder: {name}
- Industry: {ind}
- Premium: ${prem:,.2f}
- Effective: {eff} → Expiration: {exp}
- Claims: {cnt} | Total: ${tot:,.2f} | Avg: ${avg:,.2f} | Max: ${mx:,.2f}
- Loss Ratio: {lr:.1f}%
""")

    # Claims queries
    if any(w in msg_lower for w in ["claim", "loss", "incident", "severity", "frequency"]):
        result = await db.execute(text("""
            SELECT COUNT(*), COALESCE(SUM(claim_amount), 0),
                   COALESCE(AVG(claim_amount), 0), COALESCE(MAX(claim_amount), 0)
            FROM claims
        """))
        row = result.fetchone()
        if row:
            context_parts.append(f"""
CLAIMS OVERVIEW:
- Total Claims: {row[0]}
- Total Amount: ${row[1]:,.2f}
- Average: ${row[2]:,.2f}
- Largest: ${row[3]:,.2f}
""")

    # Policy portfolio
    if any(w in msg_lower for w in ["portfolio", "all policies", "total policies", "how many", "list"]):
        result = await db.execute(text("""
            SELECT COUNT(*), COALESCE(SUM(premium), 0), COALESCE(AVG(premium), 0)
            FROM policies
        """))
        row = result.fetchone()
        if row:
            context_parts.append(f"""
PORTFOLIO SUMMARY:
- Total Policies: {row[0]}
- Total Premium: ${row[1]:,.2f}
- Average Premium: ${row[2]:,.2f}
""")

    # Industry breakdown
    if any(w in msg_lower for w in ["industry", "sector", "type", "breakdown"]):
        result = await db.execute(text("""
            SELECT industry_type, COUNT(*) as cnt, SUM(premium) as total_prem
            FROM policies GROUP BY industry_type ORDER BY cnt DESC
        """))
        rows = result.fetchall()
        if rows:
            lines = "INDUSTRY BREAKDOWN:\n"
            for r in rows:
                lines += f"- {r[0]}: {r[1]} policies, ${r[2]:,.2f} premium\n"
            context_parts.append(lines)

    # Decisions
    if any(w in msg_lower for w in ["decision", "accept", "decline", "refer"]):
        result = await db.execute(text("""
            SELECT decision, COUNT(*) FROM decisions GROUP BY decision
        """))
        rows = result.fetchall()
        if rows:
            lines = "DECISION HISTORY:\n"
            for r in rows:
                lines += f"- {r[0].title()}: {r[1]}\n"
            context_parts.append(lines)

    # High risk
    if any(w in msg_lower for w in ["high risk", "risky", "worst", "danger", "review"]):
        result = await db.execute(text("""
            SELECT p.policy_number, p.policyholder_name,
                   COUNT(c.id) as claims, COALESCE(SUM(c.claim_amount), 0) as total
            FROM policies p
            LEFT JOIN claims c ON p.id = c.policy_id
            GROUP BY p.id
            HAVING claims >= 3 OR total >= 50000
            ORDER BY total DESC LIMIT 5
        """))
        rows = result.fetchall()
        if rows:
            lines = "HIGH RISK POLICIES:\n"
            for r in rows:
                lines += f"- {r[0]} ({r[1]}): {r[2]} claims, ${r[3]:,.2f}\n"
            context_parts.append(lines)

    return "\n".join(context_parts)


# ──── LLM Providers ────

def _has_gemini():
    return bool(GOOGLE_API_KEY and GOOGLE_API_KEY != "your-google-api-key-here")

def _has_openai():
    return bool(OPENAI_API_KEY and OPENAI_API_KEY != "your-openai-api-key-here")


async def _gemini_response(message: str, history: list, context: str, guideline_context: str) -> str:
    """Google Gemini 1.5 Flash response (FREE tier)."""
    import google.generativeai as genai

    genai.configure(api_key=GOOGLE_API_KEY)
    
    full_prompt = SYSTEM_PROMPT
    if guideline_context:
        full_prompt += f"\n\nRELEVANT GUIDELINES:\n{guideline_context}"
    if context:
        full_prompt += f"\n\nDATABASE CONTEXT:\n{context}"

    # Convert history to Gemini format
    gemini_history = []
    for msg in history[-20:]:
        role = "user" if msg["role"] == "user" else "model"
        gemini_history.append({"role": role, "parts": [msg["content"]]})
    
    gemini_history.append({"role": "user", "parts": [message]})

    try:
        model = genai.GenerativeModel("gemini-flash-latest", system_instruction=full_prompt)
        response = model.generate_content(
            gemini_history,
            generation_config={"temperature": 0.7, "max_output_tokens": 1000}
        )
        return response.text
    except Exception as e:
        print(f"Gemini error details: {str(e)}")
        raise e


async def _openai_response(message: str, history: list, context: str, guideline_context: str) -> str:
    """OpenAI GPT-4o-mini response."""
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=OPENAI_API_KEY)

    full_context = SYSTEM_PROMPT
    if guideline_context:
        full_context += f"\n\nRELEVANT GUIDELINES:\n{guideline_context}"
    if context:
        full_context += f"\n\nDATABASE CONTEXT:\n{context}"

    messages = [{"role": "system", "content": full_context}]
    for msg in history[-20:]:
        messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": message})

    response = await client.chat.completions.create(
        model="gpt-4o-mini", messages=messages, temperature=0.7, max_tokens=800
    )
    return response.choices[0].message.content


async def _llm_response(message: str, history: list, db: AsyncSession) -> tuple:
    """Unified LLM call: Gemini → OpenAI → Smart Mock."""

    # 1. RAG: Search ChromaDB for guidelines
    rag_results = search_similar(message, k=5)
    sources = [{"section": r["section"], "title": r["title"]} for r in rag_results] if rag_results else []
    guideline_context = "\n".join([f"- [{r['section']}] {r['content']}" for r in rag_results]) if rag_results else ""

    # 2. NL→SQL: Get structured data context
    data_context = await _nl_to_sql_query(message, db)

    # 3. Try LLMs in order
    provider = "mock"
    if _has_gemini():
        try:
            text_resp = await _gemini_response(message, history, data_context, guideline_context)
            provider = "gemini"
            return text_resp, sources, provider
        except Exception as e:
            print(f"Gemini error: {e}")

    if _has_openai():
        try:
            text_resp = await _openai_response(message, history, data_context, guideline_context)
            provider = "openai"
            return text_resp, sources, provider
        except Exception as e:
            print(f"OpenAI error: {e}")

    # 4. Smart mock fallback
    text_resp = _build_mock_response(message, data_context, guideline_context, rag_results)
    return text_resp, sources, "mock"


def _build_mock_response(message: str, data_context: str, guideline_context: str, rag_results: list) -> str:
    """Smart mock that uses real data but no LLM."""
    parts = []

    if data_context:
        parts.append(data_context.strip())

    if rag_results:
        parts.append("\n📖 **Relevant Guidelines:**")
        for r in rag_results[:3]:
            parts.append(f"- **{r['section']}**: {r['content'][:200]}")

    if parts:
        result = "\n".join(parts)
        result += "\n\n💡 *For AI-powered insights, set a Google API key (free) in backend/.env*"
        return result

    return (
        "I'm **RiskMind DataBot**. Try asking:\n"
        "• \"Analyze COMM-2024-001\"\n"
        "• \"Show me the claims overview\"\n"
        "• \"What are the underwriting guidelines?\"\n"
        "• \"Which policies are high risk?\"\n"
        "• \"What's the portfolio breakdown by industry?\"\n\n"
        "💡 *Set `GOOGLE_API_KEY` in backend/.env for full AI capabilities (free)*"
    )


# ──── Vision Analysis ────

async def _analyze_image_gemini(image_base64: str, prompt: str) -> str:
    """Analyze image with Gemini Vision (FREE)."""
    import google.generativeai as genai
    import PIL.Image
    import io

    genai.configure(api_key=GOOGLE_API_KEY)

    image_bytes = base64.b64decode(image_base64)
    image = PIL.Image.open(io.BytesIO(image_bytes))

    try:
        model = genai.GenerativeModel("gemini-flash-latest", system_instruction=SYSTEM_PROMPT)
        response = model.generate_content([prompt, image])
        return response.text
    except Exception as e:
        print(f"Gemini vision error: {e}")
        raise e


async def _analyze_image_openai(image_base64: str, prompt: str) -> str:
    """Analyze image with GPT-4o Vision."""
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=OPENAI_API_KEY)

    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[{
            "role": "user",
            "content": [
                {"type": "text", "text": f"{SYSTEM_PROMPT}\n\n{prompt}"},
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}}
            ]
        }],
        max_tokens=600
    )
    return response.choices[0].message.content


async def _analyze_image(image_base64_or_path: str, prompt: str, is_file: bool = False) -> str:
    """Route image analysis to best available provider."""
    if is_file:
        with open(image_base64_or_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("utf-8")
    else:
        b64 = image_base64_or_path

    if _has_gemini():
        try:
            return await _analyze_image_gemini(b64, prompt)
        except Exception as e:
            print(f"Gemini vision error: {e}")

    if _has_openai():
        try:
            return await _analyze_image_openai(b64, prompt)
        except Exception as e:
            print(f"OpenAI vision error: {e}")

    return "Image analysis requires a Google API key (free) or OpenAI API key. Please configure one in backend/.env"



# ──── Video Analysis ────

async def _analyze_video(file_path: str, prompt: str) -> str:
    """Analyze video using Gemini File API (Upload -> Process -> Generate)."""
    import google.generativeai as genai
    genai.configure(api_key=GOOGLE_API_KEY)

    try:
        # 1. Upload file
        print(f"Uploading video: {file_path}")
        video_file = genai.upload_file(file_path)
        print(f"Upload complete: {video_file.uri}")

        # 2. Wait for processing
        while video_file.state.name == "PROCESSING":
            print("Processing video...")
            time.sleep(2)
            video_file = genai.get_file(video_file.name)

        if video_file.state.name == "FAILED":
            raise ValueError("Video processing failed.")

        # 3. Generate content
        model_name = os.getenv("GEMINI_MODEL", "").strip()
        model_candidates = [
            model_name,
            "gemini-1.5-flash-latest",
            "gemini-1.5-flash",
            "gemini-flash-latest",
        ]
        model_candidates = [m for m in model_candidates if m]

        last_error: Exception | None = None
        for candidate in model_candidates:
            try:
                model = genai.GenerativeModel(candidate, system_instruction=SYSTEM_PROMPT)
                response = model.generate_content([prompt, video_file])
                return response.text
            except Exception as e:
                last_error = e

        if last_error:
            raise last_error

    except Exception as e:
        print(f"Video analysis error: {e}")
        return f"Video analysis failed: {str(e)}"


async def _analyze_pdf(file_path: str) -> str:
    """Extract and analyze PDF text."""
    from pypdf import PdfReader
    reader = PdfReader(file_path)
    full_text = ""
    for page in reader.pages[:20]:
        full_text += page.extract_text() + "\n"

    if not full_text.strip():
        return "Could not extract text from this PDF."

    prompt = f"Analyze this insurance document. Summarize key findings, risks, and relevant data:\n\n{full_text[:8000]}"

    if _has_gemini():
        try:
            import google.generativeai as genai
            genai.configure(api_key=GOOGLE_API_KEY)
            model = genai.GenerativeModel("gemini-flash-latest", system_instruction=SYSTEM_PROMPT)
            response = model.generate_content(prompt)
            return response.text
        except Exception as e:
            print(f"Gemini PDF error: {e}")

    if _has_openai():
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=OPENAI_API_KEY)
            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=600
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"OpenAI PDF error: {e}")

    return f"**Extracted Text (first 2000 chars):**\n\n{full_text[:2000]}\n\n💡 *Set GOOGLE_API_KEY for AI-powered analysis*"


# ──── Session Management ────

async def _get_or_create_session(session_id: Optional[int], user_email: str, db: AsyncSession) -> int:
    if session_id:
        result = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
        session = result.scalar_one_or_none()
        if session:
            return session.id

    new_session = ChatSession(user_email=user_email, title="New Chat")
    db.add(new_session)
    await db.commit()
    await db.refresh(new_session)
    return new_session.id


async def _save_message(session_id: int, role: str, content: str, db: AsyncSession,
                         file_url: str = None, sources_json: str = None):
    msg = ChatMessage(
        session_id=session_id, role=role, content=content,
        file_url=file_url, sources=sources_json, created_at=datetime.utcnow()
    )
    db.add(msg)
    await db.commit()


async def _update_session_title(session_id: int, first_message: str, db: AsyncSession):
    title = first_message[:80].strip()
    if len(first_message) > 80:
        title += "..."
    result = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
    session = result.scalar_one_or_none()
    if session and session.title == "New Chat":
        session.title = title
        await db.commit()


# ══════════════════════════════════════════════════
# ROUTES
# ══════════════════════════════════════════════════

@router.post("/", response_model=ChatResponse)
async def chat(request: ChatRequest, db: AsyncSession = Depends(get_db)):
    """Send a message to RiskMind DataBot. Uses Gemini (free) → OpenAI → mock."""
    sid = await _get_or_create_session(request.session_id, request.user_email, db)
    await _save_message(sid, "user", request.message, db)
    await _update_session_title(sid, request.message, db)

    # Load conversation history
    result = await db.execute(
        select(ChatMessage).where(ChatMessage.session_id == sid).order_by(ChatMessage.created_at.asc())
    )
    db_msgs = result.scalars().all()
    history = [{"role": m.role, "content": m.content} for m in db_msgs[:-1]]

    # Intent-driven pipeline (context-aware SQL + analysis object)
    response_text = None
    sources = []
    provider = "intent-engine"
    analysis_object = None
    recommended_modes = None
    default_mode = None
    provenance = None
    inferred_intent = None
    output_type = None
    suggested_outputs = None
    artifact = None

    clarification_needed = False
    suggested_intents = []
    suggest_canvas_view = False
    show_canvas_summary = True

    try:
        # Pass history for context-aware follow-up questions
        pipeline = await run_intent_pipeline(request.message, db, history)
        response_text = pipeline.get("analysis_text")
        analysis_object = pipeline.get("analysis_object")
        recommended_modes = pipeline.get("recommended_modes")
        default_mode = pipeline.get("default_mode")
        provenance = pipeline.get("provenance")
        inferred_intent = pipeline.get("inferred_intent")
        output_type = pipeline.get("output_type")
        suggested_outputs = pipeline.get("suggested_outputs")
        artifact = pipeline.get("artifact")
        clarification_needed = pipeline.get("clarification_needed", False)
        suggested_intents = pipeline.get("suggested_intents", [])
        suggest_canvas_view = pipeline.get("suggest_canvas_view", False)
        show_canvas_summary = pipeline.get("show_canvas_summary", True)
    except Exception as e:
        print(f"Intent pipeline error: {e}")

    # Handle clarification needed
    if clarification_needed and not response_text:
        response_text = (
            "I'm not entirely sure what you're looking for. Could you help me understand better?\n\n"
            "You can click one of the options below, or rephrase your question with more details."
        )
        provider = "intent-engine"

    if not response_text:
        # Fallback to LLM response
        response_text, sources, provider = await _llm_response(request.message, history, db)

        # Check if LLM-generated response is long and should suggest canvas view
        if response_text and len(response_text) > 500:
            suggest_canvas_view = True
            # For UNDERSTAND intent with long response, show canvas summary
            if inferred_intent == "Understand":
                show_canvas_summary = True

                # Use Query Library (Tier 1) to fetch contextual summary metrics.
                # The library's PF-006 "portfolio overview" query covers the common
                # case. For more specific questions, it matches the right golden query.
                # This is NOT hardcoded SQL — it routes through the same golden query
                # library used across the entire intent engine pipeline.
                try:
                    from services.query_library import get_query_by_id, match_query
                    from sqlalchemy import text as sql_text

                    # Find best matching library query for this message
                    match = match_query(request.message)
                    if match is None:
                        # Fallback to portfolio overview (PF-006) for general portfolio queries
                        lower_msg = request.message.lower()
                        if any(w in lower_msg for w in ["portfolio", "policies", "claims", "overview", "high risk", "risk"]):
                            match = ("PF-006", get_query_by_id("PF-006"))

                    if match:
                        qid, entry = match
                        # Only run aggregate queries (single-row summaries) for the metrics card
                        if entry and entry.get("is_aggregate") and not entry.get("params"):
                            result = await db.execute(sql_text(entry["sql"]))
                            row = result.fetchone()
                            columns = result.keys() if hasattr(result, 'keys') else []

                            if row:
                                if not analysis_object:
                                    analysis_object = {}
                                if "metrics" not in analysis_object:
                                    analysis_object["metrics"] = {}

                                # Map returned columns to metrics dict dynamically
                                row_dict = dict(zip(columns, row)) if columns else {}
                                # Normalize common column name variants
                                col_map = {
                                    "policy_count": "policy_count",
                                    "total_policies": "policy_count",
                                    "total_premium": "total_premium",
                                    "total_premium_ever": "total_premium",
                                    "claim_count": "claim_count",
                                    "total_claims": "total_amount",
                                    "total_paid": "total_amount",
                                    "avg_claim": "avg_amount",
                                    "avg_claim_amount": "avg_amount",
                                    "max_claim": "max_claim",
                                    "loss_ratio_pct": "loss_ratio",
                                }
                                for src_col, dest_key in col_map.items():
                                    if src_col in row_dict and row_dict[src_col] is not None:
                                        analysis_object["metrics"][dest_key] = row_dict[src_col]

                                # Compute loss_ratio if not directly returned
                                if "loss_ratio" not in analysis_object["metrics"]:
                                    prem = analysis_object["metrics"].get("total_premium", 0)
                                    paid = analysis_object["metrics"].get("total_amount", 0)
                                    if prem and prem > 0:
                                        analysis_object["metrics"]["loss_ratio"] = round(paid / prem * 100, 1)

                                print(f"[chat] Summary metrics populated via library query [{qid}]")

                except Exception as e:
                    print(f"[chat] Summary metrics via query library failed: {e}")

    # Add canvas suggestion for long responses
    if suggest_canvas_view and response_text:
        response_text += "\n\n📊 *For a better view of all the details, check the Intelligent Canvas on the right.*"

    await _save_message(sid, "assistant", response_text, db,
                         sources_json=json.dumps(sources) if sources else None)

    return ChatResponse(
        response=response_text,
        sources=sources,
        provider=provider,
        session_id=sid,
        analysis_object=analysis_object,
        recommended_modes=recommended_modes,
        default_mode=default_mode,
        provenance=provenance,
        inferred_intent=inferred_intent,
        output_type=output_type,
        suggested_outputs=suggested_outputs,
        artifact=artifact,
        clarification_needed=clarification_needed,
        suggested_intents=suggested_intents,
        suggest_canvas_view=suggest_canvas_view,
        show_canvas_summary=show_canvas_summary
    )


@router.post("/vision", response_model=ChatResponse)
async def vision_chat(request: VisionRequest, db: AsyncSession = Depends(get_db)):
    """Analyze an image from camera or upload (base64). Gemini Vision (free) or GPT-4o."""
    sid = await _get_or_create_session(request.session_id, request.user_email, db)
    await _save_message(sid, "user", f"📷 [Image captured] {request.prompt}", db)

    analysis = await _analyze_image(request.image_base64, request.prompt)
    provider = "gemini" if _has_gemini() else "openai" if _has_openai() else "mock"

    await _save_message(sid, "assistant", analysis, db)

    return ChatResponse(response=analysis, sources=[], provider=provider, session_id=sid)


@router.get("/sessions", response_model=List[SessionOut])
async def list_sessions(user_email: str = "demo@ltm.com", db: AsyncSession = Depends(get_db)):
    """List chat sessions (last 2 days)."""
    cutoff = datetime.utcnow() - timedelta(days=2)
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.user_email == user_email)
        .where(ChatSession.created_at >= cutoff)
        .order_by(desc(ChatSession.updated_at))
    )
    sessions = result.scalars().all()

    out = []
    for s in sessions:
        msg_result = await db.execute(select(ChatMessage).where(ChatMessage.session_id == s.id))
        msg_count = len(msg_result.scalars().all())
        out.append(SessionOut(
            id=s.id, title=s.title,
            created_at=s.created_at.isoformat(),
            updated_at=s.updated_at.isoformat() if s.updated_at else s.created_at.isoformat(),
            message_count=msg_count
        ))
    return out


@router.get("/sessions/{session_id}", response_model=List[MessageOut])
async def get_session_messages(session_id: int, db: AsyncSession = Depends(get_db)):
    """Get messages for a session."""
    result = await db.execute(
        select(ChatMessage).where(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at.asc())
    )
    messages = result.scalars().all()
    return [MessageOut(
        id=m.id, role=m.role, content=m.content, file_url=m.file_url,
        sources=m.sources, created_at=m.created_at.isoformat()
    ) for m in messages]


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a session."""
    await db.execute(delete(ChatMessage).where(ChatMessage.session_id == session_id))
    await db.execute(delete(ChatSession).where(ChatSession.id == session_id))
    await db.commit()
    return {"status": "deleted"}


@router.post("/upload", response_model=UploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    user_prompt: str = Form(""),
    session_id: int = Form(0),
    db: AsyncSession = Depends(get_db)
):
    """Upload PDF or image for AI analysis."""
    ext = os.path.splitext(file.filename)[1].lower()
    ext = os.path.splitext(file.filename)[1].lower()
    allowed = {".pdf", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tiff", ".mp4", ".mov", ".avi", ".mkv"}
    if ext not in allowed:
        raise HTTPException(400, f"Unsupported type: {ext}")

    unique_name = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_name)
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    is_image = ext in {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tiff"}
    is_video = ext in {".mp4", ".mov", ".avi", ".mkv"}
    file_type = "image" if is_image else "video" if is_video else "pdf"

    analysis = None
    try:
        if is_image:
            analysis = await _analyze_image(file_path, user_prompt or "Analyze this document for insurance underwriting.", is_file=True)
        elif is_video:
            analysis = await _analyze_video(file_path, user_prompt or "Analyze this video property walkthrough. Identify risks, safety hazards, and property condition.")
        else:
            analysis = await _analyze_pdf(file_path)
    except Exception as e:
        analysis = f"Analysis error: {str(e)}"

    doc = Document(
        filename=file.filename, file_path=file_path, file_type=file_type,
        file_size=len(content), uploaded_by="demo_user", analysis_summary=analysis
    )
    db.add(doc)
    await db.commit()

    return UploadResponse(
        file_url=f"/api/uploads/{unique_name}", filename=file.filename,
        file_type=file_type, analysis=analysis
    )


@router.get("/provider")
async def get_provider_info():
    """Get current LLM provider status."""
    return {
        "gemini_active": _has_gemini(),
        "openai_active": _has_openai(),
        "active_provider": "gemini" if _has_gemini() else "openai" if _has_openai() else "mock",
        "vision_available": _has_gemini() or _has_openai()
    }
