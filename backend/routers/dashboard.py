"""
Dashboard Router - aggregate data for interactive dashboards
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from database.connection import get_db

router = APIRouter()


async def _fetch_rows(db: AsyncSession, sql: str):
    result = await db.execute(text(sql))
    rows = result.fetchall()
    return [dict(row._mapping) for row in rows]


@router.get("/data")
async def get_dashboard_data(db: AsyncSession = Depends(get_db)):
    """Return a cached snapshot of all core tables for dashboard use."""
    policies = await _fetch_rows(db, """
        SELECT id, policy_number, policyholder_name, industry_type, effective_date, expiration_date,
               premium, latitude, longitude, created_at
        FROM policies
        ORDER BY policy_number
    """)
    claims = await _fetch_rows(db, """
        SELECT c.id, c.claim_number, c.policy_id, c.claim_date, c.claim_amount, c.claim_type,
               c.status, c.description, c.evidence_files, c.created_at,
               p.policy_number, p.policyholder_name
        FROM claims c
        LEFT JOIN policies p ON p.id = c.policy_id
        ORDER BY c.claim_date DESC
    """)
    guidelines = await _fetch_rows(db, """
        SELECT id, section_code, title, content, category, policy_number, threshold_type, threshold_value, action
        FROM guidelines
        ORDER BY section_code
    """)
    decisions = await _fetch_rows(db, """
        SELECT id, policy_number, decision, reason, risk_level, decided_by, created_at
        FROM decisions
        ORDER BY created_at DESC
    """)
    documents = await _fetch_rows(db, """
        SELECT id, filename, file_path, file_type, file_size, uploaded_by, analysis_summary, created_at
        FROM documents
        ORDER BY created_at DESC
    """)
    chat_sessions = await _fetch_rows(db, """
        SELECT id, user_email, title, created_at, updated_at
        FROM chat_sessions
        ORDER BY updated_at DESC
    """)
    chat_messages = await _fetch_rows(db, """
        SELECT id, session_id, role, content, file_url, sources, created_at
        FROM chat_messages
        ORDER BY created_at DESC
        LIMIT 500
    """)

    return {
        "policies": policies,
        "claims": claims,
        "guidelines": guidelines,
        "decisions": decisions,
        "documents": documents,
        "chat_sessions": chat_sessions,
        "chat_messages": chat_messages,
        "snapshot": "cached",
    }