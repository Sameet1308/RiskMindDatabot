"""Generate a realistic insurance inspection report PDF for testing upload + ChromaDB indexing."""
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
import os

OUTPUT = os.path.join(os.path.dirname(__file__), "Eagle_Transport_Inspection_Report_2024.pdf")

def build():
    doc = SimpleDocTemplate(OUTPUT, pagesize=letter, topMargin=0.75*inch, bottomMargin=0.75*inch)
    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle("Title2", parent=styles["Title"], fontSize=18, textColor=HexColor("#1a1a2e"), spaceAfter=6)
    subtitle_style = ParagraphStyle("Sub", parent=styles["Normal"], fontSize=11, textColor=HexColor("#555"), spaceAfter=14)
    heading_style = ParagraphStyle("H2", parent=styles["Heading2"], fontSize=13, textColor=HexColor("#FF5A5F"), spaceBefore=14, spaceAfter=6)
    body_style = ParagraphStyle("Body", parent=styles["Normal"], fontSize=10, leading=14, spaceAfter=8)
    bold_style = ParagraphStyle("Bold", parent=body_style, fontName="Helvetica-Bold")
    small_style = ParagraphStyle("Small", parent=styles["Normal"], fontSize=8, textColor=HexColor("#888"))

    story = []

    # Header
    story.append(Paragraph("COMMERCIAL PROPERTY & FLEET INSPECTION REPORT", title_style))
    story.append(Paragraph("Prepared for: LTM Insurance Group | Confidential", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1, color=HexColor("#FF5A5F")))
    story.append(Spacer(1, 12))

    # Policy info table
    info_data = [
        ["Policy Number:", "COMM-2024-016", "Inspection Date:", "November 12, 2024"],
        ["Policyholder:", "Eagle Transport Co", "Inspector:", "Robert J. Martinez, CPCU"],
        ["Industry:", "Transportation / Freight", "Location:", "4200 W. Diversey Ave, Chicago, IL 60639"],
        ["Premium:", "$48,000", "Policy Period:", "Jun 15, 2024 - Jun 15, 2025"],
        ["Risk Classification:", "HIGH RISK", "Claims Count:", "5 (YTD)"],
    ]
    info_table = Table(info_data, colWidths=[1.3*inch, 2.2*inch, 1.3*inch, 2.5*inch])
    info_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (1, 4), (1, 4), HexColor("#dc2626")),
        ("FONTNAME", (1, 4), (1, 4), "Helvetica-Bold"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BACKGROUND", (0, 0), (-1, 0), HexColor("#f8f9fa")),
        ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#e0e0e0")),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 16))

    # Executive Summary
    story.append(Paragraph("1. EXECUTIVE SUMMARY", heading_style))
    story.append(Paragraph(
        "Eagle Transport Co operates a fleet of 23 commercial vehicles (18 Class 8 tractor-trailers, "
        "3 box trucks, 2 flatbeds) servicing Midwest freight corridors. This inspection was triggered by "
        "the policy's escalating claim frequency: <b>5 claims filed in the current policy year</b>, totaling "
        "<b>$76,000 in losses</b> against a $48,000 premium, yielding a <b>loss ratio of 158.3%</b>.",
        body_style
    ))
    story.append(Paragraph(
        "The inspection reveals <b>systemic fleet maintenance deficiencies</b>, inadequate driver training "
        "protocols, and <b>non-compliance with DOT Hours-of-Service regulations</b>. The overall risk "
        "profile has deteriorated significantly since the last review (March 2024).",
        body_style
    ))

    # Claims History
    story.append(Paragraph("2. CLAIMS HISTORY (CURRENT POLICY YEAR)", heading_style))
    claims_data = [
        ["Claim #", "Date", "Type", "Amount", "Status", "Description"],
        ["CLM-2024-040", "Feb 8, 2024", "Auto Accident", "$18,000", "Closed", "Truck rollover on I-94; driver fatigue cited"],
        ["CLM-2024-041", "Apr 15, 2024", "Auto Accident", "$12,000", "Closed", "Rear-end collision at I-290 interchange"],
        ["CLM-2024-042", "Jun 28, 2024", "Auto Accident", "$9,000", "Closed", "Side-swipe on delivery route, W. Fullerton Ave"],
        ["CLM-2024-043", "Sep 5, 2024", "Auto Accident", "$22,000", "Open", "Multi-vehicle highway incident on I-55"],
        ["CLM-2024-044", "Nov 18, 2024", "Property Damage", "$15,000", "Open", "Cargo spill at loading dock, hazmat cleanup"],
    ]
    claims_table = Table(claims_data, colWidths=[1*inch, 0.85*inch, 0.95*inch, 0.7*inch, 0.6*inch, 2.9*inch])
    claims_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("BACKGROUND", (0, 0), (-1, 0), HexColor("#1a1a2e")),
        ("TEXTCOLOR", (0, 0), (-1, 0), HexColor("#ffffff")),
        ("BACKGROUND", (0, 1), (-1, -1), HexColor("#fff")),
        ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#d0d0d0")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [HexColor("#ffffff"), HexColor("#f8f9fa")]),
    ]))
    story.append(claims_table)
    story.append(Spacer(1, 6))
    story.append(Paragraph("<b>Total Incurred Loss:</b> $76,000 | <b>Loss Ratio:</b> 158.3% | <b>Frequency:</b> 5 claims/year (industry avg: 1.2)", bold_style))

    # Inspection Findings
    story.append(Paragraph("3. INSPECTION FINDINGS", heading_style))

    story.append(Paragraph("<b>3.1 Fleet Condition Assessment</b>", bold_style))
    story.append(Paragraph(
        "Physical inspection of 14 of 23 vehicles revealed: <b>4 vehicles with worn brake pads below DOT minimum "
        "thickness (3/32\")</b>, 2 vehicles with cracked windshields impairing driver visibility, 3 vehicles with "
        "non-functional turn signals or tail lights, and <b>1 vehicle (Unit #T-017) with a visibly leaking hydraulic "
        "brake line</b> that poses an immediate safety hazard. Unit T-017 was red-tagged and removed from service.",
        body_style
    ))

    story.append(Paragraph("<b>3.2 Driver Records Review</b>", bold_style))
    story.append(Paragraph(
        "Review of driver records for 15 active CDL holders revealed: <b>3 drivers with suspended CDL endorsements</b> "
        "(still operating vehicles), 2 drivers with 3+ moving violations in the past 24 months, and <b>ELD (Electronic "
        "Logging Device) data showing 7 Hours-of-Service violations in the past 90 days</b>. Driver involved in "
        "CLM-2024-040 (rollover) had logged 14.5 consecutive driving hours, exceeding the federal 11-hour limit.",
        body_style
    ))

    story.append(Paragraph("<b>3.3 Facility & Cargo Handling</b>", bold_style))
    story.append(Paragraph(
        "The Chicago depot at 4200 W. Diversey Ave shows signs of deferred maintenance: loading dock #3 has a "
        "damaged hydraulic lift (contributing to CLM-2024-044 cargo spill), inadequate spill containment for "
        "hazardous materials, and no functioning security cameras on the south lot where 8 vehicles are parked overnight. "
        "Fire extinguishers in the maintenance bay were last inspected in January 2023 (17 months overdue).",
        body_style
    ))

    story.append(Paragraph("<b>3.4 Safety Program Evaluation</b>", bold_style))
    story.append(Paragraph(
        "Eagle Transport's safety program is rated <b>BELOW STANDARD</b>. The company lacks: a formal pre-trip "
        "inspection checklist (relying on verbal driver confirmation), scheduled preventive maintenance program "
        "(maintenance is reactive only), <b>no documented driver training program for defensive driving or cargo "
        "securement</b>, and no accident review board or root cause analysis process for the 5 incidents this year.",
        body_style
    ))

    # Risk Assessment
    story.append(Paragraph("4. RISK ASSESSMENT MATRIX", heading_style))
    risk_data = [
        ["Risk Factor", "Rating", "Score", "Notes"],
        ["Fleet Maintenance", "CRITICAL", "9/10", "4 vehicles below DOT brake standards; 1 red-tagged"],
        ["Driver Compliance", "HIGH", "8/10", "3 suspended CDLs operating; HOS violations"],
        ["Claims Frequency", "CRITICAL", "9/10", "5 claims in 11 months; 4x industry average"],
        ["Loss Ratio", "CRITICAL", "10/10", "158.3% - significantly above 80% threshold"],
        ["Safety Program", "HIGH", "7/10", "No formal training, no PM program, no accident review"],
        ["Facility Condition", "MODERATE", "5/10", "Deferred maintenance, expired fire equipment"],
        ["Cargo Handling", "HIGH", "7/10", "Damaged dock lift, inadequate hazmat containment"],
    ]
    risk_table = Table(risk_data, colWidths=[1.5*inch, 1*inch, 0.7*inch, 3.8*inch])
    risk_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("BACKGROUND", (0, 0), (-1, 0), HexColor("#1a1a2e")),
        ("TEXTCOLOR", (0, 0), (-1, 0), HexColor("#ffffff")),
        ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#d0d0d0")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("TEXTCOLOR", (1, 1), (1, 1), HexColor("#dc2626")),
        ("TEXTCOLOR", (1, 3), (1, 3), HexColor("#dc2626")),
        ("TEXTCOLOR", (1, 4), (1, 4), HexColor("#dc2626")),
        ("TEXTCOLOR", (1, 2), (1, 2), HexColor("#ea580c")),
        ("TEXTCOLOR", (1, 5), (1, 5), HexColor("#ea580c")),
        ("TEXTCOLOR", (1, 7), (1, 7), HexColor("#ea580c")),
        ("TEXTCOLOR", (1, 6), (1, 6), HexColor("#d97706")),
        ("FONTNAME", (1, 1), (1, -1), "Helvetica-Bold"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [HexColor("#ffffff"), HexColor("#f8f9fa")]),
    ]))
    story.append(risk_table)
    story.append(Spacer(1, 6))
    story.append(Paragraph("<b>Composite Risk Score: 55/70 (78.6%) - HIGH RISK</b>", bold_style))

    # Recommendations
    story.append(Paragraph("5. UNDERWRITING RECOMMENDATIONS", heading_style))
    story.append(Paragraph(
        "<b>Primary Recommendation: DECLINE RENEWAL</b> unless Eagle Transport demonstrates compliance with "
        "all corrective actions within 60 days. The 158.3% loss ratio, systemic maintenance failures, and "
        "driver compliance issues present an unacceptable risk profile.",
        body_style
    ))
    story.append(Paragraph("<b>If renewal is considered, mandate the following:</b>", bold_style))

    conditions = [
        "1. Immediate repair of all DOT-deficient vehicles and proof of compliance inspection within 30 days",
        "2. Suspension of 3 drivers with CDL issues until endorsements are reinstated and verified",
        "3. Implementation of a documented preventive maintenance program with quarterly audits",
        "4. Enrollment of all drivers in a certified defensive driving course within 60 days",
        "5. Installation of forward-facing dashcams on all 23 vehicles within 90 days",
        "6. Premium surcharge of minimum 35% ($16,800) to $64,800 reflecting current risk exposure",
        "7. Increased deductible from $5,000 to $15,000 per occurrence",
        "8. Quarterly loss control reviews for the first renewal year",
    ]
    for c in conditions:
        story.append(Paragraph(c, body_style))

    # Signature
    story.append(Spacer(1, 24))
    story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor("#ccc")))
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        "<b>Inspector:</b> Robert J. Martinez, CPCU, ARM | <b>License:</b> IL-INS-2847 | "
        "<b>Date:</b> November 12, 2024",
        body_style
    ))
    story.append(Paragraph(
        "<b>Reviewed by:</b> Sarah Mitchell, Senior Underwriter, LTM Insurance Group",
        body_style
    ))
    story.append(Spacer(1, 6))
    story.append(Paragraph("CONFIDENTIAL - For internal underwriting use only. Not for distribution.", small_style))

    doc.build(story)
    print(f"PDF generated: {OUTPUT}")

if __name__ == "__main__":
    build()
