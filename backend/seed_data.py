"""
Seed data for RiskMind — 20 policies, 55+ claims, 15 guidelines, 2 users
"""
import asyncio
import hashlib
import os
import sys
from datetime import datetime, timedelta
from sqlalchemy import text

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database.connection import engine, async_session, init_db


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


async def seed():
    await init_db()

    async with async_session() as db:
        # Clear existing data
        await db.execute(text("DELETE FROM claims"))
        await db.execute(text("DELETE FROM policies"))
        await db.execute(text("DELETE FROM guidelines"))
        await db.execute(text("DELETE FROM documents"))
        await db.execute(text("DELETE FROM users"))
        await db.commit()

        # ===== USERS (2) =====
        users = [
            ("sarah@apexuw.com", hash_password("sarah123"), "Sarah Mitchell", "senior_underwriter"),
            ("james@apexuw.com", hash_password("james123"), "James Chen", "underwriter"),
        ]
        for email, pw_hash, name, role in users:
            await db.execute(text("""
                INSERT INTO users (email, hashed_password, full_name, role, is_active)
                VALUES (:email, :pw, :name, :role, 1)
            """), {"email": email, "pw": pw_hash, "name": name, "role": role})
        await db.commit()
        print("[OK] 2 users seeded (sarah@apexuw.com / sarah123, james@apexuw.com / james123)")

        # ===== POLICIES (20) with diverse US geo coordinates =====
        # Each policy is assigned to a specific user and placed in a real US city
        # Format: (policy_number, name, industry, premium, eff_date, exp_date, lat, lon, assigned_to)
        policies = [
            # --- Sarah Mitchell's 10 policies ---
            ("COMM-2024-001", "ABC Manufacturing Inc",   "Manufacturing",  50000, "2024-01-15", "2025-01-15", 42.331, -83.046, "sarah@apexuw.com"),   # Detroit, MI
            ("COMM-2024-002", "XYZ Restaurant Group",    "Restaurant",     35000, "2024-02-01", "2025-02-01", 25.762, -80.192, "sarah@apexuw.com"),   # Miami, FL
            ("COMM-2024-003", "SafeBuild Construction",  "Construction",   75000, "2024-03-10", "2025-03-10", 39.739, -104.990, "sarah@apexuw.com"),  # Denver, CO
            ("COMM-2024-005", "FastTrack Logistics",     "Transportation", 45000, "2024-05-15", "2025-05-15", 32.777, -96.797, "sarah@apexuw.com"),   # Dallas, TX
            ("COMM-2024-007", "GreenLeaf Properties",    "Real Estate",    55000, "2024-07-01", "2025-07-01", 33.448, -112.074, "sarah@apexuw.com"),  # Phoenix, AZ
            ("COMM-2024-009", "IronWorks Fabrication",   "Manufacturing",  65000, "2024-09-01", "2025-09-01", 40.441, -79.996, "sarah@apexuw.com"),   # Pittsburgh, PA
            ("COMM-2024-011", "BuildRight Contractors",  "Construction",   80000, "2024-01-20", "2025-01-20", 34.052, -118.244, "sarah@apexuw.com"),  # Los Angeles, CA
            ("COMM-2024-013", "SunValley Farms",         "Agriculture",    38000, "2024-03-01", "2025-03-01", 35.373, -119.019, "sarah@apexuw.com"),  # Bakersfield, CA
            ("COMM-2024-016", "Eagle Transport Co",      "Transportation", 48000, "2024-06-15", "2025-06-15", 41.878, -87.630, "sarah@apexuw.com"),   # Chicago, IL
            ("COMM-2024-019", "SteelEdge Manufacturing", "Manufacturing",  70000, "2024-09-15", "2025-09-15", 41.499, -81.694, "sarah@apexuw.com"),   # Cleveland, OH

            # --- James Chen's 10 policies ---
            ("P-1023",         "Northwind Logistics",     "Transportation", 52000, "2024-01-01", "2025-01-01", 35.150, -90.049, "james@apexuw.com"),  # Memphis, TN
            ("COMM-2024-004", "MedCare Health Services",  "Healthcare",     60000, "2024-04-01", "2025-04-01", 42.360, -71.059, "james@apexuw.com"),  # Boston, MA
            ("COMM-2024-006", "TechNova Solutions",       "Technology",     40000, "2024-06-01", "2025-06-01", 37.775, -122.419, "james@apexuw.com"), # San Francisco, CA
            ("COMM-2024-008", "CityBite Foods LLC",       "Restaurant",     30000, "2024-08-01", "2025-08-01", 40.758, -73.986, "james@apexuw.com"),  # New York, NY
            ("COMM-2024-010", "QuickMart Retail Chain",   "Retail",         28000, "2024-10-01", "2025-10-01", 33.749, -84.388, "james@apexuw.com"),  # Atlanta, GA
            ("COMM-2024-012", "DataShield Cybersec",      "Technology",     42000, "2024-02-15", "2025-02-15", 47.606, -122.332, "james@apexuw.com"), # Seattle, WA
            ("COMM-2024-014", "OceanView Hotels",         "Hospitality",    52000, "2024-04-15", "2025-04-15", 28.538, -81.379, "james@apexuw.com"),  # Orlando, FL
            ("COMM-2024-015", "PrimeCare Dental",         "Healthcare",     35000, "2024-05-01", "2025-05-01", 44.978, -93.265, "james@apexuw.com"),  # Minneapolis, MN
            ("COMM-2024-017", "BlueSky Development",      "Real Estate",    62000, "2024-07-15", "2025-07-15", 30.267, -97.743, "james@apexuw.com"),  # Austin, TX
            ("COMM-2024-018", "FreshBrew Coffee Chain",   "Restaurant",     25000, "2024-08-15", "2025-08-15", 45.515, -122.678, "james@apexuw.com"), # Portland, OR
            ("COMM-2024-020", "PetCare Animal Hospital",  "Healthcare",     32000, "2024-10-15", "2025-10-15", 36.163, -86.782, "james@apexuw.com"),  # Nashville, TN
        ]

        import random
        for p in policies:
            # Small jitter so markers aren't exactly on city center
            lat = p[6] + random.uniform(-0.02, 0.02)
            lon = p[7] + random.uniform(-0.02, 0.02)
            await db.execute(text("""
                INSERT INTO policies (policy_number, policyholder_name, industry_type, premium, effective_date, expiration_date, latitude, longitude, assigned_to)
                VALUES (:pn, :name, :industry, :premium, :eff, :exp, :lat, :lon, :assigned)
            """), {"pn": p[0], "name": p[1], "industry": p[2], "premium": p[3], "eff": p[4], "exp": p[5], "lat": lat, "lon": lon, "assigned": p[8]})
        await db.commit()

        # Get policy IDs
        result = await db.execute(text("SELECT id, policy_number FROM policies ORDER BY id"))
        policy_map = {row[1]: row[0] for row in result.fetchall()}

        # ===== CLAIMS (58 total) =====
        claims = [
            # P-1023: Northwind Logistics — trend-ready claims (James)
            (policy_map["P-1023"], "CLM-2025-100", "2024-01-12", 12000, "auto_accident", "closed", "Rear-end collision on highway"),
            (policy_map["P-1023"], "CLM-2025-101", "2024-03-18", 18000, "auto_accident", "closed", "Multi-vehicle incident"),
            (policy_map["P-1023"], "CLM-2025-102", "2024-06-09", 9000, "property_damage", "closed", "Cargo handling damage"),
            (policy_map["P-1023"], "CLM-2025-103", "2024-10-22", 24000, "auto_accident", "open", "Intersection collision with injuries"),
            # COMM-2024-001: ABC Manufacturing — 2 claims LOW (Sarah)
            (policy_map["COMM-2024-001"], "CLM-2024-001", "2024-03-15", 8500, "property_damage", "closed", "Minor equipment damage in warehouse"),
            (policy_map["COMM-2024-001"], "CLM-2024-002", "2024-07-22", 15000, "property_damage", "closed", "Water damage from pipe burst"),

            # COMM-2024-002: XYZ Restaurant — 6 claims HIGH (Sarah)
            (policy_map["COMM-2024-002"], "CLM-2024-003", "2024-02-10", 3200, "general_liability", "closed", "Customer slip and fall"),
            (policy_map["COMM-2024-002"], "CLM-2024-004", "2024-04-05", 5500, "general_liability", "closed", "Food contamination incident"),
            (policy_map["COMM-2024-002"], "CLM-2024-005", "2024-05-18", 4800, "property_damage", "closed", "Kitchen fire damage",
             '[{"type": "image", "url": "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=400&h=300&fit=crop", "description": "Kitchen exhaust fire damage", "analysis_summary": "Fire originated in the commercial exhaust hood above the fryer station. Grease buildup visible in the ductwork. Suppression system activated but delayed. Hood cleaning log shows last cleaning was 4 months prior, exceeding NFPA 96 quarterly requirement."}, {"type": "pdf", "url": "/api/uploads/demo/fire-marshal-report.pdf", "description": "Fire marshal investigation report", "analysis_summary": "Cause: grease accumulation in exhaust plenum. Contributing factor: blocked suppression nozzle #3. Code violation: NFPA 96 Section 11.4 - hood cleaning interval exceeded. Recommendation: mandatory monthly inspections."}]'),
            (policy_map["COMM-2024-002"], "CLM-2024-006", "2024-07-30", 2900, "general_liability", "closed", "Customer injury from broken chair"),
            (policy_map["COMM-2024-002"], "CLM-2024-007", "2024-09-12", 6100, "general_liability", "open", "Delivery driver accident on premises"),
            (policy_map["COMM-2024-002"], "CLM-2024-008", "2024-11-03", 3500, "property_damage", "open", "Refrigeration system failure"),

            # COMM-2024-003: SafeBuild Construction — 3 claims HIGH severity (Sarah)
            (policy_map["COMM-2024-003"], "CLM-2024-009", "2024-04-20", 175000, "workers_compensation", "open", "Crane collapse - multiple injuries",
             '[{"type": "image", "url": "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&h=300&fit=crop", "description": "Aerial view of crane collapse site", "analysis_summary": "Aerial imagery confirms complete structural failure of the 40-ton tower crane at the NE corner. Jib section separated at the slewing ring, consistent with overload or mechanical failure. Debris field extends ~50m, impacting the adjacent staging area."}, {"type": "pdf", "url": "/api/uploads/demo/crane-inspection-2024.pdf", "description": "Pre-incident crane inspection report", "analysis_summary": "Last inspection dated March 2024 (30 days before incident). Report flagged wear on slewing ring bearings (page 4) and recommended replacement within 60 days. Recommendation was NOT actioned per maintenance logs."}]'),
            (policy_map["COMM-2024-003"], "CLM-2024-010", "2024-06-15", 22000, "workers_compensation", "closed", "Worker fall from scaffolding",
             '[{"type": "image", "url": "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&h=300&fit=crop", "description": "Scaffolding collapse area", "analysis_summary": "Scaffolding on levels 3-4 shows improper cross-bracing. Base plates were set on unsecured plywood, not on firm foundation as required by OSHA 1926.451(c)(2). Fall distance approximately 25 feet."}]'),
            (policy_map["COMM-2024-003"], "CLM-2024-011", "2024-09-08", 18500, "property_damage", "closed", "Equipment damage at job site", None),

            # COMM-2024-004: MedCare — 3 claims MEDIUM (James)
            (policy_map["COMM-2024-004"], "CLM-2024-012", "2024-05-10", 45000, "professional_liability", "open", "Medical malpractice allegation"),
            (policy_map["COMM-2024-004"], "CLM-2024-013", "2024-08-22", 12000, "general_liability", "closed", "Patient slip in waiting room"),
            (policy_map["COMM-2024-004"], "CLM-2024-014", "2024-11-15", 8500, "property_damage", "open", "Medical equipment malfunction"),

            # COMM-2024-005: FastTrack Logistics — 4 claims MEDIUM (Sarah)
            (policy_map["COMM-2024-005"], "CLM-2024-015", "2024-03-05", 15000, "auto_accident", "closed", "Truck rear-end collision"),
            (policy_map["COMM-2024-005"], "CLM-2024-016", "2024-06-18", 28000, "auto_accident", "closed", "Highway multi-vehicle accident"),
            (policy_map["COMM-2024-005"], "CLM-2024-017", "2024-08-30", 9500, "property_damage", "closed", "Cargo damage during transport"),
            (policy_map["COMM-2024-005"], "CLM-2024-018", "2024-10-12", 11000, "auto_accident", "open", "Delivery van intersection accident"),

            # COMM-2024-006: TechNova — 1 claim LOW (James)
            (policy_map["COMM-2024-006"], "CLM-2024-019", "2024-09-20", 5000, "cyber_breach", "closed", "Minor data exposure incident"),

            # COMM-2024-007: GreenLeaf Properties — 0 claims EXCELLENT (Sarah)

            # COMM-2024-008: CityBite Foods — 5 claims HIGH (James)
            (policy_map["COMM-2024-008"], "CLM-2024-020", "2024-03-12", 4200, "general_liability", "closed", "Customer allergic reaction"),
            (policy_map["COMM-2024-008"], "CLM-2024-021", "2024-05-25", 3800, "general_liability", "closed", "Delivery person injury"),
            (policy_map["COMM-2024-008"], "CLM-2024-022", "2024-07-08", 5100, "property_damage", "closed", "Grease fire in kitchen"),
            (policy_map["COMM-2024-008"], "CLM-2024-023", "2024-09-19", 2500, "general_liability", "open", "Customer burns from hot beverage"),
            (policy_map["COMM-2024-008"], "CLM-2024-024", "2024-11-28", 3900, "property_damage", "open", "Walk-in freezer failure"),

            # COMM-2024-009: IronWorks — 2 claims LOW (Sarah)
            (policy_map["COMM-2024-009"], "CLM-2024-025", "2024-04-08", 12000, "workers_compensation", "closed", "Worker hand injury from machinery"),
            (policy_map["COMM-2024-009"], "CLM-2024-026", "2024-10-05", 7500, "property_damage", "closed", "Welding fire in shop"),

            # COMM-2024-010: QuickMart — 3 claims MEDIUM (James)
            (policy_map["COMM-2024-010"], "CLM-2024-027", "2024-02-20", 6000, "general_liability", "closed", "Customer slip on wet floor"),
            (policy_map["COMM-2024-010"], "CLM-2024-028", "2024-06-11", 4500, "property_damage", "closed", "Shoplifting damage to displays"),
            (policy_map["COMM-2024-010"], "CLM-2024-029", "2024-09-30", 8000, "general_liability", "open", "Employee injury during stocking"),

            # COMM-2024-011: BuildRight — 2 claims CRITICAL severity (Sarah)
            (policy_map["COMM-2024-011"], "CLM-2024-030", "2024-05-14", 250000, "workers_compensation", "open", "Building collapse - catastrophic injuries",
             '[{"type": "image", "url": "https://images.unsplash.com/photo-1517089596392-fb9a9033e05b?w=400&h=300&fit=crop", "description": "Structural failure at construction site", "analysis_summary": "Complete failure of north load-bearing wall during concrete pour. Temporary shoring was insufficient for the load. Visible bowing and cracking pattern indicates progressive overload failure, not sudden impact."}, {"type": "pdf", "url": "/api/uploads/demo/structural-engineer-report.pdf", "description": "Independent structural engineering assessment", "analysis_summary": "Engineer conclusion: temporary shoring design was rated for 60% of actual load. Shop drawings were not reviewed by a licensed engineer prior to installation. OSHA violation 1926.701(a) applies. Estimated remediation: $380,000-$420,000."}]'),
            (policy_map["COMM-2024-011"], "CLM-2024-031", "2024-08-20", 35000, "property_damage", "closed", "Heavy equipment rollover", None),

            # COMM-2024-012: DataShield — 2 claims LOW (James)
            (policy_map["COMM-2024-012"], "CLM-2024-032", "2024-07-15", 8000, "cyber_breach", "closed", "Client data breach attempt"),
            (policy_map["COMM-2024-012"], "CLM-2024-033", "2024-10-28", 15000, "cyber_breach", "open", "Ransomware attack on client system"),

            # COMM-2024-013: SunValley Farms — 1 claim LOW (Sarah)
            (policy_map["COMM-2024-013"], "CLM-2024-034", "2024-06-20", 22000, "property_damage", "closed", "Storm damage to barn and equipment"),

            # COMM-2024-014: OceanView Hotels — 4 claims MEDIUM-HIGH (James)
            (policy_map["COMM-2024-014"], "CLM-2024-035", "2024-03-18", 9000, "general_liability", "closed", "Guest pool injury"),
            (policy_map["COMM-2024-014"], "CLM-2024-036", "2024-05-22", 14000, "property_damage", "closed", "Water damage from burst pipe"),
            (policy_map["COMM-2024-014"], "CLM-2024-037", "2024-08-10", 7500, "general_liability", "closed", "Guest food poisoning at restaurant"),
            (policy_map["COMM-2024-014"], "CLM-2024-038", "2024-11-05", 18000, "property_damage", "open", "Elevator malfunction and injury"),

            # COMM-2024-015: PrimeCare Dental — 1 claim LOW (James)
            (policy_map["COMM-2024-015"], "CLM-2024-039", "2024-07-25", 25000, "professional_liability", "open", "Patient claims improper procedure"),

            # COMM-2024-016: Eagle Transport — 5 claims HIGH (Sarah)
            (policy_map["COMM-2024-016"], "CLM-2024-040", "2024-02-08", 18000, "auto_accident", "closed", "Truck rollover on highway",
             '[{"type": "image", "url": "https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=400&h=300&fit=crop", "description": "Truck rollover scene - I-94 exit ramp", "analysis_summary": "Truck overturned on I-94 exit ramp. Visible damage to cab roof and right side panels. Trailer separated from cab, cargo spillage on roadway. Road surface shows no ice or debris - suggests speed as contributing factor."}, {"type": "pdf", "url": "/api/uploads/demo/police-report-040.pdf", "description": "Police accident report #2024-PR-0847", "analysis_summary": "Officer notes: driver exceeded posted speed limit (45 mph) approaching curve. No mechanical defects found. Driver tested negative for substances. Estimated speed at impact: 60+ mph per skid mark analysis."}]'),
            (policy_map["COMM-2024-016"], "CLM-2024-041", "2024-04-15", 12000, "auto_accident", "closed", "Rear-end collision at intersection", None),
            (policy_map["COMM-2024-016"], "CLM-2024-042", "2024-06-28", 9000, "auto_accident", "closed", "Side-swipe on delivery route"),
            (policy_map["COMM-2024-016"], "CLM-2024-043", "2024-09-05", 22000, "auto_accident", "open", "Multi-vehicle highway incident"),
            (policy_map["COMM-2024-016"], "CLM-2024-044", "2024-11-18", 15000, "property_damage", "open", "Cargo damage and spill"),

            # COMM-2024-017: BlueSky Development — 0 claims EXCELLENT (James)

            # COMM-2024-018: FreshBrew Coffee — 2 claims MEDIUM (James)
            (policy_map["COMM-2024-018"], "CLM-2024-045", "2024-04-30", 3500, "general_liability", "closed", "Customer burn from hot coffee"),
            (policy_map["COMM-2024-018"], "CLM-2024-046", "2024-10-15", 8000, "property_damage", "open", "Espresso machine explosion"),

            # COMM-2024-019: SteelEdge Manufacturing — 3 claims MEDIUM (Sarah)
            (policy_map["COMM-2024-019"], "CLM-2024-047", "2024-03-22", 32000, "workers_compensation", "closed", "Worker crushed hand in press",
             '[{"type": "image", "url": "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&h=300&fit=crop", "description": "Hydraulic press - safety guard removed", "analysis_summary": "Safety interlock guard was removed from the hydraulic press feed mechanism. Tool marks indicate deliberate removal. Light curtain sensor was also bypassed with manual wire bridge across terminals 4-5."}, {"type": "pdf", "url": "/api/uploads/demo/osha-citation-047.pdf", "description": "OSHA citation and proposed penalty", "analysis_summary": "Serious violation of 29 CFR 1910.217(c)(2) - point of operation guarding. Proposed penalty: $15,625. Abatement required within 30 days. Prior 2023 inspection had no violations for this equipment."}]'),
            (policy_map["COMM-2024-019"], "CLM-2024-048", "2024-07-14", 15000, "property_damage", "closed", "Chemical spill in production area"),
            (policy_map["COMM-2024-019"], "CLM-2024-049", "2024-11-02", 45000, "workers_compensation", "open", "Forklift accident with injuries"),

            # COMM-2024-020: PetCare Animal Hospital — 2 claims MEDIUM (James)
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
        result = await db.execute(text("SELECT COUNT(*) FROM users"))
        u_count = result.scalar()
        result = await db.execute(text("SELECT COUNT(*) FROM policies"))
        p_count = result.scalar()
        result = await db.execute(text("SELECT COUNT(*) FROM claims"))
        c_count = result.scalar()
        result = await db.execute(text("SELECT COUNT(*) FROM guidelines"))
        g_count = result.scalar()
        result = await db.execute(text("SELECT COUNT(*) FROM documents"))
        d_count = result.scalar()

        print(f"\n[OK] Database seeded successfully!")
        print(f"   Users:      {u_count}")
        print(f"   Policies:   {p_count}")
        print(f"   Claims:     {c_count}")
        print(f"   Guidelines: {g_count}")
        print(f"   Documents:  {d_count}")
        print(f"\n   Login credentials:")
        print(f"   - sarah@apexuw.com / sarah123 (Senior Underwriter, 10 policies)")
        print(f"   - james@apexuw.com / james123 (Underwriter, 10 policies)")
        print(f"\n   Sarah's high-risk policies:")
        print(f"   - COMM-2024-002: XYZ Restaurant -- 6 claims (HIGH FREQUENCY)")
        print(f"   - COMM-2024-003: SafeBuild Construction -- $175K claim (HIGH SEVERITY)")
        print(f"   - COMM-2024-011: BuildRight Contractors -- $250K claim (CRITICAL)")
        print(f"   - COMM-2024-016: Eagle Transport -- 5 claims (HIGH FREQUENCY)")
        print(f"\n   James's high-risk policies:")
        print(f"   - COMM-2024-008: CityBite Foods -- 5 claims (HIGH FREQUENCY)")
        print(f"   - COMM-2024-014: OceanView Hotels -- 4 claims (MEDIUM-HIGH)")
        print(f"\n   Geo coordinates: 20 distinct US cities for great map coverage")


if __name__ == "__main__":
    asyncio.run(seed())
