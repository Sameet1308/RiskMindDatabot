# RiskMind - Software & VM Requirements

## For Development Team

---

## 1. Virtual Machine Specification

### Recommended VM Specs (per developer)

| Spec | Minimum | Recommended |
|------|---------|-------------|
| **OS** | Windows 10/11 or Ubuntu 22.04 | Windows 11 |
| **CPU** | 4 cores | 8 cores |
| **RAM** | 8 GB | 16 GB |
| **Storage** | 50 GB SSD | 100 GB SSD |
| **Network** | Internet access | Internet + GitHub access |

### Shared Development Server (Optional)

| Spec | Configuration |
|------|---------------|
| **OS** | Ubuntu 22.04 LTS |
| **CPU** | 8 cores |
| **RAM** | 32 GB |
| **Storage** | 200 GB SSD |
| **Purpose** | Shared testing, staging environment |

---

## 2. Required Software

### Core Development Tools

| Software | Version | Purpose | Download |
|----------|---------|---------|----------|
| **Python** | 3.10+ | Backend development | https://python.org |
| **Node.js** | 18 LTS or 20 LTS | Frontend development | https://nodejs.org |
| **Git** | Latest | Version control | https://git-scm.com |
| **VS Code** | Latest | IDE | https://code.visualstudio.com |

### VS Code Extensions (Free)

| Extension | Publisher |
|-----------|-----------|
| Python | Microsoft |
| Pylance | Microsoft |
| ESLint | Microsoft |
| Prettier | Prettier |
| Tailwind CSS IntelliSense | Tailwind Labs |
| GitLens | GitKraken |

### Database Tools

| Software | Purpose | Download |
|----------|---------|----------|
| **PostgreSQL** | Local database (optional) | https://postgresql.org |
| **DBeaver** | Database GUI (free) | https://dbeaver.io |
| **SQLite Browser** | SQLite viewer | https://sqlitebrowser.org |

### API Testing

| Software | Purpose | Download |
|----------|---------|----------|
| **Postman** | API testing | https://postman.com |
| **Thunder Client** | VS Code extension (alternative) | VS Code Marketplace |

---

## 3. Cloud/Online Accounts Needed

| Account | Purpose | Cost |
|---------|---------|------|
| **GitHub** | Code repository | Free |
| **OpenAI Platform** | LLM API (for local dev) | ~$10 credits |
| **AWS Console** | Cloud deployment (when ready) | Provided by org |

---

## 4. Network/Firewall Requirements

### Required Access

| Resource | URL/Port | Purpose |
|----------|----------|---------|
| GitHub | github.com (443) | Code repository |
| npm Registry | registry.npmjs.org (443) | Frontend packages |
| PyPI | pypi.org (443) | Python packages |
| OpenAI API | api.openai.com (443) | LLM access |
| AWS Services | *.amazonaws.com (443) | Cloud deployment |

---

## 5. Python Packages (Backend)

```
fastapi==0.104.1
uvicorn==0.24.0
sqlalchemy==2.0.23
pydantic==2.5.0
python-dotenv==1.0.0
openai==1.3.0
httpx==0.25.0
python-multipart==0.0.6
```

---

## 6. Node.js Packages (Frontend)

```
react@18
vite@5
tailwindcss@3
axios
react-router-dom
```

---

## 7. Optional Tools

| Software | Purpose |
|----------|---------|
| **Docker Desktop** | Containerization (for AWS deployment) |
| **AWS CLI** | AWS command-line access |
| **Pandoc** | Document conversion |

---

## Quick Install Commands

### Windows (PowerShell as Admin)

```powershell
# Install Chocolatey (package manager)
Set-ExecutionPolicy Bypass -Scope Process -Force
iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))

# Install tools
choco install python nodejs git vscode postgresql dbeaver -y
```

### Ubuntu/Linux

```bash
# Update
sudo apt update && sudo apt upgrade -y

# Install tools
sudo apt install python3 python3-pip nodejs npm git postgresql -y

# Install VS Code
sudo snap install code --classic
```

---

## 8. AWS Account & Services Required

### AWS Account Access

| Requirement | Details |
|-------------|---------|
| **AWS Account** | Organization-provided account |
| **IAM User/Role** | Developer access with permissions below |
| **Region** | us-east-1 (recommended) |
| **Billing** | Estimated $50-150/month for demo |

### Required AWS Services

| Service | Purpose | Required Permissions |
|---------|---------|---------------------|
| **Amazon Bedrock** | LLM (Claude 3 / Llama) | bedrock:InvokeModel, bedrock:ListModels |
| **Amazon OpenSearch Serverless** | Vector DB for RAG | aoss:* |
| **App Runner** | Backend hosting | apprunner:* |
| **Amplify** | Frontend hosting | amplify:* |
| **RDS PostgreSQL** | Database | rds:* |
| **S3** | File storage + Guidelines PDFs | s3:* |
| **Secrets Manager** | API keys storage | secretsmanager:* |
| **IAM** | Roles & permissions | iam:PassRole |

### Bedrock Model Access (IMPORTANT)

> ⚠️ **Request model access immediately** — takes 24-48 hours for approval

| Model | Request In Console |
|-------|-------------------|
| Claude 3 Sonnet | Bedrock → Model access → Request |
| Claude 3 Haiku | Bedrock → Model access → Request |
| Llama 3 | Bedrock → Model access → Request |

### Estimated AWS Costs

| Service | Monthly Cost |
|---------|-------------|
| App Runner | $25 |
| RDS PostgreSQL (db.t3.micro) | $15 |
| Amplify | $5 |
| Bedrock (LLM usage) | $10-20 |
| OpenSearch Serverless (RAG) | $25 |
| S3 + Secrets Manager | $5 |
| **Total** | **$85-95/month** |

---

## Summary Checklist for IT Team

### VM & Software
- [ ] Provision VM with 8 cores, 16GB RAM, 100GB SSD
- [ ] Install Windows 11 or Ubuntu 22.04
- [ ] Install Python 3.10+
- [ ] Install Node.js 18+
- [ ] Install Git
- [ ] Install VS Code

### Network Access
- [ ] Allow access to GitHub (github.com)
- [ ] Allow access to npm (registry.npmjs.org)
- [ ] Allow access to PyPI (pypi.org)
- [ ] Allow access to OpenAI (api.openai.com)
- [ ] Allow access to AWS (*.amazonaws.com)

### AWS Account & Services
- [ ] Provide AWS Console access
- [ ] Enable Amazon Bedrock
- [ ] Enable Amazon OpenSearch Serverless (for RAG)
- [ ] Enable AWS App Runner
- [ ] Enable AWS Amplify
- [ ] Enable Amazon RDS
- [ ] Enable Amazon S3
- [ ] Enable AWS Secrets Manager
- [ ] Request Bedrock model access (Claude 3 / Llama 3)
- [ ] Approve estimated budget: $85-95/month
