"""
Decisions Router - Record underwriter Accept/Refer/Decline decisions
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from database.connection import get_db
from models.schemas import Decision

router = APIRouter(tags=["decisions"])


class DecisionRequest(BaseModel):
    policy_number: str
    decision: str  # accept, refer, decline
    reason: Optional[str] = None
    risk_level: Optional[str] = None


class DecisionResponse(BaseModel):
    id: int
    policy_number: str
    decision: str
    reason: Optional[str]
    risk_level: Optional[str]
    decided_by: str
    created_at: str


@router.post("/", response_model=DecisionResponse)
async def record_decision(req: DecisionRequest, db: AsyncSession = Depends(get_db)):
    """Record an underwriting decision on a policy"""
    decision = Decision(
        policy_number=req.policy_number,
        decision=req.decision,
        reason=req.reason,
        risk_level=req.risk_level,
        decided_by="demo_user",
        created_at=datetime.utcnow()
    )
    db.add(decision)
    await db.commit()
    await db.refresh(decision)

    return DecisionResponse(
        id=decision.id,
        policy_number=decision.policy_number,
        decision=decision.decision,
        reason=decision.reason,
        risk_level=decision.risk_level,
        decided_by=decision.decided_by,
        created_at=decision.created_at.isoformat()
    )


@router.get("/{policy_number}", response_model=List[DecisionResponse])
async def get_decisions(policy_number: str, db: AsyncSession = Depends(get_db)):
    """Get decision history for a policy"""
    result = await db.execute(
        select(Decision)
        .where(Decision.policy_number == policy_number)
        .order_by(desc(Decision.created_at))
    )
    decisions = result.scalars().all()

    return [
        DecisionResponse(
            id=d.id,
            policy_number=d.policy_number,
            decision=d.decision,
            reason=d.reason,
            risk_level=d.risk_level,
            decided_by=d.decided_by,
            created_at=d.created_at.isoformat()
        )
        for d in decisions
    ]
