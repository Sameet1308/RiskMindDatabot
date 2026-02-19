"""
Policies Router - List and detail view for all policies
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import List, Optional

from database.connection import get_db

router = APIRouter()


class PolicyListItem(BaseModel):
    policy_number: str
    policyholder_name: str
    industry_type: str
    premium: float
    effective_date: Optional[str] = None
    expiration_date: Optional[str] = None
    policy_status: str = "active"
    claim_count: int = 0
    total_claims: float = 0
    loss_ratio: float = 0
    risk_level: str = "low"
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class PolicyDetail(PolicyListItem):
    claims: List[dict] = []


@router.get("/", response_model=List[PolicyListItem])
async def list_policies(user_email: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    """List policies with summary statistics. Optionally filter by assigned user."""
    base_sql = """
        SELECT
            p.policy_number,
            p.policyholder_name,
            p.industry_type,
            p.premium,
            p.effective_date,
            p.expiration_date,
            p.policy_status,
            p.latitude,
            p.longitude,
            COUNT(c.id) as claim_count,
            COALESCE(SUM(c.claim_amount), 0) as total_claims,
            COALESCE(MAX(c.claim_amount), 0) as max_claim
        FROM policies p
        LEFT JOIN claims c ON p.id = c.policy_id
    """
    params = {}
    if user_email:
        base_sql += " WHERE p.assigned_to = :user_email"
        params["user_email"] = user_email
    base_sql += " GROUP BY p.id ORDER BY p.policy_number"
    result = await db.execute(text(base_sql), params)
    rows = result.fetchall()

    policies = []
    for row in rows:
        policy_num, holder, industry, premium, eff, exp, pol_status, lat, lon, claim_count, total_claims, max_claim = row
        loss_ratio = (total_claims / premium * 100) if premium and premium > 0 else 0

        if max_claim >= 100000 or claim_count >= 5:
            risk = "high"
        elif claim_count >= 3 or loss_ratio > 50:
            risk = "medium"
        else:
            risk = "low"

        policies.append(PolicyListItem(
            policy_number=policy_num,
            policyholder_name=holder,
            industry_type=industry,
            premium=premium,
            effective_date=str(eff) if eff else None,
            expiration_date=str(exp) if exp else None,
            policy_status=pol_status or "active",
            claim_count=claim_count,
            total_claims=round(total_claims, 2),
            loss_ratio=round(loss_ratio, 2),
            risk_level=risk,
            latitude=lat,
            longitude=lon
        ))

    return policies


@router.get("/{policy_number}", response_model=PolicyDetail)
async def get_policy(policy_number: str, db: AsyncSession = Depends(get_db)):
    """Get detailed policy information including all claims."""
    # Get policy
    result = await db.execute(
        text("""
            SELECT p.policy_number, p.policyholder_name, p.industry_type, p.premium,
                   p.effective_date, p.expiration_date
            FROM policies p WHERE p.policy_number = :pn
        """),
        {"pn": policy_number},
    )
    policy = result.fetchone()

    if not policy:
        raise HTTPException(status_code=404, detail=f"Policy {policy_number} not found")

    pol_num, holder, industry, premium, eff, exp = policy

    # Get claims
    result = await db.execute(
        text("""
            SELECT c.claim_number, c.claim_date, c.claim_amount, c.claim_type, c.status, c.description
            FROM claims c
            JOIN policies p ON c.policy_id = p.id
            WHERE p.policy_number = :pn
            ORDER BY c.claim_date DESC
        """),
        {"pn": policy_number},
    )
    claims_rows = result.fetchall()

    claims = [
        {
            "claim_number": r[0],
            "claim_date": str(r[1]) if r[1] else None,
            "claim_amount": r[2],
            "claim_type": r[3],
            "status": r[4],
            "description": r[5]
        }
        for r in claims_rows
    ]

    total_claims = sum(c["claim_amount"] for c in claims) if claims else 0
    max_claim = max((c["claim_amount"] for c in claims), default=0)
    loss_ratio = (total_claims / premium * 100) if premium and premium > 0 else 0

    if max_claim >= 100000 or len(claims) >= 5:
        risk = "high"
    elif len(claims) >= 3 or loss_ratio > 50:
        risk = "medium"
    else:
        risk = "low"

    return PolicyDetail(
        policy_number=pol_num,
        policyholder_name=holder,
        industry_type=industry,
        premium=premium,
        effective_date=str(eff) if eff else None,
        expiration_date=str(exp) if exp else None,
        claim_count=len(claims),
        total_claims=round(total_claims, 2),
        loss_ratio=round(loss_ratio, 2),
        risk_level=risk,
        claims=claims
    )
