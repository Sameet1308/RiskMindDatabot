"""
Guidelines Router - Underwriting guidelines endpoints
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from pydantic import BaseModel

from database.connection import get_db
from models.schemas import Guideline
from services.vector_store import upsert_guideline

router = APIRouter()


class GuidelineCreate(BaseModel):
    section_code: str
    title: str
    content: str
    category: Optional[str] = None
    policy_number: Optional[str] = None
    threshold_type: Optional[str] = None
    threshold_value: Optional[float] = None
    action: Optional[str] = None


@router.get("/")
async def get_all_guidelines(
    category: Optional[str] = None,
    policy_number: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Get all underwriting guidelines, optionally filtered by category"""
    query = select(Guideline)
    if category:
        query = query.where(Guideline.category == category)
    if policy_number:
        query = query.where(Guideline.policy_number == policy_number)
    
    result = await db.execute(query)
    guidelines = result.scalars().all()
    
    return {
        "success": True,
        "count": len(guidelines),
        "data": [
            {
                "section_code": g.section_code,
                "title": g.title,
                "content": g.content,
                "category": g.category,
                "policy_number": g.policy_number,
                "action": g.action
            }
            for g in guidelines
        ]
    }


@router.get("/search")
async def search_guidelines(
    query: str,
    db: AsyncSession = Depends(get_db)
):
    """Search guidelines by keyword"""
    # Simple text search (would use vector search with OpenSearch in production)
    result = await db.execute(
        select(Guideline).where(
            Guideline.content.contains(query) | 
            Guideline.title.contains(query)
        )
    )
    guidelines = result.scalars().all()
    
    return {
        "success": True,
        "query": query,
        "count": len(guidelines),
        "data": [
            {
                "section_code": g.section_code,
                "title": g.title,
                "content": g.content,
                "relevance_note": "Keyword match"
            }
            for g in guidelines
        ]
    }


@router.get("/{section_code}")
async def get_guideline(
    section_code: str,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific guideline by section code"""
    result = await db.execute(
        select(Guideline).where(Guideline.section_code == section_code)
    )
    guideline = result.scalar_one_or_none()
    
    if not guideline:
        raise HTTPException(status_code=404, detail=f"Guideline {section_code} not found")
    
    return {
        "success": True,
        "data": {
            "section_code": guideline.section_code,
            "title": guideline.title,
            "content": guideline.content,
            "category": guideline.category,
            "policy_number": guideline.policy_number,
            "threshold_type": guideline.threshold_type,
            "threshold_value": guideline.threshold_value,
            "action": guideline.action
        }
    }


@router.post("/")
async def create_guideline(
    payload: GuidelineCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a guideline and index it into the vector store."""
    guideline = Guideline(
        section_code=payload.section_code,
        title=payload.title,
        content=payload.content,
        category=payload.category,
        policy_number=payload.policy_number,
        threshold_type=payload.threshold_type,
        threshold_value=payload.threshold_value,
        action=payload.action,
    )
    db.add(guideline)
    await db.commit()
    await db.refresh(guideline)

    try:
        await upsert_guideline(guideline)
    except Exception as e:
        print(f"[Vector Store] Guideline index skipped: {e}")

    return {
        "success": True,
        "data": {
            "id": guideline.id,
            "section_code": guideline.section_code,
            "title": guideline.title,
            "content": guideline.content,
            "category": guideline.category,
            "policy_number": guideline.policy_number,
            "threshold_type": guideline.threshold_type,
            "threshold_value": guideline.threshold_value,
            "action": guideline.action
        }
    }
