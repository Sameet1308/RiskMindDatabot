# RiskMind - Project-Specific Tech Stack

## Document Information
| Property | Value |
|----------|-------|
| **Project** | RiskMind Underwriting Co-Pilot |
| **Platform** | Windows 10/11 |
| **Date** | February 2026 |

---

## 1. Development Environment

### Operating System
| OS | Version | Purpose |
|----|---------|---------|
| Windows | 10/11 Pro | Development |

### IDE & Tools
| Tool | Purpose | Required |
|------|---------|----------|
| Visual Studio Code | Primary IDE | ✅ Yes |
| Git | Version control | ✅ Yes |
| Postman | API testing | ✅ Yes |

### VS Code Extensions (Required)
| Extension | Purpose |
|-----------|---------|
| Python | Python language support |
| Pylance | Python IntelliSense |
| ESLint | JavaScript linting |
| Prettier | Code formatting |
| Tailwind CSS IntelliSense | Tailwind autocomplete |
| GitLens | Git visualization |

---

## 2. Runtime Requirements

| Software | Version | Download |
|----------|---------|----------|
| Node.js | 20+ | nodejs.org |
| Python | 3.11+ | python.org |
| Git | Latest | git-scm.com |

---

## 3. Frontend Stack (What We Use)

### Core Packages (package.json)
| Package | Version | Purpose |
|---------|---------|---------|
| react | 18.x | UI framework |
| react-dom | 18.x | DOM rendering |
| react-router-dom | 6.x | Page navigation |
| axios | 1.x | API calls |
| lucide-react | Latest | Icons |

### Build Tools
| Tool | Version | Purpose |
|------|---------|---------|
| vite | 5.x | Build tool & dev server |
| typescript | 5.x | Type safety |
| tailwindcss | 4.x | Styling |
| @vitejs/plugin-react | Latest | React plugin |

### Install Command
```bash
npm install react react-dom react-router-dom axios lucide-react
npm install -D vite typescript tailwindcss @vitejs/plugin-react
```

---

## 4. Backend Stack (What We Use)

### Core Packages (requirements.txt)
| Package | Version | Purpose |
|---------|---------|---------|
| fastapi | 0.109+ | REST API framework |
| uvicorn | 0.27+ | Web server |
| sqlalchemy | 2.x | Database ORM |
| pydantic | 2.x | Data validation |
| python-dotenv | 1.x | Environment config |
| aiosqlite | 0.19+ | SQLite driver (local) |
| asyncpg | 0.29+ | PostgreSQL driver (AWS) |
| httpx | 0.26+ | HTTP client |
| openai | 1.x | OpenAI SDK |
| boto3 | 1.34+ | AWS SDK (Bedrock) |

### Install Command
```bash
pip install fastapi uvicorn sqlalchemy pydantic python-dotenv
pip install aiosqlite asyncpg httpx openai boto3
```

---

## 5. Database

| Environment | Database | Purpose |
|-------------|----------|---------|
| Local Development | SQLite | Easy setup, no install |
| AWS Production | PostgreSQL (RDS) | Scalable, reliable |
| Vector Search | OpenSearch | RAG functionality |

---

## 6. AI/LLM (What We Use)

| Provider | Model | Purpose | When Used |
|----------|-------|---------|-----------|
| Mock | Rule-based | Local testing | Default |
| OpenAI | GPT-4o-mini | AI analysis | Dev/Test |
| AWS Bedrock | Claude 3 Haiku | AI analysis | Production |

### Required Packages
| Package | Purpose |
|---------|---------|
| openai | OpenAI API calls |
| boto3 | AWS Bedrock calls |

---

## 7. AWS Services (What We Need)

### Required Services
| Service | Purpose | Required |
|---------|---------|----------|
| **Amazon Bedrock** | LLM (Claude 3) | ✅ Yes |
| **Amazon RDS** | PostgreSQL database | ✅ Yes |
| **Amazon OpenSearch** | Vector search for RAG | ✅ Yes |
| **AWS App Runner** | Backend hosting | ✅ Yes |
| **AWS Amplify** | Frontend hosting | ✅ Yes |
| **Amazon S3** | File storage | ✅ Yes |
| **Amazon Cognito** | User authentication | ✅ Yes |
| **AWS Secrets Manager** | API keys storage | ✅ Yes |
| **Amazon CloudWatch** | Logs & monitoring | ✅ Yes |
| **AWS IAM** | Access management | ✅ Yes |

### Bedrock Models to Request (Priority Order)
| Priority | Model | Provider | Purpose |
|----------|-------|----------|---------|
| ⭐ HIGHEST | Claude 3.5 Sonnet | Anthropic | PRIMARY - Risk analysis |
| ⭐ HIGH | Claude 3 Haiku | Anthropic | Fast responses, chat |
| ⭐ HIGH | Titan Embeddings V2 | Amazon | Vector search (RAG) |
| MEDIUM | Claude 3 Opus | Anthropic | Complex analysis |

---

## 8. AWS Access Requirements

### Option A: Full Console Access (Recommended)
Developers get AWS Console login with ability to view and manage resources.

### Option B: Programmatic Access Only (Minimum)
IT Admin sets up resources, developers receive credentials to use in code.

---

### MINIMUM ACCESS REQUIRED (Must Have)

If IT cannot provide full console access, developers **MUST** receive these credentials:

| Credential | Format | Purpose |
|------------|--------|---------|
| **AWS Access Key ID** | `AKIA...` | API authentication |
| **AWS Secret Access Key** | `wJalr...` | API authentication |
| **AWS Region** | `us-east-1` | Service location |
| **RDS Connection String** | `postgresql://user:pass@host:5432/db` | Database access |
| **OpenSearch Endpoint** | `https://search-xxx.us-east-1.es.amazonaws.com` | RAG vector search |
| **Cognito User Pool ID** | `us-east-1_xxxxxx` | User authentication |
| **Cognito Client ID** | `xxxxxxx` | App authentication |
| **S3 Bucket Name** | `riskmind-documents` | File storage |

### Minimum IAM Permissions
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "bedrock:InvokeModel",
                "bedrock:InvokeModelWithResponseStream",
                "s3:GetObject",
                "s3:PutObject",
                "s3:ListBucket",
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            "Resource": "*"
        }
    ]
}
```

---

### GOOD TO HAVE (Recommended)

These console permissions make development faster:

| Service | Access Level | Why It Helps |
|---------|--------------|--------------|
| **Amazon Bedrock** | Full invoke | Test prompts in Playground |
| **Amazon CloudWatch** | Read logs | Debug production issues |
| **AWS App Runner** | View + Deploy | See deployment status |
| **AWS Amplify** | View + Deploy | See frontend builds |
| **Amazon RDS** | Read only | View database metrics |
| **Amazon S3** | Read + Write | Browse uploaded files |

### Good to Have IAM Policy
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "bedrock:*",
                "logs:*",
                "cloudwatch:*",
                "apprunner:*",
                "amplify:*",
                "s3:*",
                "secretsmanager:GetSecretValue",
                "rds:Describe*",
                "cognito-idp:*"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Deny",
            "Action": [
                "rds:DeleteDBInstance",
                "s3:DeleteBucket",
                "iam:*"
            ],
            "Resource": "*"
        }
    ]
}
```

---

## 9. Project Structure

```
RiskMind/
├── backend/
│   ├── venv/                 # Python virtual environment
│   ├── main.py               # FastAPI application
│   ├── requirements.txt      # Python dependencies
│   ├── .env                  # Environment variables
│   ├── database/             # DB connection
│   ├── models/               # SQLAlchemy models
│   ├── routers/              # API endpoints
│   └── services/             # AI service
│
├── frontend/
│   ├── node_modules/         # Node packages
│   ├── src/
│   │   ├── components/       # Layout, etc.
│   │   ├── pages/            # Dashboard, Chat, etc.
│   │   └── services/         # API client
│   ├── package.json          # Node dependencies
│   ├── vite.config.ts        # Vite config
│   └── tsconfig.json         # TypeScript config
│
└── docs/                     # Documentation
```

---

## 10. Environment Variables

### Backend (.env)
```env
# Database
DATABASE_URL=sqlite+aiosqlite:///./riskmind.db

# AI Provider (mock, openai, bedrock)
LLM_PROVIDER=mock

# OpenAI (for local dev)
OPENAI_API_KEY=sk-your-key-here

# AWS (for production)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
```

---

## 11. Quick Start Commands (Windows)

### Backend
```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
python seed_data.py
uvicorn main:app --reload
```

### Frontend
```powershell
cd frontend
npm install
npm run dev
```

---

## 12. Summary - What We Actually Use

| Category | Count | Details |
|----------|-------|---------|
| Frontend packages | 8 | React, Vite, Router, Axios, Tailwind, TypeScript, Lucide |
| Backend packages | 10 | FastAPI, SQLAlchemy, Pydantic, OpenAI, Boto3 |
| Databases | 3 | SQLite (local), PostgreSQL (prod), OpenSearch (RAG) |
| AWS Services | 10 | Bedrock, RDS, OpenSearch, App Runner, Amplify, S3, Cognito, Secrets, CloudWatch, IAM |
| **Total** | **~30** | Core technologies only |

---

## 13. Action Items for IT Team

1. ✅ Enable Amazon Bedrock in region (us-east-1)
2. ✅ Request access to Claude 3.5 Sonnet, Claude 3 Haiku, Titan Embeddings
3. ✅ Create RDS PostgreSQL instance
4. ✅ Create OpenSearch Service domain
5. ✅ Create Cognito user pool
6. ✅ Create S3 bucket for documents
7. ✅ Create IAM users with permissions above
8. ✅ Provide credentials to development team

---

*Document Version: 1.1 | Last Updated: February 2026*

