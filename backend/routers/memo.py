"""
Memo Router - Underwriting memo generation from real data
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import List, Optional
from datetime import datetime

from database.connection import get_db

router = APIRouter()


class MemoSummary(BaseModel):
    total_claims: int
    total_amount: float
    avg_claim: float
    max_claim: float
    loss_ratio: float
    risk_level: str


class GuidelineRef(BaseModel):
    section: str
    text: str


class MemoResponse(BaseModel):
    policy_number: str
    policyholder: str
    industry: str
    premium: float
    memo_date: str
    summary: MemoSummary
    recommendation: str
    pricing_action: str
    reasons: List[str]
    guideline_references: List[GuidelineRef]
    memo_text: str


@router.get("/{policy_number}", response_model=MemoResponse)
async def generate_memo(
    policy_number: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Generate a structured underwriting memorandum for a policy.
    Built from real database data with guideline citations.
    """
    # Get policy details
    result = await db.execute(text(f"""
        SELECT p.id, p.policyholder_name, p.industry_type, p.premium,
               p.effective_date, p.expiration_date
        FROM policies p
        WHERE p.policy_number = '{policy_number}'
    """))
    policy = result.fetchone()

    if not policy:
        raise HTTPException(status_code=404, detail=f"Policy {policy_number} not found")

    policy_id, holder, industry, premium, eff_date, exp_date = policy

    # Get claims summary
    result = await db.execute(text(f"""
        SELECT COUNT(*), COALESCE(SUM(claim_amount), 0),
               COALESCE(AVG(claim_amount), 0), COALESCE(MAX(claim_amount), 0)
        FROM claims WHERE policy_id = {policy_id}
    """))
    row = result.fetchone()
    claim_count, total_amount, avg_claim, max_claim = row

    loss_ratio = (total_amount / premium * 100) if premium and premium > 0 else 0

    # Determine risk level and recommendation
    reasons = []
    guideline_refs = []

    if max_claim >= 100000:
        risk_level = "refer"
        recommendation = "REFER TO SENIOR UNDERWRITER"
        pricing_action = "Hold pending senior review"
        reasons.append(f"Single claim of ${max_claim:,.2f} exceeds $100,000 severity threshold")
        guideline_refs.append(GuidelineRef(section="4.3.2", text="Claims exceeding $100,000 require senior underwriter review"))
    elif claim_count >= 5:
        risk_level = "high"
        recommendation = "REVIEW REQUIRED — HIGH FREQUENCY"
        pricing_action = "Rate increase of 15-25% recommended"
        reasons.append(f"{claim_count} claims filed — exceeds frequency threshold")
        guideline_refs.append(GuidelineRef(section="3.1.1", text="5+ claims annually require enhanced review and loss control"))
    elif loss_ratio > 65:
        risk_level = "high"
        recommendation = "REVIEW REQUIRED — HIGH LOSS RATIO"
        pricing_action = "Rate increase of 10-20% recommended"
        reasons.append(f"Loss ratio of {loss_ratio:.1f}% exceeds 65% threshold")
        guideline_refs.append(GuidelineRef(section="5.1.3", text="Loss ratio over 65% requires mandatory rate increase"))
    elif claim_count >= 3 or loss_ratio > 50:
        risk_level = "medium"
        recommendation = "PROCEED WITH CAUTION"
        pricing_action = "Consider 5-10% rate adjustment"
        reasons.append(f"Moderate claims activity ({claim_count} claims, {loss_ratio:.1f}% loss ratio)")
        guideline_refs.append(GuidelineRef(section="5.1.2", text="Loss ratio 50-65% requires pricing review"))
    else:
        risk_level = "low"
        recommendation = "APPROVE — STANDARD TERMS"
        pricing_action = "No rate change needed"
        reasons.append(f"Loss ratio of {loss_ratio:.1f}% is within acceptable range")
        guideline_refs.append(GuidelineRef(section="5.1.1", text="Loss ratio under 50% — standard renewal"))

    # Additional reasons
    if loss_ratio < 50 and claim_count <= 2:
        reasons.append("Claims history demonstrates favorable risk profile")
    if claim_count == 0:
        reasons.append("No claims filed during review period — excellent performance")
    if loss_ratio > 50:
        reasons.append(f"Loss ratio of {loss_ratio:.1f}% exceeds industry benchmark of 50%")

    # Add frequency guideline if relevant
    if claim_count >= 3:
        guideline_refs.append(GuidelineRef(section="3.1.1", text="Frequency threshold: 5+ claims require enhanced review"))

    summary = MemoSummary(
        total_claims=claim_count,
        total_amount=round(total_amount, 2),
        avg_claim=round(avg_claim, 2),
        max_claim=round(max_claim, 2),
        loss_ratio=round(loss_ratio, 2),
        risk_level=risk_level
    )

    # Generate memo text
    memo_text = f"""UNDERWRITING MEMORANDUM
{'='*50}
Date: {datetime.utcnow().strftime('%B %d, %Y')}
Policy: {policy_number}
Insured: {holder}
Industry: {industry}
Annual Premium: ${premium:,.2f}

CLAIMS SUMMARY
{'-'*50}
Total Claims: {claim_count}
Total Amount: ${total_amount:,.2f}
Average Claim: ${avg_claim:,.2f}
Largest Claim: ${max_claim:,.2f}
Loss Ratio: {loss_ratio:.1f}%

RISK ASSESSMENT: {risk_level.upper()}
{'-'*50}
Recommendation: {recommendation}
Pricing Action: {pricing_action}

RATIONALE
{'-'*50}
{chr(10).join(f'• {r}' for r in reasons)}

GUIDELINE REFERENCES
{'-'*50}
{chr(10).join(f'• Section {g.section}: {g.text}' for g in guideline_refs)}

{'='*50}
Prepared by: RiskMind AI Underwriting Co-Pilot
"""

    return MemoResponse(
        policy_number=policy_number,
        policyholder=holder,
        industry=industry,
        premium=premium,
        memo_date=datetime.utcnow().strftime('%Y-%m-%d'),
        summary=summary,
        recommendation=recommendation,
        pricing_action=pricing_action,
        reasons=reasons,
        guideline_references=guideline_refs,
        memo_text=memo_text
    )
