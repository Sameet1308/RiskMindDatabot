# Document 4: Shared Gmail + GitHub Setup Guide (Admin)

## RiskMind - Central Admin Setup

> **For the project lead/admin only.** This guide walks you through setting up the shared infrastructure.

---

## 1. Creating the Gmail Account

### Step-by-Step

1. Go to https://accounts.google.com/signup
2. Create account with project-specific email:
   - Suggested: `riskmind.hackathon@gmail.com`
3. Complete verification (phone number required)
4. **Enable 2FA immediately:**
   - Go to Security → 2-Step Verification
   - Set up authenticator app (Google Authenticator recommended)
5. Store credentials securely (password manager)

### Checklist
- [ ] Gmail account created
- [ ] 2FA enabled
- [ ] Recovery email/phone configured
- [ ] Credentials stored securely

---

## 2. GitHub Organization vs Personal Repo

### Recommendation: **GitHub Organization** ✅

| Factor | Org Account | Personal Repo |
|--------|-------------|---------------|
| Team management | ✅ Easier | ❌ Limited |
| Permission granularity | ✅ Fine-grained | ❌ Basic |
| Future scalability | ✅ Yes | ❌ No |
| Professional appearance | ✅ Yes | ❌ No |

### Create Organization

1. Go to https://github.com/settings/organizations
2. Click "New organization"
3. Choose **Free** plan
4. Name: `riskmind-hackathon` (or similar)
5. Set billing email to your new Gmail

---

## 3. Repository Setup

### Create the Repository

1. In your org, click "New repository"
2. Settings:
   - Name: `riskmind`
   - Private (recommended for hackathon)
   - Initialize with README
   - Add `.gitignore` → Python
   - License: MIT (or as required)

### Branch Protection Rules

1. Go to Settings → Branches → Add rule
2. Branch pattern: `main`
3. Enable:
   - [x] Require pull request before merging
   - [x] Require approvals (1 minimum)
   - [x] Dismiss stale PR approvals
   - [x] Require status checks (if CI configured)
   - [x] Include administrators

4. Repeat for `develop` branch (optional, less strict)

---

## 4. Security Settings

### Organization Level

1. Settings → Security → Authentication
   - [x] Require 2FA for all members
2. Settings → Member privileges
   - Base permissions: Read
   - Fork: Disabled

### Repository Level

1. Settings → Security
   - Enable Dependabot alerts
   - Enable secret scanning

---

## 5. Adding Collaborators

### Invite Team Members

1. Go to Organization → People → Invite member
2. Enter GitHub username
3. Assign role:
   - **Member**: Standard developer access
   - **Owner**: Admin access (limit to 1-2 people)

### Team Setup (Optional)

1. Create team: "Developers"
2. Add all devs to team
3. Grant team "Write" access to repo

---

## 6. Secrets Management (MVP)

### Approach: Environment Variables

```bash
# .env (NEVER COMMIT)
DATABASE_URL=sqlite:///./claims_data.db
SECRET_KEY=generate-random-key-here
```

```bash
# .env.example (COMMIT THIS)
DATABASE_URL=sqlite:///./claims_data.db
SECRET_KEY=your-secret-key-here
```

### .gitignore Must Include
```
.env
*.db
__pycache__/
node_modules/
```

---

## 7. Team Member Information to Collect

### Required from Each Developer

| Field | Required | Purpose |
|-------|----------|---------|
| **GitHub username** | ✅ Yes | Invite to repo |
| **Email (GitHub)** | Optional | Verification |
| **Full name** | ✅ Yes | Tracking |
| **Time zone** | Optional | Scheduling |
| **Can use Git?** | ✅ Yes | Verify setup |
| **IDE preference** | ✅ Yes | VS Code or Antigravity |
| **OS type** | ✅ Yes | Anticipate issues |

### Sample Collection Template

```
TEAM MEMBER ONBOARDING FORM

1. Full Name: _______________
2. GitHub Username: _______________
3. Email (optional): _______________
4. Time Zone: _______________
5. Operating System: [ ] Windows [ ] Mac [ ] Linux
6. IDE Preference: [ ] VS Code [ ] Antigravity [ ] Other
7. Git installed and working? [ ] Yes [ ] No
8. Comfortable with Git basics? [ ] Yes [ ] Need training
```

---

## 8. OAuth / Cloud Account Clarification

### For MVP: NO CLOUD ACCOUNTS NEEDED ✅

Basic GitHub collaboration requires:
- GitHub account (free)
- Git installed locally
- That's it!

### When Cloud Accounts Become Needed

Only if you integrate:

| Feature | What's Needed |
|---------|---------------|
| Cloud LLM (Azure OpenAI) | Azure subscription |
| AWS Bedrock | AWS account + IAM |
| Cloud deployment | AWS/GCP/Azure account |
| Cloud database | Managed DB service |

### If You Go Cloud Later

1. **Account Ownership**: Use organization account, not personal
2. **Service Accounts**: Create dedicated API credentials
3. **Secret Storage**: Use proper vault (AWS Secrets Manager, Azure Key Vault)
4. **Never commit**: API keys, tokens, credentials

---

## Quick Start Summary

### Day 1 Admin Tasks

- [ ] Create Gmail account with 2FA
- [ ] Create GitHub Organization
- [ ] Create `riskmind` repository
- [ ] Configure branch protection
- [ ] Collect team info
- [ ] Invite all team members
- [ ] Share onboarding docs

### Day 1 Developer Tasks

- [ ] Accept GitHub invite
- [ ] Clone repository
- [ ] Follow technical onboarding doc
- [ ] Confirm local setup works
- [ ] Create first test branch

---

> **You're all set!** Share the three onboarding docs with your team and you're ready to build. 🚀
