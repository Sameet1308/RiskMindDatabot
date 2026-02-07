"""
Seed data for demo - creates sample policies, claims, and guidelines
"""
import asyncio
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from database.connection import async_session, init_db
from models.schemas import Policy, ClaimRecord, Guideline


async def seed_data():
    """Populate database with demo data"""
    await init_db()
    
    async with async_session() as db:
        # Check if already seeded
        from sqlalchemy import select
        result = await db.execute(select(Policy))
        if result.scalars().first():
            print("Database already seeded")
            return
        
        # Create sample policies
        policies = [
            Policy(
                policy_number="COMM-2024-001",
                policyholder_name="ABC Manufacturing Inc.",
                industry_type="Manufacturing",
                effective_date=datetime(2024, 1, 1),
                expiration_date=datetime(2025, 1, 1),
                premium=125000.00
            ),
            Policy(
                policy_number="COMM-2024-002",
                policyholder_name="XYZ Restaurant Group",
                industry_type="Restaurant",
                effective_date=datetime(2024, 3, 1),
                expiration_date=datetime(2025, 3, 1),
                premium=45000.00
            ),
            Policy(
                policy_number="COMM-2024-003",
                policyholder_name="SafeBuild Construction",
                industry_type="Construction",
                effective_date=datetime(2024, 2, 15),
                expiration_date=datetime(2025, 2, 15),
                premium=250000.00
            ),
        ]
        
        for policy in policies:
            db.add(policy)
        await db.flush()
        
        # Create sample claims
        claims = [
            # ABC Manufacturing - Good risk (2 small claims)
            ClaimRecord(
                claim_number="CLM-2024-001",
                policy_id=1,
                claim_date=datetime(2024, 3, 15),
                claim_amount=15000.00,
                claim_type="Property Damage",
                status="Closed",
                description="Minor equipment damage from power surge"
            ),
            ClaimRecord(
                claim_number="CLM-2024-002",
                policy_id=1,
                claim_date=datetime(2024, 6, 20),
                claim_amount=8500.00,
                claim_type="Workers Comp",
                status="Closed",
                description="Slip and fall, minor injury"
            ),
            # XYZ Restaurant - High frequency (5 claims)
            ClaimRecord(
                claim_number="CLM-2024-003",
                policy_id=2,
                claim_date=datetime(2024, 2, 10),
                claim_amount=12000.00,
                claim_type="Liability",
                status="Closed",
                description="Customer slip and fall"
            ),
            ClaimRecord(
                claim_number="CLM-2024-004",
                policy_id=2,
                claim_date=datetime(2024, 4, 5),
                claim_amount=18000.00,
                claim_type="Liability",
                status="Closed",
                description="Food contamination incident"
            ),
            ClaimRecord(
                claim_number="CLM-2024-005",
                policy_id=2,
                claim_date=datetime(2024, 5, 22),
                claim_amount=9500.00,
                claim_type="Property",
                status="Closed",
                description="Kitchen fire damage"
            ),
            ClaimRecord(
                claim_number="CLM-2024-006",
                policy_id=2,
                claim_date=datetime(2024, 7, 8),
                claim_amount=22000.00,
                claim_type="Liability",
                status="Open",
                description="Customer injury from hot liquid"
            ),
            ClaimRecord(
                claim_number="CLM-2024-007",
                policy_id=2,
                claim_date=datetime(2024, 9, 15),
                claim_amount=14000.00,
                claim_type="Workers Comp",
                status="Open",
                description="Employee burn injury"
            ),
            # SafeBuild - High severity (1 large claim)
            ClaimRecord(
                claim_number="CLM-2024-008",
                policy_id=3,
                claim_date=datetime(2024, 5, 10),
                claim_amount=175000.00,
                claim_type="Liability",
                status="Open",
                description="Fall from scaffolding - serious injury"
            ),
        ]
        
        for claim in claims:
            db.add(claim)
        
        # Create sample guidelines
        guidelines = [
            Guideline(
                section_code="1.1.1",
                title="Standard Underwriting Eligibility",
                content="Standard underwriting applies for accounts meeting minimum eligibility criteria with favorable loss history.",
                category="Eligibility",
                threshold_type="claims_count",
                threshold_value=2,
                action="APPROVE"
            ),
            Guideline(
                section_code="2.3.4",
                title="Moderate Claims Activity",
                content="Accounts with moderate claims activity should be priced with appropriate experience modification factor.",
                category="Pricing",
                threshold_type="claims_count",
                threshold_value=3,
                action="REVIEW"
            ),
            Guideline(
                section_code="3.1.1",
                title="High Frequency Threshold",
                content="Accounts with 5 or more claims annually require enhanced review and loss control assessment.",
                category="Frequency",
                threshold_type="claims_count",
                threshold_value=5,
                action="ENHANCED_REVIEW"
            ),
            Guideline(
                section_code="4.2.1",
                title="Aggregate Claims Threshold",
                content="Aggregate claims exceeding $200,000 in a policy period require senior underwriter approval.",
                category="Severity",
                threshold_type="total_amount",
                threshold_value=200000,
                action="REFER"
            ),
            Guideline(
                section_code="4.3.2",
                title="Single Claim Severity",
                content="Claims exceeding $100,000 require senior underwriter review prior to renewal.",
                category="Severity",
                threshold_type="single_claim",
                threshold_value=100000,
                action="REFER"
            ),
        ]
        
        for guideline in guidelines:
            db.add(guideline)
        
        await db.commit()
        print("✅ Database seeded with demo data")
        print("   - 3 policies")
        print("   - 8 claims")
        print("   - 5 guidelines")


if __name__ == "__main__":
    asyncio.run(seed_data())
