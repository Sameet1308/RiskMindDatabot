# Document 2: Git Workflow, Branching Rules, and Team Operating Model

## RiskMind - Team Collaboration Guide

> **Purpose:** This document establishes how we work together using Git and GitHub. Following these practices ensures smooth collaboration and protects our demo-ready codebase.

---

## 1. GitHub Workflow Overview

### The Development Cycle

```
┌─────────────────────────────────────────────────────────────────────┐
│                     GIT WORKFLOW OVERVIEW                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. CLONE          2. BRANCH         3. CODE          4. COMMIT     │
│  ─────────────────────────────────────────────────────────────────  │
│  git clone         git checkout      (make changes)   git add .     │
│  <repo-url>        -b feature/...                     git commit    │
│                                                                      │
│  5. PUSH           6. PR             7. REVIEW        8. MERGE      │
│  ─────────────────────────────────────────────────────────────────  │
│  git push          Open Pull         Team reviews     Approved PR   │
│  origin feature/   Request on        code changes     merged to     │
│  ...               GitHub                             develop/main  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Step-by-Step Daily Workflow

#### 1. Clone the Repository (First Time Only)
```bash
git clone https://github.com/YOUR_ORG/riskmind.git
cd riskmind
```

#### 2. Create a Feature Branch
```bash
# Always start from the latest code
git checkout develop
git pull origin develop

# Create your feature branch
git checkout -b feature/your-name-short-description
```

#### 3. Make Your Changes
- Write code
- Test locally
- Commit frequently (see commit guidelines below)

#### 4. Commit Your Work
```bash
git add .
git commit -m "feat: add claims history API endpoint"
```

#### 5. Push to GitHub
```bash
git push origin feature/your-name-short-description
```

#### 6. Open a Pull Request
1. Go to the repository on GitHub
2. Click "Compare & pull request"
3. Fill out the PR template (see below)
4. Request reviewers
5. Link any related issues

#### 7. Address Review Feedback
```bash
# Make requested changes
git add .
git commit -m "fix: address PR feedback"
git push origin feature/your-name-short-description
```

#### 8. Merge (After Approval)
- Reviewer or maintainer merges the PR
- Delete your feature branch after merge

---

## 2. Branching Strategy

### Branch Hierarchy

```
main (protected, production-ready)
 │
 └── develop (integration branch)
      │
      ├── feature/priya-claims-api
      ├── feature/ravi-glass-box-ui
      ├── feature/sara-rag-service
      └── bugfix/john-fix-sql-injection
```

### Branch Types

| Branch | Purpose | Who Can Push | Merges To |
|--------|---------|--------------|-----------|
| `main` | Production-ready code | No one (protected) | — |
| `develop` | Integration testing | Via PR only | `main` |
| `feature/*` | New features | Developer | `develop` |
| `bugfix/*` | Bug fixes | Developer | `develop` |
| `hotfix/*` | Urgent production fixes | Tech Lead | `main` + `develop` |

### Branch Naming Convention

```
<type>/<your-name>-<short-description>
```

#### Examples

| Good ✅ | Bad ❌ |
|---------|--------|
| `feature/priya-claims-endpoint` | `feature1` |
| `feature/ravi-glass-box-ui` | `my-branch` |
| `bugfix/sara-fix-null-error` | `bugfix` |
| `feature/john-rag-integration` | `feature/john` |

### Quick Reference

```bash
# Create feature branch
git checkout -b feature/your-name-feature-desc

# Create bugfix branch
git checkout -b bugfix/your-name-issue-desc

# List all branches
git branch -a

# Switch branches
git checkout develop
```

---

## 3. Pull Request Rules

### Before Opening a PR

#### Self-Review Checklist

- [ ] **Code Works:** Tested all changes locally
- [ ] **Backend Runs:** `uvicorn main:app --reload` starts without errors
- [ ] **Frontend Runs:** `npm run dev` starts without errors
- [ ] **No Console Errors:** Browser console is clean
- [ ] **Linting Passed:** No ESLint or flake8 errors
- [ ] **Demo Tested:** Ran through the demo flow
- [ ] **No Secrets:** No API keys, passwords, or tokens in code
- [ ] **Branch Updated:** Merged latest `develop` into your branch

```bash
# Update your branch with latest develop
git checkout develop
git pull origin develop
git checkout feature/your-branch
git merge develop
# Resolve any conflicts, then push
```

### PR Template

When opening a PR, use this format:

```markdown
## Summary
Brief description of what this PR does.

## Type of Change
- [ ] New feature
- [ ] Bug fix
- [ ] Documentation update
- [ ] Refactoring

## Changes Made
- Added X endpoint
- Updated Y component
- Fixed Z issue

## Testing Done
- [ ] Tested locally
- [ ] Demo flow works
- [ ] No console errors

## Screenshots (if UI changes)
[Attach screenshots here]

## Related Issues
Closes #123
```

### Reviewer Expectations

| Reviewer Role | Responsibility |
|---------------|----------------|
| **Code Owner** | Final approval, merge authority |
| **Peer Reviewer** | Code quality, logic verification |
| **Tech Lead** | Architecture, security review |

#### What Reviewers Check

1. **Functionality:** Does the code do what it claims?
2. **Code Quality:** Is it readable and maintainable?
3. **Security:** Any hardcoded secrets or vulnerabilities?
4. **Performance:** Any obvious inefficiencies?
5. **Demo Impact:** Could this break the demo?

---

## 4. Commit Message Guidelines

### Format

```
<type>: <short description>

[optional body]

[optional footer]
```

### Types

| Type | When to Use |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, no code logic change |
| `refactor` | Code restructuring, no feature change |
| `test` | Adding or fixing tests |
| `chore` | Build, config, dependencies |

### Examples

```bash
# Good commits ✅
git commit -m "feat: add claims history endpoint"
git commit -m "fix: resolve null pointer in SQL query builder"
git commit -m "docs: update README with setup instructions"
git commit -m "refactor: extract Glass Box logic to separate component"
git commit -m "chore: update FastAPI to 0.104.0"

# Bad commits ❌
git commit -m "fixed stuff"
git commit -m "WIP"
git commit -m "asdf"
git commit -m "changes"
```

### Commit Best Practices

- [ ] **Commit often:** Small, logical chunks
- [ ] **One thing per commit:** Don't mix features and bugfixes
- [ ] **Present tense:** "add feature" not "added feature"
- [ ] **Be specific:** "fix null check in claims parser" not "fix bug"

---

## 5. Issue Tracking

### Using GitHub Issues

We use GitHub Issues for task tracking. Each developer should:

1. **Check assigned issues** at the start of each work session
2. **Create issues** for bugs or feature ideas
3. **Link PRs to issues** using keywords

### Issue Labels

| Label | Meaning |
|-------|---------|
| `feature` | New functionality |
| `bug` | Something is broken |
| `enhancement` | Improvement to existing feature |
| `documentation` | Docs update needed |
| `priority: high` | Needs immediate attention |
| `priority: low` | Nice to have |
| `in-progress` | Currently being worked on |

### Linking PRs to Issues

Use these keywords in PR descriptions to auto-close issues:

```markdown
Closes #123
Fixes #456
Resolves #789
```

---

## 6. Access Control

### Permission Levels

| Role | Permissions |
|------|-------------|
| **Admin** (Project Lead) | Full access, branch protection, settings |
| **Maintainer** (Tech Lead) | Merge PRs, manage issues |
| **Developer** | Push branches, create PRs |
| **Read-Only** (Observers) | View code, comment on PRs |

### Who Can Do What

| Action | Developer | Maintainer | Admin |
|--------|-----------|------------|-------|
| Create branches | ✅ | ✅ | ✅ |
| Push to feature branches | ✅ | ✅ | ✅ |
| Push to `develop` | ❌ | ✅ (via PR) | ✅ |
| Push to `main` | ❌ | ❌ | ✅ (via PR) |
| Approve PRs | ❌ | ✅ | ✅ |
| Merge PRs to develop | ❌ | ✅ | ✅ |
| Merge PRs to main | ❌ | ❌ | ✅ |

### Secrets Management

> **⚠️ CRITICAL: Never commit secrets to the repository!**

#### What Counts as a Secret?

- API keys
- Database passwords
- JWT secrets
- Third-party service credentials
- Any token or key that grants access

#### How to Handle Secrets

1. **Use `.env` files** for local development
2. **Add `.env` to `.gitignore`** (already done)
3. **Create `.env.example`** with placeholder values
4. **Never hardcode** secrets in source code

```bash
# .env (NEVER COMMIT)
DATABASE_URL=sqlite:///./claims_data.db
SECRET_KEY=your-secret-key-here
API_KEY=sk-abc123...

# .env.example (SAFE TO COMMIT)
DATABASE_URL=sqlite:///./claims_data.db
SECRET_KEY=your-secret-key-here
API_KEY=your-api-key-here
```

#### If You Accidentally Commit a Secret

1. **Immediately notify the team lead**
2. **Rotate the compromised credential**
3. Use `git filter-branch` or BFG Repo-Cleaner to remove from history
4. Force push the cleaned history (requires admin)

---

## Quick Reference Card

```bash
# Daily workflow
git checkout develop && git pull
git checkout -b feature/name-description
# ... code ...
git add . && git commit -m "feat: description"
git push origin feature/name-description
# Open PR on GitHub

# Sync with develop
git checkout develop && git pull
git checkout feature/your-branch
git merge develop

# Undo last commit (keep changes)
git reset --soft HEAD~1

# See branch history
git log --oneline -10

# Check status
git status
```

---

## Common Issues & Solutions

| Problem | Solution |
|---------|----------|
| "Permission denied" on push | Check you're on a feature branch, not `main` |
| Merge conflicts | Pull latest `develop`, resolve conflicts locally |
| Accidentally committed to `main` | Reset and create proper branch |
| Need to undo a commit | `git reset --soft HEAD~1` |
| PR won't merge | Ensure all checks pass and approval received |

---

> **Remember:** Git is our safety net. Commit often, push daily, and always work on feature branches. When in doubt, ask! 🤝
