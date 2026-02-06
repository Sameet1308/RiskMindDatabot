# Document 3: Insurance Domain Primer (Underwriting-Focused)

## RiskMind - Understanding the Business

> **Purpose:** Helps developers understand insurance so you can build features that make sense to underwriters.

---

## 1. Who is an Underwriter?

An **underwriter** evaluates insurance applications and decides:
- Should we insure this risk?
- At what price (premium)?
- Under what conditions?

### Day-to-Day Responsibilities

| Task | Description |
|------|-------------|
| **Evaluate Applications** | Review submissions for risk quality |
| **Analyze Claims History** | Look at past claims to predict future losses |
| **Apply Guidelines** | Follow company rules for consistency |
| **Price the Risk** | Determine premium based on risk level |
| **Approve or Decline** | Final coverage decision |
| **Refer Complex Cases** | Escalate to senior underwriters when needed |

---

## 2. Risk Assessment Basics

### What Underwriters Analyze

- **Claims History** - Past losses, frequency, severity, trends
- **Industry Type** - Restaurant, manufacturing, construction
- **Operations** - Employees, revenue, locations, safety record
- **Loss Drivers** - What causes claims? Can they be controlled?
- **Exposures** - Payroll, sales, square feet, vehicle count

### Claims History Analysis

#### Frequency (How Often?)
```
Account A: 12 claims in 3 years → HIGH frequency (red flag)
Account B: 2 claims in 3 years  → LOW frequency (good sign)
```

#### Severity (How Expensive?)
```
Account A: Average claim = $5,000   → LOW severity
Account B: Average claim = $500,000 → HIGH severity
```

#### Frequency + Severity Matrix

| | Low Severity | High Severity |
|---|---|---|
| **Low Frequency** | ✅ Best risk | ⚠️ Needs review |
| **High Frequency** | ⚠️ Operational issue | ❌ Poor risk |

---

## 3. Underwriting Guidelines

**Guidelines** are company rules for:
- What risks to accept or decline
- How to price different risk types
- When to refer decisions to a manager

### Example Guideline Rule
```
RULE 3.2.1: High-Value Properties
IF property value > $10,000,000
THEN require: Fire sprinkler AND 24-hour security
```

### Types of Guidelines

| Type | Purpose | Example |
|------|---------|---------|
| **Appetite** | What we want to write | "Target restaurants <$5M revenue" |
| **Eligibility** | Minimum requirements | "Must have 3+ years in business" |
| **Referral** | When to escalate | "Claims >$100K require approval" |

---

## 4. What "Refer to Manager" Means

Certain situations require escalation to a senior underwriter.

### Common Referral Triggers

| Trigger | Threshold Example |
|---------|-------------------|
| Large claim severity | Any claim > $100,000 |
| High claim frequency | More than 3 claims/year |
| Large premium | Policy premium > $500,000 |
| High-hazard industry | Bars, fireworks |
| Significant losses | Loss ratio > 80% |

---

## 5. How RiskMind Helps

### The "Glass Box" Approach

**Glass Box = Transparency + Explainability**

RiskMind shows its work:

```
┌─────────────────────────────────────────────┐
│  ⚠️  REFER TO SENIOR UNDERWRITER           │
│  Reason: High severity claim pattern        │
├─────────────────────────────────────────────┤
│  📊 SQL QUERY:                              │
│  SELECT claim_id, amount FROM claims        │
│  WHERE policy_id = 'COMM-001'               │
├─────────────────────────────────────────────┤
│  📖 GUIDELINE: Section 4.3.2               │
│  "2+ claims exceeding $75K require         │
│  senior underwriter review"                 │
└─────────────────────────────────────────────┘
```

---

## 6. Glossary

### Essential Terms

| Term | Definition |
|------|------------|
| **Premium** | Price paid for insurance coverage |
| **Claim** | Request for payment when loss occurs |
| **Limit** | Maximum insurer will pay |
| **Deductible** | Amount insured pays first |
| **Loss Ratio** | Losses ÷ Premium × 100 |

### Risk Metrics

| Term | Definition |
|------|------------|
| **Frequency** | How often claims occur |
| **Severity** | Average cost per claim |
| **Experience Mod** | Adjustment based on claims history |

### Coverage Terms

| Term | Definition |
|------|------------|
| **Endorsement** | Modification to policy language |
| **Exclusion** | What policy does NOT cover |

---

> **Remember:** RiskMind helps humans make better decisions—it doesn't replace judgment. 🎯
