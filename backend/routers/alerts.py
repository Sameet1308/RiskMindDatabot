"""
Alerts Router - Risk alert generation from real database data
"""
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import List, Optional
from datetime import datetime, timedelta

from database.connection import get_db

router = APIRouter()


class AlertResponse(BaseModel):
    id: int
    type: str           # high_frequency, severity, loss_ratio, renewal
    severity: str       # critical, warning, info
    policy_number: str
    policyholder: str
    message: str
    guideline_ref: Optional[str] = None
    created_at: str


@router.get("/", response_model=List[AlertResponse])
async def get_alerts(
    type: Optional[str] = Query(None, description="Filter by alert type"),
    severity: Optional[str] = Query(None, description="Filter by severity"),
    db: AsyncSession = Depends(get_db)
):
    """
    Scan all policies and claims to generate risk alerts.
    Alerts are generated in real-time from actual database data.
    """
    alerts = []
    alert_id = 1

    # Get all policies with claims summary
    result = await db.execute(text("""
        SELECT 
            p.policy_number,
            p.policyholder_name,
            p.premium,
            p.expiration_date,
            COUNT(c.id) as claim_count,
            COALESCE(SUM(c.claim_amount), 0) as total_claims,
            COALESCE(MAX(c.claim_amount), 0) as max_claim
        FROM policies p
        LEFT JOIN claims c ON p.id = c.policy_id
        GROUP BY p.id
        ORDER BY total_claims DESC
    """))
    rows = result.fetchall()

    for row in rows:
        policy_num, holder, premium, expiration, claim_count, total_claims, max_claim = row
        loss_ratio = (total_claims / premium * 100) if premium and premium > 0 else 0

        # Rule 1: High frequency (5+ claims)
        if claim_count >= 5:
            alerts.append(AlertResponse(
                id=alert_id,
                type="high_frequency",
                severity="critical",
                policy_number=policy_num,
                policyholder=holder,
                message=f"{claim_count} claims filed — exceeds frequency threshold of 5",
                guideline_ref="Section 3.1.1: Accounts with 5+ claims annually require enhanced review",
                created_at=datetime.utcnow().isoformat()
            ))
            alert_id += 1

        # Rule 2: High severity ($100K+ single claim)
        if max_claim >= 100000:
            alerts.append(AlertResponse(
                id=alert_id,
                type="severity",
                severity="critical",
                policy_number=policy_num,
                policyholder=holder,
                message=f"${max_claim:,.0f} claim exceeds $100,000 severity threshold",
                guideline_ref="Section 4.3.2: Claims exceeding $100K require senior underwriter review",
                created_at=datetime.utcnow().isoformat()
            ))
            alert_id += 1

        # Rule 3: High loss ratio (>65%)
        if loss_ratio > 65:
            alerts.append(AlertResponse(
                id=alert_id,
                type="loss_ratio",
                severity="warning",
                policy_number=policy_num,
                policyholder=holder,
                message=f"Loss ratio at {loss_ratio:.0f}% — above 65% threshold",
                guideline_ref="Section 5.1.3: Loss ratio over 65% requires mandatory rate increase",
                created_at=datetime.utcnow().isoformat()
            ))
            alert_id += 1

        # Rule 4: Aggregate claims > $200K
        if total_claims >= 200000:
            alerts.append(AlertResponse(
                id=alert_id,
                type="aggregate",
                severity="critical",
                policy_number=policy_num,
                policyholder=holder,
                message=f"Aggregate claims of ${total_claims:,.0f} exceed $200,000 threshold",
                guideline_ref="Section 4.2.1: Aggregate claims exceeding $200K require referral",
                created_at=datetime.utcnow().isoformat()
            ))
            alert_id += 1

        # Rule 5: Renewal within 30 days
        if expiration:
            try:
                exp_date = datetime.fromisoformat(str(expiration)) if isinstance(expiration, str) else expiration
                days_until = (exp_date - datetime.utcnow()).days
                if 0 <= days_until <= 30:
                    alerts.append(AlertResponse(
                        id=alert_id,
                        type="renewal",
                        severity="info",
                        policy_number=policy_num,
                        policyholder=holder,
                        message=f"Policy renews in {days_until} days",
                        guideline_ref=None,
                        created_at=datetime.utcnow().isoformat()
                    ))
                    alert_id += 1
            except (ValueError, TypeError):
                pass

    # Apply filters
    if type:
        alerts = [a for a in alerts if a.type == type]
    if severity:
        alerts = [a for a in alerts if a.severity == severity]

    # Sort: critical first, then warning, then info
    severity_order = {"critical": 0, "warning": 1, "info": 2}
    alerts.sort(key=lambda a: severity_order.get(a.severity, 3))

    return alerts


@router.get("/summary")
async def get_alerts_summary(db: AsyncSession = Depends(get_db)):
    """Get a quick count of alerts by severity."""
    all_alerts = await get_alerts(type=None, severity=None, db=db)
    return {
        "total": len(all_alerts),
        "critical": sum(1 for a in all_alerts if a.severity == "critical"),
        "warning": sum(1 for a in all_alerts if a.severity == "warning"),
        "info": sum(1 for a in all_alerts if a.severity == "info"),
    }
