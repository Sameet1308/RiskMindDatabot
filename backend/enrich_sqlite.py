"""
RiskMind Data Enrichment — SQLite
Adds third-party data columns, zone tables, decisions, 2023 claims, new guidelines.
Run from backend/ directory: python enrich_sqlite.py
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "riskmind.db")

def run():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # ========================================================================
    # PART A: ALTER policies table — add third-party enrichment columns
    # ========================================================================
    new_cols = [
        ("property_address", "TEXT"),
        ("property_city", "TEXT"),
        ("property_state", "TEXT"),
        ("property_zip", "TEXT"),
        ("fema_flood_zone", "TEXT"),
        ("flood_risk_score", "INTEGER"),
        ("flood_zone_change_flag", "TEXT"),
        ("cat_aal", "REAL"),
        ("cat_pml_250yr", "REAL"),
        ("primary_peril", "TEXT"),
        ("cat_model_version", "TEXT"),
        ("construction_type", "TEXT"),
        ("year_built", "INTEGER"),
        ("stories", "INTEGER"),
        ("roof_type", "TEXT"),
        ("replacement_cost", "REAL"),
        ("protection_class", "INTEGER"),
        ("crime_index", "INTEGER"),
        ("property_crime_rate", "REAL"),
        ("business_credit_score", "INTEGER"),
        ("financial_stability", "TEXT"),
        ("cresta_zone", "TEXT"),
        ("risk_zone", "TEXT"),
        ("weather_hail_events_5yr", "INTEGER"),
        ("wildfire_risk_score", "INTEGER"),
        ("distance_to_fire_station", "REAL"),
        ("third_party_data_date", "TEXT"),
        ("insured_value", "REAL"),
    ]

    existing_cols = {row[1] for row in c.execute("PRAGMA table_info(policies)").fetchall()}
    for col_name, col_type in new_cols:
        if col_name not in existing_cols:
            c.execute(f"ALTER TABLE policies ADD COLUMN {col_name} {col_type}")
            print(f"  Added column: policies.{col_name}")
    conn.commit()

    # ========================================================================
    # PART B: UPDATE all 21 policies with realistic enrichment data
    # ========================================================================
    # Policy enrichment data keyed by policy_number
    # Lat/lon-based city assignments from existing seed data
    enrichments = {
        "COMM-2024-001": {  # ABC Manufacturing Inc — Detroit, MI
            "property_address": "4200 Michigan Ave",
            "property_city": "Detroit", "property_state": "MI", "property_zip": "48210",
            "fema_flood_zone": "X", "flood_risk_score": 18, "flood_zone_change_flag": None,
            "cat_aal": 8200, "cat_pml_250yr": 185000, "primary_peril": "SCS", "cat_model_version": "RMS v23",
            "construction_type": "Masonry", "year_built": 1978, "stories": 2, "roof_type": "Flat/Membrane",
            "replacement_cost": 1850000, "protection_class": 4,
            "crime_index": 62, "property_crime_rate": 1.8,
            "business_credit_score": 71, "financial_stability": "Stable",
            "cresta_zone": "US-MI-001", "risk_zone": "Midwest-Central",
            "weather_hail_events_5yr": 3, "wildfire_risk_score": 5, "distance_to_fire_station": 1.2,
            "third_party_data_date": "2026-01-15", "insured_value": 1600000,
        },
        "COMM-2024-002": {  # XYZ Restaurant Group — Miami, FL
            "property_address": "1455 Ocean Dr",
            "property_city": "Miami Beach", "property_state": "FL", "property_zip": "33139",
            "fema_flood_zone": "AE", "flood_risk_score": 72, "flood_zone_change_flag": None,
            "cat_aal": 42000, "cat_pml_250yr": 980000, "primary_peril": "Wind", "cat_model_version": "RMS v23",
            "construction_type": "Mixed", "year_built": 1995, "stories": 1, "roof_type": "Flat/Membrane",
            "replacement_cost": 920000, "protection_class": 3,
            "crime_index": 58, "property_crime_rate": 1.5,
            "business_credit_score": 42, "financial_stability": "Declining",
            "cresta_zone": "US-FL-001", "risk_zone": "Southeast-Coastal",
            "weather_hail_events_5yr": 1, "wildfire_risk_score": 8, "distance_to_fire_station": 0.8,
            "third_party_data_date": "2026-01-15", "insured_value": 800000,
        },
        "COMM-2024-003": {  # SafeBuild Construction — Denver, CO
            "property_address": "7801 E Colfax Ave",
            "property_city": "Denver", "property_state": "CO", "property_zip": "80220",
            "fema_flood_zone": "X500", "flood_risk_score": 22, "flood_zone_change_flag": None,
            "cat_aal": 15000, "cat_pml_250yr": 420000, "primary_peril": "Hail", "cat_model_version": "RMS v23",
            "construction_type": "Frame", "year_built": 2001, "stories": 2, "roof_type": "Shingle",
            "replacement_cost": 2800000, "protection_class": 3,
            "crime_index": 45, "property_crime_rate": 1.2,
            "business_credit_score": 38, "financial_stability": "Declining",
            "cresta_zone": "US-CO-001", "risk_zone": "Mountain-West",
            "weather_hail_events_5yr": 12, "wildfire_risk_score": 35, "distance_to_fire_station": 2.1,
            "third_party_data_date": "2026-01-15", "insured_value": 2400000,
        },
        "COMM-2024-004": {  # MedCare Health Services — Boston, MA
            "property_address": "275 Longwood Ave",
            "property_city": "Boston", "property_state": "MA", "property_zip": "02115",
            "fema_flood_zone": "X", "flood_risk_score": 25, "flood_zone_change_flag": None,
            "cat_aal": 12000, "cat_pml_250yr": 350000, "primary_peril": "Wind", "cat_model_version": "RMS v23",
            "construction_type": "Fire-Resistive", "year_built": 2010, "stories": 4, "roof_type": "Flat/Membrane",
            "replacement_cost": 3200000, "protection_class": 2,
            "crime_index": 38, "property_crime_rate": 1.0,
            "business_credit_score": 68, "financial_stability": "Stable",
            "cresta_zone": "US-MA-001", "risk_zone": "Northeast-Coastal",
            "weather_hail_events_5yr": 2, "wildfire_risk_score": 3, "distance_to_fire_station": 0.5,
            "third_party_data_date": "2026-01-15", "insured_value": 2800000,
        },
        "COMM-2024-005": {  # FastTrack Logistics — Dallas, TX
            "property_address": "3900 Irving Blvd",
            "property_city": "Dallas", "property_state": "TX", "property_zip": "75247",
            "fema_flood_zone": "X", "flood_risk_score": 28, "flood_zone_change_flag": "UPGRADED",
            "cat_aal": 18000, "cat_pml_250yr": 520000, "primary_peril": "Hail", "cat_model_version": "RMS v23",
            "construction_type": "Masonry", "year_built": 1988, "stories": 1, "roof_type": "Metal",
            "replacement_cost": 1650000, "protection_class": 4,
            "crime_index": 55, "property_crime_rate": 1.4,
            "business_credit_score": 55, "financial_stability": "Stable",
            "cresta_zone": "US-TX-003", "risk_zone": "Gulf-South",
            "weather_hail_events_5yr": 18, "wildfire_risk_score": 12, "distance_to_fire_station": 1.8,
            "third_party_data_date": "2026-01-15", "insured_value": 1400000,
        },
        "COMM-2024-006": {  # TechNova Solutions — San Francisco, CA
            "property_address": "650 Townsend St",
            "property_city": "San Francisco", "property_state": "CA", "property_zip": "94103",
            "fema_flood_zone": "X", "flood_risk_score": 15, "flood_zone_change_flag": None,
            "cat_aal": 28000, "cat_pml_250yr": 750000, "primary_peril": "Earthquake", "cat_model_version": "RMS v23",
            "construction_type": "Fire-Resistive", "year_built": 2015, "stories": 5, "roof_type": "Flat/Membrane",
            "replacement_cost": 2100000, "protection_class": 2,
            "crime_index": 52, "property_crime_rate": 1.6,
            "business_credit_score": 82, "financial_stability": "Stable",
            "cresta_zone": "US-CA-002", "risk_zone": "Pacific-West",
            "weather_hail_events_5yr": 0, "wildfire_risk_score": 22, "distance_to_fire_station": 0.4,
            "third_party_data_date": "2026-01-15", "insured_value": 1800000,
        },
        "COMM-2024-007": {  # GreenLeaf Properties — Phoenix, AZ
            "property_address": "2101 N Central Ave",
            "property_city": "Phoenix", "property_state": "AZ", "property_zip": "85004",
            "fema_flood_zone": "X", "flood_risk_score": 12, "flood_zone_change_flag": None,
            "cat_aal": 5500, "cat_pml_250yr": 120000, "primary_peril": "Hail", "cat_model_version": "RMS v23",
            "construction_type": "Masonry", "year_built": 2005, "stories": 3, "roof_type": "Tile",
            "replacement_cost": 2600000, "protection_class": 3,
            "crime_index": 48, "property_crime_rate": 1.3,
            "business_credit_score": 88, "financial_stability": "Improving",
            "cresta_zone": "US-AZ-001", "risk_zone": "Mountain-West",
            "weather_hail_events_5yr": 4, "wildfire_risk_score": 45, "distance_to_fire_station": 1.5,
            "third_party_data_date": "2026-01-15", "insured_value": 2200000,
        },
        "COMM-2024-008": {  # CityBite Foods LLC — New York, NY
            "property_address": "412 W 42nd St",
            "property_city": "New York", "property_state": "NY", "property_zip": "10036",
            "fema_flood_zone": "X", "flood_risk_score": 20, "flood_zone_change_flag": None,
            "cat_aal": 9500, "cat_pml_250yr": 280000, "primary_peril": "Wind", "cat_model_version": "RMS v23",
            "construction_type": "Mixed", "year_built": 1972, "stories": 1, "roof_type": "Flat/Membrane",
            "replacement_cost": 750000, "protection_class": 2,
            "crime_index": 42, "property_crime_rate": 1.1,
            "business_credit_score": 35, "financial_stability": "Declining",
            "cresta_zone": "US-NY-001", "risk_zone": "Northeast-Coastal",
            "weather_hail_events_5yr": 2, "wildfire_risk_score": 2, "distance_to_fire_station": 0.3,
            "third_party_data_date": "2026-01-15", "insured_value": 650000,
        },
        "COMM-2024-009": {  # IronWorks Fabrication — Pittsburgh, PA
            "property_address": "5200 Butler St",
            "property_city": "Pittsburgh", "property_state": "PA", "property_zip": "15201",
            "fema_flood_zone": "X500", "flood_risk_score": 30, "flood_zone_change_flag": None,
            "cat_aal": 7800, "cat_pml_250yr": 195000, "primary_peril": "SCS", "cat_model_version": "RMS v23",
            "construction_type": "Masonry", "year_built": 1965, "stories": 2, "roof_type": "Metal",
            "replacement_cost": 2400000, "protection_class": 4,
            "crime_index": 44, "property_crime_rate": 1.2,
            "business_credit_score": 74, "financial_stability": "Stable",
            "cresta_zone": "US-PA-001", "risk_zone": "Northeast-Coastal",
            "weather_hail_events_5yr": 4, "wildfire_risk_score": 4, "distance_to_fire_station": 1.6,
            "third_party_data_date": "2026-01-15", "insured_value": 2000000,
        },
        "COMM-2024-010": {  # QuickMart Retail Chain — Atlanta, GA
            "property_address": "1800 Peachtree St NW",
            "property_city": "Atlanta", "property_state": "GA", "property_zip": "30309",
            "fema_flood_zone": "X", "flood_risk_score": 16, "flood_zone_change_flag": None,
            "cat_aal": 6200, "cat_pml_250yr": 155000, "primary_peril": "SCS", "cat_model_version": "RMS v23",
            "construction_type": "Frame", "year_built": 1998, "stories": 1, "roof_type": "Shingle",
            "replacement_cost": 720000, "protection_class": 3,
            "crime_index": 55, "property_crime_rate": 1.5,
            "business_credit_score": 62, "financial_stability": "Stable",
            "cresta_zone": "US-GA-001", "risk_zone": "Southeast-Inland",
            "weather_hail_events_5yr": 6, "wildfire_risk_score": 10, "distance_to_fire_station": 1.0,
            "third_party_data_date": "2026-01-15", "insured_value": 620000,
        },
        "COMM-2024-011": {  # BuildRight Contractors — Los Angeles, CA
            "property_address": "8901 S Western Ave",
            "property_city": "Los Angeles", "property_state": "CA", "property_zip": "90047",
            "fema_flood_zone": "X", "flood_risk_score": 14, "flood_zone_change_flag": None,
            "cat_aal": 35000, "cat_pml_250yr": 1200000, "primary_peril": "Earthquake", "cat_model_version": "RMS v23",
            "construction_type": "Frame", "year_built": 1985, "stories": 2, "roof_type": "Shingle",
            "replacement_cost": 3500000, "protection_class": 3,
            "crime_index": 58, "property_crime_rate": 1.6,
            "business_credit_score": 32, "financial_stability": "Declining",
            "cresta_zone": "US-CA-001", "risk_zone": "Pacific-West",
            "weather_hail_events_5yr": 0, "wildfire_risk_score": 62, "distance_to_fire_station": 2.8,
            "third_party_data_date": "2026-01-15", "insured_value": 2800000,
        },
        "COMM-2024-012": {  # DataShield Cybersec — Seattle, WA
            "property_address": "400 Broad St",
            "property_city": "Seattle", "property_state": "WA", "property_zip": "98109",
            "fema_flood_zone": "X", "flood_risk_score": 18, "flood_zone_change_flag": None,
            "cat_aal": 14000, "cat_pml_250yr": 380000, "primary_peril": "Earthquake", "cat_model_version": "RMS v23",
            "construction_type": "Fire-Resistive", "year_built": 2018, "stories": 6, "roof_type": "Flat/Membrane",
            "replacement_cost": 2000000, "protection_class": 2,
            "crime_index": 40, "property_crime_rate": 1.3,
            "business_credit_score": 78, "financial_stability": "Improving",
            "cresta_zone": "US-WA-001", "risk_zone": "Pacific-West",
            "weather_hail_events_5yr": 1, "wildfire_risk_score": 18, "distance_to_fire_station": 0.6,
            "third_party_data_date": "2026-01-15", "insured_value": 1700000,
        },
        "COMM-2024-013": {  # SunValley Farms — Bakersfield, CA
            "property_address": "12400 Stockdale Hwy",
            "property_city": "Bakersfield", "property_state": "CA", "property_zip": "93312",
            "fema_flood_zone": "X", "flood_risk_score": 10, "flood_zone_change_flag": None,
            "cat_aal": 9200, "cat_pml_250yr": 280000, "primary_peril": "Earthquake", "cat_model_version": "RMS v23",
            "construction_type": "Frame", "year_built": 1990, "stories": 1, "roof_type": "Metal",
            "replacement_cost": 1200000, "protection_class": 6,
            "crime_index": 42, "property_crime_rate": 1.1,
            "business_credit_score": 75, "financial_stability": "Stable",
            "cresta_zone": "US-CA-003", "risk_zone": "Pacific-West",
            "weather_hail_events_5yr": 1, "wildfire_risk_score": 55, "distance_to_fire_station": 4.5,
            "third_party_data_date": "2026-01-15", "insured_value": 1000000,
        },
        "COMM-2024-014": {  # OceanView Hotels — Orlando, FL
            "property_address": "9801 International Dr",
            "property_city": "Orlando", "property_state": "FL", "property_zip": "32819",
            "fema_flood_zone": "AE", "flood_risk_score": 58, "flood_zone_change_flag": "UPGRADED",
            "cat_aal": 38000, "cat_pml_250yr": 890000, "primary_peril": "Wind", "cat_model_version": "RMS v23",
            "construction_type": "Masonry", "year_built": 2002, "stories": 4, "roof_type": "Flat/Membrane",
            "replacement_cost": 2800000, "protection_class": 3,
            "crime_index": 50, "property_crime_rate": 1.4,
            "business_credit_score": 58, "financial_stability": "Stable",
            "cresta_zone": "US-FL-001", "risk_zone": "Southeast-Coastal",
            "weather_hail_events_5yr": 3, "wildfire_risk_score": 12, "distance_to_fire_station": 1.2,
            "third_party_data_date": "2026-01-15", "insured_value": 2400000,
        },
        "COMM-2024-015": {  # PrimeCare Dental — Minneapolis, MN
            "property_address": "701 Park Ave S",
            "property_city": "Minneapolis", "property_state": "MN", "property_zip": "55415",
            "fema_flood_zone": "X", "flood_risk_score": 15, "flood_zone_change_flag": None,
            "cat_aal": 6800, "cat_pml_250yr": 160000, "primary_peril": "SCS", "cat_model_version": "RMS v23",
            "construction_type": "Fire-Resistive", "year_built": 2012, "stories": 2, "roof_type": "Flat/Membrane",
            "replacement_cost": 1100000, "protection_class": 2,
            "crime_index": 40, "property_crime_rate": 1.1,
            "business_credit_score": 72, "financial_stability": "Stable",
            "cresta_zone": "US-MN-001", "risk_zone": "Midwest-Central",
            "weather_hail_events_5yr": 8, "wildfire_risk_score": 3, "distance_to_fire_station": 0.7,
            "third_party_data_date": "2026-01-15", "insured_value": 950000,
        },
        "COMM-2024-016": {  # Eagle Transport Co — Chicago, IL
            "property_address": "4100 S Ashland Ave",
            "property_city": "Chicago", "property_state": "IL", "property_zip": "60609",
            "fema_flood_zone": "X500", "flood_risk_score": 32, "flood_zone_change_flag": None,
            "cat_aal": 11000, "cat_pml_250yr": 310000, "primary_peril": "SCS", "cat_model_version": "RMS v23",
            "construction_type": "Masonry", "year_built": 1975, "stories": 1, "roof_type": "Flat/Membrane",
            "replacement_cost": 1800000, "protection_class": 3,
            "crime_index": 60, "property_crime_rate": 1.7,
            "business_credit_score": 45, "financial_stability": "Declining",
            "cresta_zone": "US-IL-001", "risk_zone": "Midwest-Central",
            "weather_hail_events_5yr": 7, "wildfire_risk_score": 2, "distance_to_fire_station": 0.9,
            "third_party_data_date": "2026-01-15", "insured_value": 1500000,
        },
        "COMM-2024-017": {  # BlueSky Development — Austin, TX
            "property_address": "600 Congress Ave",
            "property_city": "Austin", "property_state": "TX", "property_zip": "78701",
            "fema_flood_zone": "AE", "flood_risk_score": 55, "flood_zone_change_flag": "UPGRADED",
            "cat_aal": 22000, "cat_pml_250yr": 580000, "primary_peril": "Hail", "cat_model_version": "RMS v23",
            "construction_type": "Fire-Resistive", "year_built": 2019, "stories": 8, "roof_type": "Flat/Membrane",
            "replacement_cost": 3400000, "protection_class": 2,
            "crime_index": 35, "property_crime_rate": 0.9,
            "business_credit_score": 90, "financial_stability": "Improving",
            "cresta_zone": "US-TX-003", "risk_zone": "Gulf-South",
            "weather_hail_events_5yr": 14, "wildfire_risk_score": 28, "distance_to_fire_station": 0.5,
            "third_party_data_date": "2026-01-15", "insured_value": 2900000,
        },
        "COMM-2024-018": {  # FreshBrew Coffee Chain — Portland, OR
            "property_address": "1020 NW Glisan St",
            "property_city": "Portland", "property_state": "OR", "property_zip": "97209",
            "fema_flood_zone": "X", "flood_risk_score": 20, "flood_zone_change_flag": None,
            "cat_aal": 7000, "cat_pml_250yr": 190000, "primary_peril": "Earthquake", "cat_model_version": "RMS v23",
            "construction_type": "Frame", "year_built": 2008, "stories": 1, "roof_type": "Shingle",
            "replacement_cost": 650000, "protection_class": 3,
            "crime_index": 48, "property_crime_rate": 1.4,
            "business_credit_score": 65, "financial_stability": "Stable",
            "cresta_zone": "US-OR-001", "risk_zone": "Pacific-West",
            "weather_hail_events_5yr": 1, "wildfire_risk_score": 38, "distance_to_fire_station": 0.8,
            "third_party_data_date": "2026-01-15", "insured_value": 550000,
        },
        "COMM-2024-019": {  # SteelEdge Manufacturing — Cleveland, OH
            "property_address": "3100 Lakeside Ave E",
            "property_city": "Cleveland", "property_state": "OH", "property_zip": "44114",
            "fema_flood_zone": "X500", "flood_risk_score": 28, "flood_zone_change_flag": None,
            "cat_aal": 9000, "cat_pml_250yr": 220000, "primary_peril": "SCS", "cat_model_version": "RMS v23",
            "construction_type": "Masonry", "year_built": 1970, "stories": 2, "roof_type": "Metal",
            "replacement_cost": 2600000, "protection_class": 4,
            "crime_index": 58, "property_crime_rate": 1.6,
            "business_credit_score": 60, "financial_stability": "Stable",
            "cresta_zone": "US-OH-001", "risk_zone": "Midwest-Central",
            "weather_hail_events_5yr": 5, "wildfire_risk_score": 3, "distance_to_fire_station": 1.4,
            "third_party_data_date": "2026-01-15", "insured_value": 2200000,
        },
        "COMM-2024-020": {  # PetCare Animal Hospital — Nashville, TN
            "property_address": "2400 West End Ave",
            "property_city": "Nashville", "property_state": "TN", "property_zip": "37203",
            "fema_flood_zone": "X", "flood_risk_score": 22, "flood_zone_change_flag": None,
            "cat_aal": 5800, "cat_pml_250yr": 140000, "primary_peril": "SCS", "cat_model_version": "RMS v23",
            "construction_type": "Frame", "year_built": 2010, "stories": 1, "roof_type": "Shingle",
            "replacement_cost": 850000, "protection_class": 3,
            "crime_index": 44, "property_crime_rate": 1.2,
            "business_credit_score": 70, "financial_stability": "Stable",
            "cresta_zone": "US-TN-001", "risk_zone": "Southeast-Inland",
            "weather_hail_events_5yr": 5, "wildfire_risk_score": 8, "distance_to_fire_station": 1.1,
            "third_party_data_date": "2026-01-15", "insured_value": 720000,
        },
        "P-1023": {  # Northwind Logistics — Memphis, TN
            "property_address": "3700 Lamar Ave",
            "property_city": "Memphis", "property_state": "TN", "property_zip": "38118",
            "fema_flood_zone": "X500", "flood_risk_score": 35, "flood_zone_change_flag": None,
            "cat_aal": 10500, "cat_pml_250yr": 290000, "primary_peril": "SCS", "cat_model_version": "RMS v23",
            "construction_type": "Masonry", "year_built": 1982, "stories": 1, "roof_type": "Metal",
            "replacement_cost": 1900000, "protection_class": 4,
            "crime_index": 68, "property_crime_rate": 2.1,
            "business_credit_score": 52, "financial_stability": "Declining",
            "cresta_zone": "US-TN-002", "risk_zone": "Southeast-Inland",
            "weather_hail_events_5yr": 6, "wildfire_risk_score": 5, "distance_to_fire_station": 2.0,
            "third_party_data_date": "2026-01-15", "insured_value": 1600000,
        },
    }

    for pn, data in enrichments.items():
        set_clauses = ", ".join(f"{k} = ?" for k in data.keys())
        vals = list(data.values()) + [pn]
        c.execute(f"UPDATE policies SET {set_clauses} WHERE policy_number = ?", vals)
    conn.commit()
    print(f"[OK] Enriched {len(enrichments)} policies with third-party data")

    # ========================================================================
    # PART C: CREATE zone_thresholds table
    # ========================================================================
    c.execute("""
        CREATE TABLE IF NOT EXISTS zone_thresholds (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            threshold_id TEXT UNIQUE,
            zone_type TEXT,
            metric TEXT,
            limit_value REAL,
            limit_unit TEXT,
            action TEXT,
            set_by TEXT,
            effective_date TEXT,
            notes TEXT
        )
    """)

    thresholds = [
        ("ZT-001", "cresta_zone", "total_tiv", 7000000, "USD", "refer", "CUO", "2024-01-01", "Max TIV per CRESTA zone. Breach requires CUO approval for new business."),
        ("ZT-002", "cresta_zone", "policy_count", 5, "count", "review", "CUO", "2024-01-01", "Max policies per CRESTA zone. Triggers concentration review."),
        ("ZT-003", "cresta_zone", "pml_250yr", 5000000, "USD", "refer", "Reinsurance Treaty", "2024-01-01", "Max PML at 250-year return per zone. Treaty limit."),
        ("ZT-004", "fema_flood_zone", "policy_count_AE", 4, "count", "review", "CUO", "2024-01-01", "Max policies in FEMA AE zone per county."),
        ("ZT-005", "cresta_zone", "loss_ratio", 85, "percent", "review", "CUO", "2024-01-01", "Zone loss ratio trigger. Above 85% requires pricing review."),
        ("ZT-006", "state", "tiv_concentration", 40, "percent", "refer", "Regulatory", "2024-01-01", "Max 40% of total book TIV in any single state."),
        ("ZT-007", "risk_zone", "high_risk_count", 3, "count", "review", "CUO", "2024-06-01", "Max HIGH risk policies per risk zone before portfolio review."),
        ("ZT-008", "cresta_zone", "avg_credit_score", 45, "score", "review", "CUO", "2024-06-01", "If avg credit score in zone falls below 45, flag portfolio."),
        ("ZT-009", "fema_flood_zone", "total_tiv_VE", 3000000, "USD", "decline", "Regulatory", "2024-01-01", "Max TIV in FEMA VE zones. Regulatory hard limit."),
        ("ZT-010", "state", "cat_pml_250yr", 3500000, "USD", "refer", "Reinsurance Treaty", "2024-01-01", "Max state-level PML accumulation per treaty."),
        ("ZT-011", "risk_zone", "wildfire_exposure", 70, "score", "decline", "CUO", "2024-03-01", "Decline new business if avg wildfire score in zone exceeds 70."),
        ("ZT-012", "cresta_zone", "premium_adequacy", 60, "percent", "review", "CUO", "2024-01-01", "If zone loss ratio indicates premium inadequacy below 60%, trigger rate review."),
    ]

    for t in thresholds:
        c.execute("INSERT OR IGNORE INTO zone_thresholds (threshold_id, zone_type, metric, limit_value, limit_unit, action, set_by, effective_date, notes) VALUES (?,?,?,?,?,?,?,?,?)", t)
    conn.commit()
    print(f"[OK] Created zone_thresholds with {len(thresholds)} rules")

    # ========================================================================
    # PART D: CREATE zone_accumulation table (pre-computed)
    # ========================================================================
    c.execute("""
        CREATE TABLE IF NOT EXISTS zone_accumulation (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            zone_id TEXT,
            zone_type TEXT,
            zone_name TEXT,
            total_tiv REAL,
            policy_count INTEGER,
            max_single_loss REAL,
            pml_250yr REAL,
            avg_loss_ratio REAL,
            gross_premium REAL,
            tiv_qoq_change REAL,
            computed_date TEXT
        )
    """)

    # Pre-compute from enrichment data
    from collections import defaultdict
    zone_data = defaultdict(lambda: {"tiv": 0, "count": 0, "pml": 0, "premium": 0, "max_loss": 0, "policies": []})
    for pn, data in enrichments.items():
        zone = data["cresta_zone"]
        iv = data["insured_value"]
        zone_data[zone]["tiv"] += iv
        zone_data[zone]["count"] += 1
        zone_data[zone]["pml"] += data["cat_pml_250yr"]
        zone_data[zone]["policies"].append(pn)
        # Get premium from existing policies
        row = c.execute("SELECT premium FROM policies WHERE policy_number = ?", (pn,)).fetchone()
        if row:
            zone_data[zone]["premium"] += row[0]

    # Get claims by policy for loss ratio
    claim_totals = {}
    for row in c.execute("SELECT p.policy_number, COALESCE(SUM(c.claim_amount), 0) FROM policies p LEFT JOIN claims c ON p.id = c.policy_id GROUP BY p.policy_number").fetchall():
        claim_totals[row[0]] = row[1]

    c.execute("DELETE FROM zone_accumulation")
    for zone, d in zone_data.items():
        total_claims = sum(claim_totals.get(pn, 0) for pn in d["policies"])
        avg_lr = round(total_claims * 100.0 / d["premium"], 1) if d["premium"] > 0 else 0
        max_loss = max(claim_totals.get(pn, 0) for pn in d["policies"])
        # Zone name from zone id
        state_code = zone.split("-")[1] if "-" in zone else "??"
        zone_names = {
            "FL": "Florida Southeast", "TX": "Texas Central/Gulf",
            "CA": "California", "MI": "Michigan Detroit Metro",
            "CO": "Colorado Front Range", "MA": "Massachusetts Greater Boston",
            "NY": "New York Metro", "PA": "Pennsylvania Pittsburgh",
            "GA": "Georgia Atlanta Metro", "AZ": "Arizona Phoenix Metro",
            "WA": "Washington Seattle Metro", "OR": "Oregon Portland Metro",
            "IL": "Illinois Chicago Metro", "MN": "Minnesota Twin Cities",
            "TN": "Tennessee", "OH": "Ohio Cleveland Metro",
        }
        zname = zone_names.get(state_code, state_code)
        # Vary QoQ change
        import random
        qoq = round(random.uniform(-8, 15), 1)

        c.execute("""INSERT INTO zone_accumulation
            (zone_id, zone_type, zone_name, total_tiv, policy_count, max_single_loss, pml_250yr, avg_loss_ratio, gross_premium, tiv_qoq_change, computed_date)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
            (zone, "cresta_zone", zname, d["tiv"], d["count"], max_loss, d["pml"], avg_lr, d["premium"], qoq, "2026-02-19"))
    conn.commit()
    print(f"[OK] Pre-computed zone_accumulation for {len(zone_data)} zones")

    # ========================================================================
    # PART E: CREATE data_sources registry
    # ========================================================================
    c.execute("""
        CREATE TABLE IF NOT EXISTS data_sources (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_id TEXT UNIQUE,
            source_name TEXT,
            provider TEXT,
            data_type TEXT,
            update_frequency TEXT,
            last_updated TEXT,
            record_count INTEGER,
            storage TEXT,
            description TEXT
        )
    """)

    sources = [
        ("DS-001", "FEMA National Flood Hazard Layer", "FEMA", "flood_zone", "annual", "2025-10-01", 21, "sqlite", "Official FEMA flood zone designations. Maps to fema_flood_zone and flood_risk_score columns."),
        ("DS-002", "First Street Foundation Flood Model", "First Street", "flood_risk", "quarterly", "2025-12-15", 21, "sqlite", "Property-level flood risk scores (0-100) incorporating future climate projections."),
        ("DS-003", "RMS North Atlantic Hurricane Model v23", "RMS/Moody's", "catastrophe_model", "annual", "2025-08-01", 21, "sqlite", "AAL, PML-250yr, and primary peril assignments. Model version: RMS v23."),
        ("DS-004", "CoreLogic Property Characteristics", "CoreLogic", "property_data", "semi-annual", "2025-11-01", 21, "sqlite", "Construction type, year built, stories, roof type, replacement cost, protection class."),
        ("DS-005", "FBI Uniform Crime Reports", "FBI/DOJ", "crime_data", "annual", "2025-09-01", 21, "sqlite", "County-level crime index (0-100) and property crime rate multiplier."),
        ("DS-006", "D&B Commercial Credit Scores", "Dun & Bradstreet", "financial_data", "monthly", "2026-02-01", 21, "sqlite", "Business credit scores (0-100) and financial stability indicators."),
        ("DS-007", "NOAA Severe Weather Database", "NOAA", "weather_data", "quarterly", "2025-12-01", 21, "sqlite", "5-year hail event counts and wildfire risk scores by location."),
        ("DS-008", "Company UW Guidelines v4.2", "Internal", "guidelines", "as-needed", "2026-01-15", 25, "chromadb", "Underwriting guidelines including industry-specific, geographic, and compliance rules."),
        ("DS-009", "Historical UW Decisions", "Internal", "decisions", "real-time", "2026-02-19", 15, "chromadb", "Past underwriting decisions with rationale, used for precedent-based reasoning."),
        ("DS-010", "State Regulatory Filings", "NAIC/State DOIs", "regulatory", "quarterly", "2025-12-01", 5, "chromadb", "NAIC Model Bulletin and state-specific AI/insurance regulatory guidance."),
        ("DS-011", "NAIC Model Bulletin Dec 2023", "NAIC", "regulatory", "annual", "2023-12-04", 1, "chromadb", "AI governance framework for insurers. Adopted by 23+ states."),
        ("DS-012", "Cat Model Commentary & Outlook", "Internal/RMS", "commentary", "quarterly", "2026-01-10", 3, "chromadb", "Quarterly risk commentary on hurricane, flood, and wildfire exposure trends."),
        ("DS-013", "Engineering & Inspection Reports", "Various vendors", "inspections", "as-needed", "2025-11-15", 0, "chromadb", "Third-party inspection reports for high-value or high-risk properties."),
    ]

    for s in sources:
        c.execute("INSERT OR IGNORE INTO data_sources (source_id, source_name, provider, data_type, update_frequency, last_updated, record_count, storage, description) VALUES (?,?,?,?,?,?,?,?,?)", s)
    conn.commit()
    print(f"[OK] Created data_sources registry with {len(sources)} entries")

    # ========================================================================
    # PART F: SEED decisions table with 15 historical decisions
    # ========================================================================
    decisions = [
        # 5 ACCEPT decisions
        ("COMM-2024-007", "accept", "Clean loss history with zero claims in current policy period. All eligibility guidelines (1.1.1, 2.1.1) met. Business credit score 88 (above 2.1.2 threshold of 650 equivalent). Financial stability: Improving. Loss ratio 0%. Flood zone X with low risk score 12. Recommend standard renewal at current terms with 3% loyalty credit per guideline 5.1.1.", "low", "sarah@apexuw.com", "2024-08-15"),
        ("COMM-2024-006", "accept", "Single minor cyber breach claim of $5,000 (closed). Loss ratio 12.5%, well within favorable threshold per guideline 5.1.1. Strong credit score of 82. Fire-resistive construction, SFBA earthquake exposure within cat model tolerance. Technology sector growth supports premium adequacy. Standard renewal recommended.", "low", "james@apexuw.com", "2024-11-20"),
        ("COMM-2024-017", "accept", "Zero claims, excellent credit score 90, improving financial trajectory. Austin TX location in AE flood zone but recently upgraded FEMA mapping shows manageable exposure. New fire-resistive construction (2019) reduces property risk. TIV within zone concentration limits. Recommend standard terms.", "low", "james@apexuw.com", "2025-01-10"),
        ("COMM-2024-001", "accept", "Two property damage claims totaling $23,500 over policy period. Loss ratio 47% - within favorable range per guideline 5.1.1. Manufacturing facility in good condition, credit score 71. Masonry construction with protection class 4. Claims are routine maintenance-type losses. Standard renewal with 5% rate increase to reflect frequency.", "low", "sarah@apexuw.com", "2024-09-05"),
        ("COMM-2024-013", "accept", "Single storm damage claim of $22,000 (closed). Agriculture sector inherently exposed to weather but loss ratio 57.9% is moderate. Credit score 75, stable financials. Bakersfield location has minimal flood risk. Recommend renewal with weather-related deductible adjustment per guideline 5.1.2.", "low", "sarah@apexuw.com", "2025-02-01"),

        # 4 REFER decisions
        ("COMM-2024-005", "refer", "Four claims totaling $63,500 in current period. Loss ratio 141% - significantly breaches adverse threshold per guideline 5.1.3. Transportation fleet showing deteriorating trend with 2 additional 2024 claims vs prior year. Credit score 55 and declining. Approaching section 3.1.1 frequency threshold of 5 claims. Recommend senior review for pricing action: minimum 20% rate increase or non-renewal.", "medium", "sarah@apexuw.com", "2025-01-15"),
        ("COMM-2024-014", "refer", "Four claims totaling $48,500 across GL and property. Loss ratio 93.3% breaches section 5.1.3 adverse threshold. Orlando FL location in AE flood zone (recently upgraded) with wind PML of $890K. Hospitality sector has elevated GL exposure. Credit score 58. Requires senior underwriter review per guideline 7.1.1 before renewal decision.", "medium", "james@apexuw.com", "2025-03-01"),
        ("COMM-2024-019", "refer", "Three claims totaling $92,000 including $45K open workers comp claim. Loss ratio 131.4% - adverse per guideline 5.1.3. Manufacturing facility built 1970, older construction increases risk. Workers compensation trend concerning - two WC claims suggesting systemic safety issues. Refer for safety audit per construction/manufacturing protocol. Senior review required.", "medium", "sarah@apexuw.com", "2025-04-15"),
        ("P-1023", "refer", "Four claims totaling $63,000 with open $24K auto accident. Loss ratio 121.2% breaches section 5.1.3 threshold. Transportation account in Memphis TN with high crime index (68). Fleet safety deteriorating with 3 auto accidents. Credit score 52 and financial stability declining. Refer to senior UW - consider fleet safety requirements per section 4.1.2 or non-renewal.", "high", "james@apexuw.com", "2025-05-01"),

        # 4 DECLINE decisions
        ("COMM-2024-002", "decline", "Six claims totaling $26,000 - breaches section 3.1.1 frequency threshold of 5 claims. Loss ratio 74.3%. Miami Beach FL in AE flood zone with wind PML $980K. Business credit score 42 below financial standing threshold (section 2.1.2). Financial stability: Declining. Multiple general liability claims indicate systemic operational issues. Decline renewal and recommend risk improvement plan before reconsideration.", "high", "sarah@apexuw.com", "2025-06-01"),
        ("COMM-2024-011", "decline", "Two claims but $250K building collapse is catastrophic - breaches section 4.3.2 catastrophic event threshold of $100K and section 4.2.1 aggregate threshold of $200K. Total claims $285,000, loss ratio 356.3%. Credit score 32 - severely below section 2.1.2 threshold. LA earthquake zone with $1.2M PML. Frame construction from 1985 with wildfire score 62. Decline - unacceptable risk concentration.", "high", "sarah@apexuw.com", "2025-07-01"),
        ("COMM-2024-008", "decline", "Five claims totaling $19,500 - breaches section 3.1.1 frequency threshold. Restaurant in NYC with declining credit score of 35. Financial stability: Declining. Despite low individual claim amounts, frequency pattern indicates persistent operational failures. Loss ratio 65% approaching adverse territory. Combined with poor credit and frequency breach, recommend decline and non-renewal.", "high", "james@apexuw.com", "2025-08-15"),
        ("COMM-2024-003", "decline", "Three claims including $175K crane collapse - breaches section 4.1.1 single claim severity threshold of $100K and section 4.3.2 catastrophic event threshold. Total claims $215,500, loss ratio 287.3%. Workers compensation frequency concerning - 2 of 3 claims are WC. Construction safety audit (section 4.1.1 new) required but unlikely to pass given $175K event. Credit score 38, declining financials. Decline with recommendation for complete loss control overhaul.", "high", "sarah@apexuw.com", "2025-09-01"),

        # 2 NON-RENEWAL decisions
        ("COMM-2024-016", "decline", "NON-RENEWAL. Five claims totaling $76,000 - breaches section 3.1.1 frequency threshold. Transportation account with 4 auto accidents indicating fleet safety failure. Deteriorating year-over-year trend: claim count increased from 2 (2023) to 5 (2024). Loss ratio 158.3%. Chicago location with crime index 60. Credit score 45, declining. Per section 4.1.2 fleet safety requirements, fleet score below minimum. Non-renewal effective at policy expiration.", "high", "sarah@apexuw.com", "2025-10-01"),
        ("COMM-2024-010", "refer", "NON-RENEWAL RECOMMENDATION. Three claims totaling $18,500 in retail environment. Loss ratio 66.1% in moderate-adverse range per section 5.1.2. Credit score 62 but trending down. Atlanta location acceptable risk profile but GL frequency (2 slip-and-fall type claims) suggests inadequate premises maintenance. Recommend non-renewal unless insured provides evidence of safety improvements and accepts 15% rate increase per section 5.1.3.", "medium", "james@apexuw.com", "2025-11-15"),
    ]

    for d in decisions:
        c.execute("INSERT OR IGNORE INTO decisions (policy_number, decision, reason, risk_level, decided_by, created_at) VALUES (?,?,?,?,?,?)", d)
    conn.commit()
    print(f"[OK] Seeded {len(decisions)} historical decisions")

    # ========================================================================
    # PART G: ADD 2023 claims for trend analysis
    # ========================================================================
    # Get policy_id map
    pid_map = {}
    for row in c.execute("SELECT id, policy_number FROM policies").fetchall():
        pid_map[row[1]] = row[0]

    claims_2023 = [
        # Construction — MORE claims in 2023 than 2024 (improving trend)
        (pid_map["COMM-2024-003"], "CLM-2023-001", "2023-02-15", 45000, "workers_compensation", "closed", "Scaffolding collapse during exterior work, two workers injured"),
        (pid_map["COMM-2024-003"], "CLM-2023-002", "2023-05-20", 28000, "property_damage", "closed", "Excavator damaged underground utility line during site prep"),
        (pid_map["COMM-2024-003"], "CLM-2023-003", "2023-08-10", 65000, "workers_compensation", "closed", "Heavy equipment rollover, operator hospitalized"),
        (pid_map["COMM-2024-003"], "CLM-2023-004", "2023-11-05", 15000, "property_damage", "closed", "Weather damage to materials stored on-site"),
        (pid_map["COMM-2024-011"], "CLM-2023-005", "2023-03-22", 120000, "workers_compensation", "closed", "Trench collapse at residential development site"),
        (pid_map["COMM-2024-011"], "CLM-2023-006", "2023-07-14", 38000, "property_damage", "closed", "Crane boom struck adjacent structure during lift"),
        (pid_map["COMM-2024-011"], "CLM-2023-007", "2023-10-30", 22000, "environmental", "closed", "Diesel fuel spill from generator at construction site"),

        # Transportation — FEWER claims in 2023 (deteriorating trend into 2024)
        (pid_map["COMM-2024-016"], "CLM-2023-008", "2023-04-18", 8500, "auto_accident", "closed", "Minor fender bender during delivery route"),
        (pid_map["COMM-2024-016"], "CLM-2023-009", "2023-09-25", 6000, "property_damage", "closed", "Cargo strap failure, minor product damage"),
        (pid_map["COMM-2024-005"], "CLM-2023-010", "2023-06-12", 11000, "auto_accident", "closed", "Backing accident at loading dock"),
        (pid_map["P-1023"], "CLM-2023-011", "2023-03-08", 9500, "auto_accident", "closed", "Side-mirror collision with parked vehicle"),
        (pid_map["P-1023"], "CLM-2023-012", "2023-10-15", 7000, "property_damage", "closed", "Pallet jack damaged warehouse floor"),

        # Healthcare — stable trend
        (pid_map["COMM-2024-004"], "CLM-2023-013", "2023-05-10", 35000, "professional_liability", "closed", "Patient alleged delayed diagnosis of condition"),
        (pid_map["COMM-2024-004"], "CLM-2023-014", "2023-09-22", 8000, "general_liability", "closed", "Visitor tripped on uneven parking lot surface"),
        (pid_map["COMM-2024-015"], "CLM-2023-015", "2023-07-18", 12000, "professional_liability", "closed", "Patient alleged nerve damage during dental procedure"),
        (pid_map["COMM-2024-020"], "CLM-2023-016", "2023-11-05", 9500, "professional_liability", "closed", "Pet owner claimed misdiagnosis led to extended treatment"),

        # New claim types: product_liability, business_interruption, environmental
        (pid_map["COMM-2024-001"], "CLM-2023-017", "2023-04-22", 42000, "product_liability", "closed", "Defective manufactured component caused client equipment failure"),
        (pid_map["COMM-2024-009"], "CLM-2023-018", "2023-08-15", 18000, "product_liability", "closed", "Custom fabricated part failed under load at customer site"),
        (pid_map["COMM-2024-002"], "CLM-2023-019", "2023-06-30", 55000, "business_interruption", "closed", "Health department closure after kitchen fire, 3 weeks lost revenue"),
        (pid_map["COMM-2024-014"], "CLM-2023-020", "2023-09-01", 85000, "business_interruption", "closed", "Hurricane forced 2-week closure during peak season"),
        (pid_map["COMM-2024-019"], "CLM-2023-021", "2023-03-18", 32000, "environmental", "closed", "Chemical storage leak required EPA-supervised cleanup"),
        (pid_map["COMM-2024-013"], "CLM-2023-022", "2023-07-28", 28000, "property_damage", "closed", "Irrigation system failure flooded storage building"),

        # Cyber — trend data
        (pid_map["COMM-2024-012"], "CLM-2023-023", "2023-05-14", 45000, "cyber_breach", "closed", "Client suffered data exfiltration via phishing attack on managed endpoint"),
        (pid_map["COMM-2024-006"], "CLM-2023-024", "2023-11-20", 12000, "cyber_breach", "closed", "Internal code repository exposed to unauthorized access for 48 hours"),
    ]

    for cl in claims_2023:
        c.execute("INSERT OR IGNORE INTO claims (policy_id, claim_number, claim_date, claim_amount, claim_type, status, description) VALUES (?,?,?,?,?,?,?)", cl)
    conn.commit()
    print(f"[OK] Added {len(claims_2023)} claims from 2023 for trend analysis")

    # ========================================================================
    # PART H: ADD more guidelines (industry-specific, geographic, compliance)
    # ========================================================================
    # Using section codes 8.x.x to avoid conflict with existing 1.x.x-7.x.x
    new_guidelines = [
        ("8.1.1", "Construction Safety Audit", "Construction policies with 3 or more workers compensation claims in a rolling 12-month period require a third-party safety audit before renewal. Audit must cover workplace safety protocols, equipment maintenance, OSHA compliance, and employee training. Critical deficiencies trigger decline.", "industry_specific", "claim_count", 3, "review"),
        ("8.1.2", "Transportation Fleet Requirements", "Transportation accounts must maintain fleet safety score above 75. Accounts scoring below 60 are ineligible for standard programs and should be declined. Fleet scores between 60-75 require enhanced monitoring and mandatory driver safety training.", "industry_specific", "score", 75, "review"),
        ("8.2.1", "Coastal Hurricane Deductible", "All properties within 25 miles of Gulf or Atlantic coast in FL, TX, LA, NC, SC require minimum 2% hurricane deductible. Properties in FEMA VE zones require 5% wind deductible. No exceptions without CUO written approval.", "geographic", "percentage", 2, "review"),
        ("8.2.2", "Flood Zone Restrictions", "No new business in FEMA Zone V or VE without CUO written approval. Zone AE requires flood sublimit endorsement and current elevation certificate. Zone X500 requires notification to policyholder of residual flood risk.", "geographic", "general", None, "refer"),
        ("8.2.3", "Wildfire Risk Assessment", "Properties with wildfire risk score above 70 require defensible space inspection before binding. Score above 85 requires automatic decline for new business in California. Existing renewals with score above 85 require loss control visit and 25% rate surcharge.", "geographic", "score", 70, "review"),
        ("8.3.1", "Zone Concentration Limit", "Total insured value in any single CRESTA zone shall not exceed $7,000,000 without CUO approval. New business that would cause a zone to exceed this threshold must be referred. Existing breaches require quarterly monitoring and planned exposure reduction.", "concentration", "amount", 7000000, "refer"),
        ("8.3.2", "PML Accumulation Limit", "Probable Maximum Loss at 250-year return period shall not exceed $5,000,000 per CRESTA zone per reinsurance treaty terms. Breaches must be reported to reinsurance within 5 business days. New business in breached zones is suspended.", "concentration", "amount", 5000000, "refer"),
        ("8.4.1", "Credit Underwriting Standards", "Accounts with D&B commercial credit score below 40 require senior underwriter approval with documented rationale. Score below 30 triggers automatic decline. Declining credit trend over 2 consecutive quarters requires portfolio review note.", "financial", "credit_score", 40, "review"),
        ("8.4.2", "Under-Insurance Detection", "If replacement cost exceeds insured value by more than 25%, flag policy for insurance-to-value clause review and premium adjustment. Underwriter must document ITV discussion with broker. Policies with replacement cost ratio above 1.4 require mandatory co-insurance endorsement.", "financial", "percentage", 25, "review"),
        ("8.5.1", "Third-Party Data Requirements", "All new business and renewals with TIV exceeding $1,000,000 require current flood zone verification (less than 6 months old) and catastrophe model output. Properties in cat-exposed zones require full RMS model run. Data must be documented in policy file.", "compliance", "amount", 1000000, "review"),
        ("8.5.2", "NAIC AI Compliance", "All AI-assisted underwriting decisions must include: (1) data sources used, (2) guidelines cited, (3) confidence score, (4) recommendation rationale, (5) human reviewer identity. Per NAIC Model Bulletin Dec 2023, adopted by 23+ states. Non-compliance subject to regulatory examination finding.", "compliance", "general", None, "review"),
    ]

    for g in new_guidelines:
        c.execute("INSERT OR IGNORE INTO guidelines (section_code, title, content, category, threshold_type, threshold_value, action) VALUES (?,?,?,?,?,?,?)", g)
    conn.commit()
    print(f"[OK] Added {len(new_guidelines)} industry-specific, geographic, and compliance guidelines")

    # ========================================================================
    # SUMMARY
    # ========================================================================
    print("\n=== ENRICHMENT SUMMARY ===")
    for table in ["policies", "claims", "guidelines", "decisions", "zone_thresholds", "zone_accumulation", "data_sources"]:
        count = c.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        print(f"  {table}: {count} rows")

    # Claim year breakdown
    print("\nClaims by year:")
    for row in c.execute("SELECT substr(claim_date, 1, 4) as yr, COUNT(*), ROUND(SUM(claim_amount)) FROM claims GROUP BY yr ORDER BY yr").fetchall():
        print(f"  {row[0]}: {row[1]} claims, ${row[2]:,.0f}")

    # Zone breach check
    print("\nZone accumulation vs thresholds:")
    for row in c.execute("""
        SELECT za.zone_name, za.zone_id, za.total_tiv, za.policy_count, za.pml_250yr, za.avg_loss_ratio
        FROM zone_accumulation za ORDER BY za.total_tiv DESC
    """).fetchall():
        breach = " ** BREACH **" if row[2] > 7000000 else ""
        print(f"  {row[1]} ({row[0]}): TIV ${row[2]:,.0f}, {row[3]} policies, PML ${row[4]:,.0f}, LR {row[5]}%{breach}")

    conn.close()
    print("\n[DONE] SQLite enrichment complete.")


if __name__ == "__main__":
    run()
