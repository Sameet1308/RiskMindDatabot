# RiskMind Team GitHub Guide
## How to Work With Our Repository

---

## Repository Information

**Repository URL:** https://github.com/Sameet1308/RiskMindDatabot.git

**Clone Command:**
```
git clone https://github.com/Sameet1308/RiskMindDatabot.git
```

---

## Golden Rules

1. **NEVER push directly to `main` branch**
2. **Always work on your own feature branch**
3. **Create a Pull Request for code review before merging**
4. **Pull latest changes before starting new work**

---

## Initial Setup (One-Time)

### Step 1: Accept the Repository Invite
- Check your email for GitHub invitation
- Click "Accept invitation"

### Step 2: Clone the Repository
Open your terminal/command prompt and run:
```
git clone https://github.com/Sameet1308/RiskMindDatabot.git
cd RiskMindDatabot
```

### Step 3: Verify Setup
```
git status
git remote -v
```
You should see `origin` pointing to our repository.

---

## Daily Workflow

### Starting New Work

**Step 1: Get Latest Code**
```
git checkout main
git pull origin main
```

**Step 2: Create Your Feature Branch**
```
git checkout -b feature/your-name-task-description
```

Example:
```
git checkout -b feature/priya-add-claims-api
git checkout -b feature/ravi-fix-login-bug
```

---

### Making Changes

**Step 1: Write Your Code**
- Make your changes in VS Code or your IDE
- Save your files

**Step 2: Check What Changed**
```
git status
```

**Step 3: Stage Your Changes**
```
git add .
```

**Step 4: Commit Your Changes**
```
git commit -m "feat: add claims history endpoint"
```

Good commit message examples:
- `feat: add new feature`
- `fix: resolve bug in login`
- `docs: update README`

---

### Pushing Your Changes

**Step 1: Push to Your Branch**
```
git push origin feature/your-name-task-description
```

Example:
```
git push origin feature/priya-add-claims-api
```

---

## Creating a Pull Request (PR)

### Step 1: Go to GitHub
Open: https://github.com/Sameet1308/RiskMindDatabot

### Step 2: Create Pull Request
- Click "Compare & pull request" button (appears after you push)
- Or go to "Pull requests" tab → "New pull request"

### Step 3: Fill Out PR Details
- **Title:** Brief description of your changes
- **Description:** What you changed and why
- **Reviewers:** Add team lead or peer

### Step 4: Wait for Review
- Reviewer will check your code
- Address any feedback by making more commits
- Once approved, the reviewer will merge

---

## After Your PR is Merged

### Step 1: Switch Back to Main
```
git checkout main
```

### Step 2: Get Latest Code (Including Your Merged Changes)
```
git pull origin main
```

### Step 3: Delete Your Old Branch (Optional)
```
git branch -d feature/your-name-task-description
```

---

## Common Commands Reference

| Task | Command |
|------|---------|
| Clone repo | `git clone https://github.com/Sameet1308/RiskMindDatabot.git` |
| Check status | `git status` |
| Get latest main | `git checkout main` then `git pull origin main` |
| Create branch | `git checkout -b feature/your-name-desc` |
| Stage changes | `git add .` |
| Commit | `git commit -m "your message"` |
| Push branch | `git push origin feature/your-name-desc` |
| Switch branches | `git checkout branch-name` |
| See all branches | `git branch -a` |

---

## Troubleshooting

### "I accidentally committed to main"
```
git reset --soft HEAD~1
git checkout -b feature/your-name-desc
git add .
git commit -m "your message"
git push origin feature/your-name-desc
```

### "I need to update my branch with latest main"
```
git checkout main
git pull origin main
git checkout feature/your-branch
git merge main
```

### "I have merge conflicts"
1. Open the conflicting files
2. Look for `<<<<<<<` and `>>>>>>>` markers
3. Edit to keep the correct code
4. Remove the conflict markers
5. Save, then:
```
git add .
git commit -m "fix: resolve merge conflicts"
```

---

## Need Help?

- Check the docs folder in the repo
- Ask in the team chat
- Tag your question in GitHub Issues

---

**Repository:** https://github.com/Sameet1308/RiskMindDatabot
