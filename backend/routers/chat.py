"""
Chat Router — Chat-first architecture with LangGraph agent pipeline.
LangChain unified LLM (Bedrock / Gemini / Claude / OpenAI), ChromaDB RAG,
Persistent Sessions, File Upload, Vision
"""
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, text, delete
from typing import List, Optional
from datetime import datetime, timedelta
import os
import json
import base64
import uuid
import time

from database.connection import get_db
from models.schemas import ChatSession, ChatMessage, Document
from services.agent_graph import run_agent_pipeline
from services.llm_providers import get_available_providers
from services.prompts import SYSTEM_PROMPT

router = APIRouter()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ──── Pydantic Schemas ────

class ChatMessageIn(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[int] = None
    user_email: str = "demo@apexuw.com"

class ChatResponse(BaseModel):
    response: str
    sources: List[dict] = []
    provider: str = "mock"
    session_id: int = 0
    analysis_object: Optional[dict] = None
    provenance: Optional[dict] = None
    inferred_intent: Optional[str] = None
    output_type: Optional[str] = None
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
    user_email: str = "demo@apexuw.com"


# ──── Cached Dashboard Data ────

_dashboard_cache: Optional[dict] = None
_dashboard_cache_time: float = 0

async def _get_cached_dashboard_data(db: AsyncSession) -> dict:
    """Fetch all tables, cached for 60 seconds."""
    global _dashboard_cache, _dashboard_cache_time
    if _dashboard_cache and (time.time() - _dashboard_cache_time) < 60:
        return _dashboard_cache

    async def _fetch(sql: str):
        result = await db.execute(text(sql))
        return [dict(row._mapping) for row in result.fetchall()]

    _dashboard_cache = {
        "policies": await _fetch("""
            SELECT id, policy_number, policyholder_name, industry_type,
                   effective_date, expiration_date, premium, latitude, longitude
            FROM policies ORDER BY policy_number
        """),
        "claims": await _fetch("""
            SELECT c.id, c.claim_number, c.policy_id, c.claim_date, c.claim_amount,
                   c.claim_type, c.status, c.description, c.evidence_files, c.created_at,
                   p.policy_number, p.policyholder_name
            FROM claims c LEFT JOIN policies p ON p.id = c.policy_id
            ORDER BY c.claim_date DESC
        """),
        "decisions": await _fetch("""
            SELECT id, policy_number, decision, reason, risk_level, decided_by, created_at
            FROM decisions ORDER BY created_at DESC
        """),
        "guidelines": await _fetch("""
            SELECT id, section_code, title, content, category
            FROM guidelines ORDER BY section_code
        """),
    }
    _dashboard_cache_time = time.time()
    return _dashboard_cache


# ──── LLM Helpers (vision only) ────

def _has_gemini():
    return bool(GOOGLE_API_KEY and GOOGLE_API_KEY != "your-google-api-key-here")

def _has_openai():
    return bool(OPENAI_API_KEY and OPENAI_API_KEY != "your-openai-api-key-here")


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
        model = genai.GenerativeModel(os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite"), system_instruction=SYSTEM_PROMPT)
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
    """Analyze video using Gemini File API."""
    import google.generativeai as genai
    genai.configure(api_key=GOOGLE_API_KEY)

    try:
        print(f"Uploading video: {file_path}")
        video_file = genai.upload_file(file_path)
        print(f"Upload complete: {video_file.uri}")

        while video_file.state.name == "PROCESSING":
            print("Processing video...")
            time.sleep(2)
            video_file = genai.get_file(video_file.name)

        if video_file.state.name == "FAILED":
            raise ValueError("Video processing failed.")

        model_name = os.getenv("GEMINI_MODEL", "").strip()
        model_candidates = [model_name, "gemini-2.0-flash", "gemini-2.5-flash-lite", "gemini-2.5-flash"]
        model_candidates = [m for m in model_candidates if m]

        last_error = None
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
            model = genai.GenerativeModel(os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite"), system_instruction=SYSTEM_PROMPT)
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

    return f"**Extracted Text (first 2000 chars):**\n\n{full_text[:2000]}\n\n*Set GOOGLE_API_KEY for AI-powered analysis*"


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
    """Chat-first: LangGraph agent handles intent routing, RAG, LLM call, and guardrails."""
    sid = await _get_or_create_session(request.session_id, request.user_email, db)
    await _save_message(sid, "user", request.message, db)
    await _update_session_title(sid, request.message, db)

    # Load conversation history
    result = await db.execute(
        select(ChatMessage).where(ChatMessage.session_id == sid).order_by(ChatMessage.created_at.asc())
    )
    db_msgs = result.scalars().all()
    history = [{"role": m.role, "content": m.content} for m in db_msgs[:-1]]

    # Load cached data snapshot (all tables, cached 60s)
    dashboard_data = await _get_cached_dashboard_data(db)

    # Run LangGraph agent pipeline (intent → data → RAG → confidence → LLM → guardrails)
    pipeline = await run_agent_pipeline(request.message, dashboard_data, history)

    response_text = pipeline.get("response", "")
    sources = pipeline.get("sources", [])

    await _save_message(sid, "assistant", response_text, db,
                         sources_json=json.dumps(sources) if sources else None)

    return ChatResponse(
        response=response_text,
        sources=sources,
        provider=pipeline.get("provider", "mock"),
        session_id=sid,
        analysis_object=pipeline.get("analysis_object"),
        provenance=pipeline.get("provenance"),
        inferred_intent=pipeline.get("inferred_intent"),
        output_type=pipeline.get("output_type"),
        clarification_needed=pipeline.get("clarification_needed", False),
        suggested_intents=pipeline.get("suggested_intents", []),
        suggest_canvas_view=pipeline.get("suggest_canvas_view", False),
        show_canvas_summary=pipeline.get("show_canvas_summary", True),
    )


@router.post("/vision", response_model=ChatResponse)
async def vision_chat(request: VisionRequest, db: AsyncSession = Depends(get_db)):
    """Analyze an image from camera or upload (base64)."""
    sid = await _get_or_create_session(request.session_id, request.user_email, db)
    await _save_message(sid, "user", f"[Image captured] {request.prompt}", db)

    analysis = await _analyze_image(request.image_base64, request.prompt)
    provider = "gemini" if _has_gemini() else "openai" if _has_openai() else "mock"

    await _save_message(sid, "assistant", analysis, db)

    return ChatResponse(response=analysis, sources=[], provider=provider, session_id=sid)


@router.get("/sessions", response_model=List[SessionOut])
async def list_sessions(user_email: str = "demo@apexuw.com", db: AsyncSession = Depends(get_db)):
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


@router.get("/geo/policies")
async def get_geo_policies(db: AsyncSession = Depends(get_db)):
    """Return policies with lat/lon and computed risk_level for geo map."""
    sql = text("""
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
        ORDER BY total_claims DESC
    """)
    result = await db.execute(sql)
    rows = [dict(r._mapping) for r in result.fetchall()]
    return rows


@router.get("/provider")
async def get_provider_info():
    """Get current LLM provider status (LangChain unified)."""
    return get_available_providers()
