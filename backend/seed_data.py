"""
Seed data for RiskMind — 20 policies, 55+ claims, 15 guidelines
"""
import asyncio
import os
import sys
from datetime import datetime, timedelta
from sqlalchemy import text

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database.connection import engine, async_session, init_db


async def seed():
    await init_db()

    async with async_session() as db:
        # Clear existing data
        await db.execute(text("DELETE FROM claims"))
        await db.execute(text("DELETE FROM policies"))
        await db.execute(text("DELETE FROM guidelines"))
        await db.execute(text("DELETE FROM documents"))
        await db.commit()

        # ===== POLICIES (20) =====
        policies = [
            ("COMM-2024-001", "ABC Manufacturing Inc", "Manufacturing", 50000, "2024-01-15", "2025-01-15"),
            ("P-1023", "Northwind Logistics", "Transportation", 52000, "2024-01-01", "2025-01-01"),
            ("COMM-2024-002", "XYZ Restaurant Group", "Restaurant", 35000, "2024-02-01", "2025-02-01"),
            ("COMM-2024-003", "SafeBuild Construction", "Construction", 75000, "2024-03-10", "2025-03-10"),
            ("COMM-2024-004", "MedCare Health Services", "Healthcare", 60000, "2024-04-01", "2025-04-01"),
            ("COMM-2024-005", "FastTrack Logistics", "Transportation", 45000, "2024-05-15", "2025-05-15"),
            ("COMM-2024-006", "TechNova Solutions", "Technology", 40000, "2024-06-01", "2025-06-01"),
            ("COMM-2024-007", "GreenLeaf Properties", "Real Estate", 55000, "2024-07-01", "2025-07-01"),
            ("COMM-2024-008", "CityBite Foods LLC", "Restaurant", 30000, "2024-08-01", "2025-08-01"),
            ("COMM-2024-009", "IronWorks Fabrication", "Manufacturing", 65000, "2024-09-01", "2025-09-01"),
            ("COMM-2024-010", "QuickMart Retail Chain", "Retail", 28000, "2024-10-01", "2025-10-01"),
            ("COMM-2024-011", "BuildRight Contractors", "Construction", 80000, "2024-01-20", "2025-01-20"),
            ("COMM-2024-012", "DataShield Cybersec", "Technology", 42000, "2024-02-15", "2025-02-15"),
            ("COMM-2024-013", "SunValley Farms", "Agriculture", 38000, "2024-03-01", "2025-03-01"),
            ("COMM-2024-014", "OceanView Hotels", "Hospitality", 52000, "2024-04-15", "2025-04-15"),
            ("COMM-2024-015", "PrimeCare Dental", "Healthcare", 35000, "2024-05-01", "2025-05-01"),
            ("COMM-2024-016", "Eagle Transport Co", "Transportation", 48000, "2024-06-15", "2025-06-15"),
            ("COMM-2024-017", "BlueSky Development", "Real Estate", 62000, "2024-07-15", "2025-07-15"),
            ("COMM-2024-018", "FreshBrew Coffee Chain", "Restaurant", 25000, "2024-08-15", "2025-08-15"),
            ("COMM-2024-019", "SteelEdge Manufacturing", "Manufacturing", 70000, "2024-09-15", "2025-09-15"),
            ("COMM-2024-020", "PetCare Animal Hospital", "Healthcare", 32000, "2024-10-15", "2025-10-15"),
        ]

        import random

        # Risk Clusters (City centers)
        CLUSTERS = [
            (25.7617, -80.1918),   # Miami, FL (Hurricane)
            (37.7749, -122.4194),  # San Francisco, CA (Earthquake)
            (40.7128, -74.0060),   # New York, NY (Urban)
            (29.7604, -95.3698),   # Houston, TX (Flood)
            (41.8781, -87.6298),   # Chicago, IL (Wind)
        ]

        def get_geo():
            """Get random lat/long near a cluster"""
            base_lat, base_lon = random.choice(CLUSTERS)
            # Add random offset (approx 0-10km)
            lat = base_lat + random.uniform(-0.1, 0.1)
            lon = base_lon + random.uniform(-0.1, 0.1)
            return lat, lon

        for p in policies:
            lat, lon = get_geo()
            await db.execute(text("""
                INSERT INTO policies (policy_number, policyholder_name, industry_type, premium, effective_date, expiration_date, latitude, longitude)
                VALUES (:pn, :name, :industry, :premium, :eff, :exp, :lat, :lon)
            """), {"pn": p[0], "name": p[1], "industry": p[2], "premium": p[3], "eff": p[4], "exp": p[5], "lat": lat, "lon": lon})
        await db.commit()

        # Get policy IDs
        result = await db.execute(text("SELECT id, policy_number FROM policies ORDER BY id"))
        policy_map = {row[1]: row[0] for row in result.fetchall()}

        # ===== CLAIMS (58 total) =====
        claims = [
            # P-1023: Northwind Logistics — trend-ready claims
            (policy_map["P-1023"], "CLM-2025-100", "2024-01-12", 12000, "auto_accident", "closed", "Rear-end collision on highway"),
            (policy_map["P-1023"], "CLM-2025-101", "2024-03-18", 18000, "auto_accident", "closed", "Multi-vehicle incident"),
            (policy_map["P-1023"], "CLM-2025-102", "2024-06-09", 9000, "property_damage", "closed", "Cargo handling damage"),
            (policy_map["P-1023"], "CLM-2025-103", "2024-10-22", 24000, "auto_accident", "open", "Intersection collision with injuries"),
            # COMM-2024-001: ABC Manufacturing — 2 claims (LOW risk)
            (policy_map["COMM-2024-001"], "CLM-2024-001", "2024-03-15", 8500, "property_damage", "closed", "Minor equipment damage in warehouse"),
            (policy_map["COMM-2024-001"], "CLM-2024-002", "2024-07-22", 15000, "property_damage", "closed", "Water damage from pipe burst"),

            # COMM-2024-002: XYZ Restaurant — 6 claims (HIGH frequency - triggers alert)
            (policy_map["COMM-2024-002"], "CLM-2024-003", "2024-02-10", 3200, "general_liability", "closed", "Customer slip and fall"),
            (policy_map["COMM-2024-002"], "CLM-2024-004", "2024-04-05", 5500, "general_liability", "closed", "Food contamination incident"),
            (policy_map["COMM-2024-002"], "CLM-2024-005", "2024-05-18", 4800, "property_damage", "closed", "Kitchen fire damage"),
            (policy_map["COMM-2024-002"], "CLM-2024-006", "2024-07-30", 2900, "general_liability", "closed", "Customer injury from broken chair"),
            (policy_map["COMM-2024-002"], "CLM-2024-007", "2024-09-12", 6100, "general_liability", "open", "Delivery driver accident on premises"),
            (policy_map["COMM-2024-002"], "CLM-2024-008", "2024-11-03", 3500, "property_damage", "open", "Refrigeration system failure"),

            # COMM-2024-003: SafeBuild Construction — 3 claims including $175K (HIGH severity)
            (policy_map["COMM-2024-003"], "CLM-2024-009", "2024-04-20", 175000, "workers_compensation", "open", "Crane collapse - multiple injuries",
             '[{"type": "image", "url": "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?q=80&w=600", "description": "Drone view of collapsed crane structure"}, {"type": "video", "url": "https://media.istockphoto.com/id/1154625698/video/aerial-view-of-construction-site.mp4?s=mp4-640x640-is&k=20&c=0s8q9j8w7u5e3r2t1y6u5i4o3p2a1s0d9f8g7h6j5k4l", "description": "Site walkthrough video"}]'),
            (policy_map["COMM-2024-003"], "CLM-2024-010", "2024-06-15", 22000, "workers_compensation", "closed", "Worker fall from scaffolding", None),
            (policy_map["COMM-2024-003"], "CLM-2024-011", "2024-09-08", 18500, "property_damage", "closed", "Equipment damage at job site", None),

            # COMM-2024-004: MedCare — 3 claims (MEDIUM risk)
            (policy_map["COMM-2024-004"], "CLM-2024-012", "2024-05-10", 45000, "professional_liability", "open", "Medical malpractice allegation"),
            (policy_map["COMM-2024-004"], "CLM-2024-013", "2024-08-22", 12000, "general_liability", "closed", "Patient slip in waiting room"),
            (policy_map["COMM-2024-004"], "CLM-2024-014", "2024-11-15", 8500, "property_damage", "open", "Medical equipment malfunction"),

            # COMM-2024-005: FastTrack Logistics — 4 claims (MEDIUM risk)
            (policy_map["COMM-2024-005"], "CLM-2024-015", "2024-03-05", 15000, "auto_accident", "closed", "Truck rear-end collision"),
            (policy_map["COMM-2024-005"], "CLM-2024-016", "2024-06-18", 28000, "auto_accident", "closed", "Highway multi-vehicle accident"),
            (policy_map["COMM-2024-005"], "CLM-2024-017", "2024-08-30", 9500, "property_damage", "closed", "Cargo damage during transport"),
            (policy_map["COMM-2024-005"], "CLM-2024-018", "2024-10-12", 11000, "auto_accident", "open", "Delivery van intersection accident"),

            # COMM-2024-006: TechNova — 1 claim (LOW risk)
            (policy_map["COMM-2024-006"], "CLM-2024-019", "2024-09-20", 5000, "cyber_breach", "closed", "Minor data exposure incident"),

            # COMM-2024-007: GreenLeaf Properties — 0 claims (EXCELLENT)

            # COMM-2024-008: CityBite Foods — 5 claims (HIGH frequency)
            (policy_map["COMM-2024-008"], "CLM-2024-020", "2024-03-12", 4200, "general_liability", "closed", "Customer allergic reaction"),
            (policy_map["COMM-2024-008"], "CLM-2024-021", "2024-05-25", 3800, "general_liability", "closed", "Delivery person injury"),
            (policy_map["COMM-2024-008"], "CLM-2024-022", "2024-07-08", 5100, "property_damage", "closed", "Grease fire in kitchen"),
            (policy_map["COMM-2024-008"], "CLM-2024-023", "2024-09-19", 2500, "general_liability", "open", "Customer burns from hot beverage"),
            (policy_map["COMM-2024-008"], "CLM-2024-024", "2024-11-28", 3900, "property_damage", "open", "Walk-in freezer failure"),

            # COMM-2024-009: IronWorks — 2 claims (LOW risk)
            (policy_map["COMM-2024-009"], "CLM-2024-025", "2024-04-08", 12000, "workers_compensation", "closed", "Worker hand injury from machinery"),
            (policy_map["COMM-2024-009"], "CLM-2024-026", "2024-10-05", 7500, "property_damage", "closed", "Welding fire in shop"),

            # COMM-2024-010: QuickMart — 3 claims (MEDIUM)
            (policy_map["COMM-2024-010"], "CLM-2024-027", "2024-02-20", 6000, "general_liability", "closed", "Customer slip on wet floor"),
            (policy_map["COMM-2024-010"], "CLM-2024-028", "2024-06-11", 4500, "property_damage", "closed", "Shoplifting damage to displays"),
            (policy_map["COMM-2024-010"], "CLM-2024-029", "2024-09-30", 8000, "general_liability", "open", "Employee injury during stocking"),

            # COMM-2024-011: BuildRight — 2 claims including $250K (CRITICAL severity)
            (policy_map["COMM-2024-011"], "CLM-2024-030", "2024-05-14", 250000, "workers_compensation", "open", "Building collapse - catastrophic injuries", None),
            (policy_map["COMM-2024-011"], "CLM-2024-031", "2024-08-20", 35000, "property_damage", "closed", "Heavy equipment rollover", None),

            # COMM-2024-012: DataShield — 2 claims (LOW)
            (policy_map["COMM-2024-012"], "CLM-2024-032", "2024-07-15", 8000, "cyber_breach", "closed", "Client data breach attempt"),
            (policy_map["COMM-2024-012"], "CLM-2024-033", "2024-10-28", 15000, "cyber_breach", "open", "Ransomware attack on client system"),

            # COMM-2024-013: SunValley Farms — 1 claim (LOW)
            (policy_map["COMM-2024-013"], "CLM-2024-034", "2024-06-20", 22000, "property_damage", "closed", "Storm damage to barn and equipment"),

            # COMM-2024-014: OceanView Hotels — 4 claims (MEDIUM-HIGH)
            (policy_map["COMM-2024-014"], "CLM-2024-035", "2024-03-18", 9000, "general_liability", "closed", "Guest pool injury"),
            (policy_map["COMM-2024-014"], "CLM-2024-036", "2024-05-22", 14000, "property_damage", "closed", "Water damage from burst pipe"),
            (policy_map["COMM-2024-014"], "CLM-2024-037", "2024-08-10", 7500, "general_liability", "closed", "Guest food poisoning at restaurant"),
            (policy_map["COMM-2024-014"], "CLM-2024-038", "2024-11-05", 18000, "property_damage", "open", "Elevator malfunction and injury"),

            # COMM-2024-015: PrimeCare Dental — 1 claim (LOW)
            (policy_map["COMM-2024-015"], "CLM-2024-039", "2024-07-25", 25000, "professional_liability", "open", "Patient claims improper procedure"),

            # COMM-2024-016: Eagle Transport — 5 claims (HIGH frequency)
            (policy_map["COMM-2024-016"], "CLM-2024-040", "2024-02-08", 18000, "auto_accident", "closed", "Truck rollover on highway",
             '[{"type": "video", "url": "https://media.istockphoto.com/id/1435226158/video/aerial-view-of-traffic-accident-on-highway.mp4?s=mp4-640x640-is&k=20&c=S_G95N_-cK-lG_-k-n-O-O-O-O-O-O-O-O-O-O", "description": "Dashcam Footage: Rollover Event"}, {"type": "image", "url": "https://images.unsplash.com/photo-1626848263360-1e5b10g640a3?q=80&w=600", "description": "On-scene damage assessment"}, {"type": "image", "url": "https://images.unsplash.com/photo-1599839572645-1c39066601-0?q=80&w=600", "description": "Cargo spill containment"}]'),
            (policy_map["COMM-2024-016"], "CLM-2024-041", "2024-04-15", 12000, "auto_accident", "closed", "Rear-end collision at intersection", None),
            (policy_map["COMM-2024-016"], "CLM-2024-042", "2024-06-28", 9000, "auto_accident", "closed", "Side-swipe on delivery route"),
            (policy_map["COMM-2024-016"], "CLM-2024-043", "2024-09-05", 22000, "auto_accident", "open", "Multi-vehicle highway incident"),
            (policy_map["COMM-2024-016"], "CLM-2024-044", "2024-11-18", 15000, "property_damage", "open", "Cargo damage and spill"),

            # COMM-2024-017: BlueSky Development — 0 claims (EXCELLENT)

            # COMM-2024-018: FreshBrew Coffee — 2 claims (MEDIUM due to small premium)
            (policy_map["COMM-2024-018"], "CLM-2024-045", "2024-04-30", 3500, "general_liability", "closed", "Customer burn from hot coffee"),
            (policy_map["COMM-2024-018"], "CLM-2024-046", "2024-10-15", 8000, "property_damage", "open", "Espresso machine explosion"),

            # COMM-2024-019: SteelEdge Manufacturing — 3 claims (MEDIUM)
            (policy_map["COMM-2024-019"], "CLM-2024-047", "2024-03-22", 32000, "workers_compensation", "closed", "Worker crushed hand in press"),
            (policy_map["COMM-2024-019"], "CLM-2024-048", "2024-07-14", 15000, "property_damage", "closed", "Chemical spill in production area"),
            (policy_map["COMM-2024-019"], "CLM-2024-049", "2024-11-02", 45000, "workers_compensation", "open", "Forklift accident with injuries"),

            # COMM-2024-020: PetCare Animal Hospital — 2 claims (MEDIUM)
            (policy_map["COMM-2024-020"], "CLM-2024-050", "2024-05-08", 18000, "professional_liability", "closed", "Pet owner alleges malpractice"),
            (policy_map["COMM-2024-020"], "CLM-2024-051", "2024-09-25", 6500, "general_liability", "open", "Animal bite to staff member"),
        ]

        for c in claims:
            await db.execute(text("""
                INSERT INTO claims (policy_id, claim_number, claim_date, claim_amount, claim_type, status, description, evidence_files)
                VALUES (:pid, :cn, :cd, :amt, :ct, :st, :desc, :ev)
            """), {"pid": c[0], "cn": c[1], "cd": c[2], "amt": c[3], "ct": c[4], "st": c[5], "desc": c[6], "ev": c[7] if len(c) > 7 else None})
        await db.commit()

        # ===== GUIDELINES (15) =====
        guidelines = [
            ("1.1.1", "Standard Eligibility", "Standard underwriting applies for accounts meeting minimum eligibility criteria with acceptable loss history.", "eligibility", "general", None, "approve"),
            ("2.1.1", "Business Age Requirement", "Businesses must be operational for a minimum of 2 years to qualify for standard underwriting. Startups require special review.", "eligibility", "years", 2, "review"),
            ("2.1.2", "Financial Standing", "Minimum credit score of 650 required for all commercial lines. Below 650 requires additional financial review and potential surcharge.", "eligibility", "credit_score", 650, "review"),
            ("2.2.1", "Industry Restrictions", "Cannabis operations, fireworks manufacturing, and adult entertainment businesses are excluded from standard commercial programs.", "eligibility", "general", None, "decline"),
            ("3.1.1", "Claim Frequency Threshold", "Accounts with 5 or more claims annually require enhanced review, loss control assessment, and potential premium surcharge of 15-25%.", "frequency", "claim_count", 5, "review"),
            ("3.1.2", "Frequency Trend Analysis", "A 50% or greater increase in claim frequency year-over-year triggers mandatory pricing review and risk control inspection.", "frequency", "percentage", 50, "review"),
            ("4.1.1", "Single Claim Severity", "Individual claims exceeding $100,000 require immediate notification to senior underwriter and claims management review.", "severity", "amount", 100000, "refer"),
            ("4.2.1", "Aggregate Claims Threshold", "Total aggregate claims exceeding $200,000 in a policy period require referral to senior underwriting authority.", "severity", "amount", 200000, "refer"),
            ("4.3.2", "Catastrophic Event", "Claims exceeding $100,000 from a single event require senior underwriter review and potential policy restructuring.", "severity", "amount", 100000, "refer"),
            ("5.1.1", "Favorable Loss Ratio", "Loss ratio under 50% indicates favorable risk profile. Standard renewal at current terms with potential loyalty credit.", "pricing", "percentage", 50, "approve"),
            ("5.1.2", "Moderate Loss Ratio", "Loss ratio between 50-65% requires pricing review. Consider 5-10% rate increase and enhanced loss control measures.", "pricing", "percentage", 65, "review"),
            ("5.1.3", "Adverse Loss Ratio", "Loss ratio exceeding 65% triggers mandatory rate increase of 15-25% or non-renewal recommendation. Senior review required.", "pricing", "percentage", 65, "refer"),
            ("6.1.1", "Property Coverage Limits", "Maximum property coverage of $5,000,000 per occurrence. Amounts exceeding this require reinsurance approval.", "coverage", "amount", 5000000, "refer"),
            ("6.1.2", "Liability Coverage Limits", "Maximum liability coverage of $2,000,000 per occurrence, $5,000,000 aggregate. Excess requires umbrella placement.", "coverage", "amount", 2000000, "refer"),
            ("7.1.1", "Binding Authority Levels", "Junior underwriters: up to $1M premium. Senior underwriters: up to $5M premium. Above $5M requires management approval.", "authority", "amount", 1000000, "review"),
        ]

        for g in guidelines:
            await db.execute(text("""
                INSERT INTO guidelines (section_code, title, content, category, threshold_type, threshold_value, action)
                VALUES (:sc, :title, :content, :cat, :tt, :tv, :action)
            """), {"sc": g[0], "title": g[1], "content": g[2], "cat": g[3], "tt": g[4], "tv": g[5], "action": g[6]})
        await db.commit()

        # ===== DOCUMENTS (Local sample PDFs) =====
        base_dir = os.path.dirname(os.path.abspath(__file__))
        documents = [
            (
                "general-guidelines.pdf",
                os.path.join(base_dir, "data", "uploads", "guidelines", "general-guidelines.pdf"),
                "pdf",
                "Baseline underwriting guidance (general).",
            ),
            (
                "COMM-2024-002.pdf",
                os.path.join(base_dir, "data", "policies", "COMM-2024-002.pdf"),
                "pdf",
                "Policy document for COMM-2024-002.",
            ),
        ]

        for filename, file_path, file_type, summary in documents:
            file_size = os.path.getsize(file_path) if os.path.exists(file_path) else 0
            await db.execute(text("""
                INSERT INTO documents (filename, file_path, file_type, file_size, uploaded_by, analysis_summary)
                VALUES (:fn, :fp, :ft, :fs, :ub, :summary)
            """), {"fn": filename, "fp": file_path, "ft": file_type, "fs": file_size, "ub": "seed", "summary": summary})
        await db.commit()

        # Print summary
        result = await db.execute(text("SELECT COUNT(*) FROM policies"))
        p_count = result.scalar()
        result = await db.execute(text("SELECT COUNT(*) FROM claims"))
        c_count = result.scalar()
        result = await db.execute(text("SELECT COUNT(*) FROM guidelines"))
        g_count = result.scalar()
        result = await db.execute(text("SELECT COUNT(*) FROM documents"))
        d_count = result.scalar()

        print(f"\n✅ Database seeded successfully!")
        print(f"   📋 {p_count} policies")
        print(f"   📊 {c_count} claims")
        print(f"   📖 {g_count} guidelines")
        print(f"   📄 {d_count} documents")
        print(f"\n   High-risk policies (for testing alerts):")
        print(f"   - COMM-2024-002: XYZ Restaurant — 6 claims (HIGH FREQUENCY)")
        print(f"   - COMM-2024-003: SafeBuild Construction — $175K claim (HIGH SEVERITY)")
        print(f"   - COMM-2024-008: CityBite Foods — 5 claims (HIGH FREQUENCY)")
        print(f"   - COMM-2024-011: BuildRight Contractors — $250K claim (CRITICAL)")
        print(f"   - COMM-2024-016: Eagle Transport — 5 claims (HIGH FREQUENCY)")


if __name__ == "__main__":
    asyncio.run(seed())
