"""
Claims Router - API endpoints for claims data
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from typing import List, Optional
from pydantic import BaseModel
import os
import uuid
import json
from urllib.parse import urlparse
import httpx

from database.connection import get_db
from models.schemas import ClaimRecord, Policy, ClaimResponse, PolicyResponse, Document
from routers.chat import _analyze_video, _analyze_image, _analyze_pdf

router = APIRouter()

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTS = {".pdf", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tiff", ".mp4", ".mov", ".avi", ".mkv"}
CONTENT_TYPE_MAP = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/bmp": ".bmp",
    "image/tiff": ".tiff",
    "application/pdf": ".pdf",
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "video/x-msvideo": ".avi",
    "video/x-matroska": ".mkv",
}

MAX_EVIDENCE_BYTES = 25 * 1024 * 1024


class EvidenceAnalyzeRequest(BaseModel):
    url: str
    prompt: Optional[str] = None


class EvidenceAnalyzeResponse(BaseModel):
    file_url: str
    file_type: str
    analysis: Optional[str] = None


class EvidenceUploadResponse(BaseModel):
    file_url: str
    file_type: str
    analysis: Optional[str] = None
    claim_id: int
    claim_number: str
    local_path: str


@router.get("/", response_model=List[ClaimResponse])
async def get_all_claims(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """Get all claims with pagination"""
    result = await db.execute(
        select(ClaimRecord).offset(skip).limit(limit)
    )
    return result.scalars().all()


@router.get("/policy/{policy_number}", response_model=List[ClaimResponse])
async def get_claims_by_policy(
    policy_number: str,
    db: AsyncSession = Depends(get_db)
):
    """Get all claims for a specific policy"""
    # First get the policy
    policy_result = await db.execute(
        select(Policy).where(Policy.policy_number == policy_number)
    )
    policy = policy_result.scalar_one_or_none()
    
    if not policy:
        raise HTTPException(status_code=404, detail=f"Policy {policy_number} not found")
    
    # Get claims for this policy
    claims_result = await db.execute(
        select(ClaimRecord).where(ClaimRecord.policy_id == policy.id)
    )
    return claims_result.scalars().all()


@router.get("/summary/{policy_number}")
async def get_claims_summary(
    policy_number: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get claims summary with Glass Box evidence (SQL query shown)
    """
    sql_query = f"""
        SELECT 
            COUNT(*) as total_claims,
            SUM(claim_amount) as total_amount,
            AVG(claim_amount) as avg_amount,
            MAX(claim_amount) as max_claim
        FROM claims c
        JOIN policies p ON c.policy_id = p.id
        WHERE p.policy_number = '{policy_number}'
    """
    
    try:
        result = await db.execute(text(sql_query))
        row = result.fetchone()
        
        if row and row[0] > 0:
            return {
                "success": True,
                "data": {
                    "total_claims": row[0],
                    "total_amount": row[1],
                    "avg_amount": round(row[2], 2) if row[2] else 0,
                    "max_claim": row[3]
                },
                "glass_box": {
                    "sql_query": sql_query.strip(),
                    "source": "riskmind.db"
                }
            }
        else:
            return {
                "success": True,
                "data": {
                    "total_claims": 0,
                    "total_amount": 0,
                    "avg_amount": 0,
                    "max_claim": 0
                },
                "glass_box": {
                    "sql_query": sql_query.strip(),
                    "source": "riskmind.db"
                }
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/evidence/analyze", response_model=EvidenceAnalyzeResponse)
async def analyze_evidence(request: EvidenceAnalyzeRequest):
    """Fetch remote evidence, cache it locally, and run AI analysis."""
    url = request.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="Evidence URL is required.")

    # Handle already-cached uploads
    if url.startswith("/api/uploads/"):
        file_name = os.path.basename(url)
        file_path = os.path.join(UPLOAD_DIR, file_name)
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Cached evidence file not found.")
        ext = os.path.splitext(file_name)[1].lower()
    else:
        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"}:
            raise HTTPException(status_code=400, detail="Only http/https evidence URLs are supported.")

        ext = os.path.splitext(parsed.path)[1].lower()
        content_type = ""
        content_length = None

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
            "Accept": "*/*",
            "Referer": url,
        }

        async with httpx.AsyncClient(timeout=30, follow_redirects=True, headers=headers) as client:
            try:
                head = await client.head(url)
                content_type = head.headers.get("content-type", "")
                if head.headers.get("content-length"):
                    content_length = int(head.headers["content-length"])
            except Exception:
                content_type = ""

            if not ext and content_type:
                ext = CONTENT_TYPE_MAP.get(content_type.split(";")[0].strip(), "")

            if ext not in ALLOWED_EXTS:
                raise HTTPException(status_code=400, detail=f"Unsupported evidence type: {ext or content_type}")

            if content_length and content_length > MAX_EVIDENCE_BYTES:
                raise HTTPException(status_code=400, detail="Evidence file exceeds 25MB limit.")

            unique_name = f"{uuid.uuid4().hex}{ext}"
            file_path = os.path.join(UPLOAD_DIR, unique_name)

            total = 0
            try:
                async with client.stream("GET", url) as response:
                    response.raise_for_status()
                    with open(file_path, "wb") as f:
                        async for chunk in response.aiter_bytes():
                            total += len(chunk)
                            if total > MAX_EVIDENCE_BYTES:
                                raise HTTPException(status_code=400, detail="Evidence file exceeds 25MB limit.")
                            f.write(chunk)
            except httpx.HTTPStatusError as e:
                raise HTTPException(
                    status_code=400,
                    detail=f"Evidence host rejected the request ({e.response.status_code}). Try uploading the file directly."
                ) from e

    is_image = ext in {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tiff"}
    is_video = ext in {".mp4", ".mov", ".avi", ".mkv"}
    file_type = "image" if is_image else "video" if is_video else "pdf"

    analysis_prompt = request.prompt
    if not analysis_prompt:
        analysis_prompt = (
            "Analyze this video property walkthrough. Identify risks, safety hazards, and property condition."
            if is_video else "Analyze this image for insurance underwriting risk context."
            if is_image else "Summarize this document for underwriting risks and key facts."
        )

    analysis = None
    try:
        if is_video:
            analysis = await _analyze_video(file_path, analysis_prompt)
        elif is_image:
            analysis = await _analyze_image(file_path, analysis_prompt, is_file=True)
        else:
            analysis = await _analyze_pdf(file_path)
    except Exception as e:
        analysis = f"Analysis error: {str(e)}"

    file_url = f"/api/uploads/{os.path.basename(file_path)}"
    return EvidenceAnalyzeResponse(file_url=file_url, file_type=file_type, analysis=analysis)


@router.post("/{claim_id}/evidence/upload", response_model=EvidenceUploadResponse)
async def upload_claim_evidence(
    claim_id: int,
    file: UploadFile = File(...),
    description: str = Form(""),
    user_prompt: str = Form(""),
    db: AsyncSession = Depends(get_db)
):
    """Upload evidence and attach it to a claim."""
    result = await db.execute(select(ClaimRecord).where(ClaimRecord.id == claim_id))
    claim = result.scalar_one_or_none()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found.")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTS:
        raise HTTPException(status_code=400, detail=f"Unsupported type: {ext}")

    content = await file.read()
    if len(content) > MAX_EVIDENCE_BYTES:
        raise HTTPException(status_code=400, detail="Evidence file exceeds 25MB limit.")

    claim_dir = os.path.join(UPLOAD_DIR, "claims", claim.claim_number)
    os.makedirs(claim_dir, exist_ok=True)

    unique_name = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(claim_dir, unique_name)
    with open(file_path, "wb") as f:
        f.write(content)

    is_image = ext in {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tiff"}
    is_video = ext in {".mp4", ".mov", ".avi", ".mkv"}
    file_type = "image" if is_image else "video" if is_video else "pdf"

    analysis_prompt = user_prompt.strip()
    if not analysis_prompt:
        analysis_prompt = (
            "Analyze this video property walkthrough. Identify risks, safety hazards, and property condition."
            if is_video else "Analyze this image for insurance underwriting risk context."
            if is_image else "Summarize this document for underwriting risks and key facts."
        )

    analysis = None
    try:
        if is_video:
            analysis = await _analyze_video(file_path, analysis_prompt)
        elif is_image:
            analysis = await _analyze_image(file_path, analysis_prompt, is_file=True)
        else:
            analysis = await _analyze_pdf(file_path)
    except Exception as e:
        analysis = f"Analysis error: {str(e)}"

    file_url = f"/api/uploads/claims/{claim.claim_number}/{unique_name}"
    local_path = os.path.join("data", "uploads", "claims", claim.claim_number, unique_name)
    evidence_item = {
        "type": file_type,
        "url": file_url,
        "local_path": local_path,
        "description": description.strip() or file.filename
    }

    try:
        existing = json.loads(claim.evidence_files) if claim.evidence_files else []
        if not isinstance(existing, list):
            existing = []
    except Exception:
        existing = []

    existing.append(evidence_item)
    claim.evidence_files = json.dumps(existing)
    db.add(claim)

    # Also create a Document row (single source of truth for all uploads)
    policy_num = None
    if claim.policy_id:
        pol_result = await db.execute(select(Policy).where(Policy.id == claim.policy_id))
        pol = pol_result.scalar_one_or_none()
        if pol:
            policy_num = pol.policy_number
    doc = Document(
        filename=file.filename, file_path=file_path, file_type=file_type,
        file_size=len(content), uploaded_by="demo_user",
        analysis_summary=analysis,
        policy_number=policy_num,
        claim_number=claim.claim_number,
    )
    db.add(doc)
    await db.commit()

    # Index analysis into ChromaDB so RAG can find it
    if analysis and not analysis.startswith("Analysis error"):
        try:
            from services.vector_store import index_document
            index_document(doc.id, file.filename, file_type, analysis,
                           policy_number=policy_num or "", claim_number=claim.claim_number)
        except Exception as e:
            print(f"[Vector Store] document indexing skipped: {e}")

    return EvidenceUploadResponse(
        file_url=file_url,
        file_type=file_type,
        analysis=analysis,
        claim_id=claim.id,
        claim_number=claim.claim_number,
        local_path=local_path
    )
