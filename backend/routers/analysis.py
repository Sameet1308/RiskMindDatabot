"""
Analysis Router - Risk analysis with Glass Box explainability
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text

from database.connection import get_db
from models.schemas import Policy, ClaimRecord, AnalysisRequest, AnalysisResponse, GlassBoxEvidence
from services.ai_service import get_ai_analysis

router = APIRouter()


@router.post("/evaluate", response_model=AnalysisResponse)
async def evaluate_risk(
    request: AnalysisRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Evaluate risk for a policy with full Glass Box transparency.
    Shows SQL query, returned data, and guideline citations.
    """
    policy_number = request.policy_number
    
    # Step 1: Get claims data (Glass Box - show the SQL)
    sql_query = f"""
        SELECT 
            c.claim_number,
            c.claim_amount,
            c.claim_type,
            c.claim_date,
            c.status
        FROM claims c
        JOIN policies p ON c.policy_id = p.id
        WHERE p.policy_number = '{policy_number}'
        ORDER BY c.claim_date DESC
    """
    
    summary_sql = f"""
        SELECT 
            COUNT(*) as claim_count,
            COALESCE(SUM(claim_amount), 0) as total_amount,
            COALESCE(AVG(claim_amount), 0) as avg_amount,
            COALESCE(MAX(claim_amount), 0) as max_claim
        FROM claims c
        JOIN policies p ON c.policy_id = p.id
        WHERE p.policy_number = '{policy_number}'
    """
    
    try:
        # Execute summary query
        result = await db.execute(text(summary_sql))
        row = result.fetchone()
        
        claim_count = row[0] if row else 0
        total_amount = row[1] if row else 0
        avg_amount = row[2] if row else 0
        max_claim = row[3] if row else 0
        
        claims_summary = {
            "claim_count": claim_count,
            "total_amount": total_amount,
            "avg_amount": round(avg_amount, 2) if avg_amount else 0,
            "max_claim": max_claim
        }
        
        # Step 2: Apply underwriting rules (can be mock or AI)
        analysis = await get_ai_analysis(claims_summary, policy_number)
        
        # Step 3: Build Glass Box evidence
        evidence = GlassBoxEvidence(
            sql_query=summary_sql.strip(),
            data_returned=claims_summary,
            guideline_citation=analysis.get("guideline_text"),
            guideline_section=analysis.get("guideline_section")
        )
        
        return AnalysisResponse(
            recommendation=analysis["recommendation"],
            risk_level=analysis["risk_level"],
            reason=analysis["reason"],
            evidence=evidence,
            claims_summary=claims_summary
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/quick/{policy_number}")
async def quick_risk_check(
    policy_number: str,
    db: AsyncSession = Depends(get_db)
):
    """Quick risk assessment without full analysis"""
    sql = f"""
        SELECT COUNT(*), COALESCE(SUM(claim_amount), 0)
        FROM claims c
        JOIN policies p ON c.policy_id = p.id
        WHERE p.policy_number = '{policy_number}'
    """
    
    result = await db.execute(text(sql))
    row = result.fetchone()
    
    count = row[0] if row else 0
    total = row[1] if row else 0
    
    # Simple rules
    if count >= 5 or total >= 100000:
        risk = "high"
    elif count >= 3 or total >= 50000:
        risk = "medium"
    else:
        risk = "low"
    
    return {
        "policy_number": policy_number,
        "risk_level": risk,
        "claim_count": count,
        "total_claims_amount": total
    }
