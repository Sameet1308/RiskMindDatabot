"""
Claims Router - API endpoints for claims data
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from typing import List

from database.connection import get_db
from models.schemas import ClaimRecord, Policy, ClaimResponse, PolicyResponse

router = APIRouter()


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
