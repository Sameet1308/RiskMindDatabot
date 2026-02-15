# RiskMind - Complete Tools & Technology Stack

## Document Information
| Property | Value |
|----------|-------|
| **Project** | RiskMind Underwriting Co-Pilot |
| **Version** | 1.0 |
| **Date** | February 2026 |
| **Classification** | Technical Specification |

---

## 1. Executive Summary

This document provides a **complete and comprehensive list** of all tools, technologies, frameworks, libraries, and services required to develop, deploy, and maintain the RiskMind Underwriting Co-Pilot platform. This AI-powered application requires a modern full-stack architecture with cloud-native services.

---

## 2. Development Environment

### 2.1 Operating Systems (Supported)
| OS | Version | Purpose |
|----|---------|---------|
| Windows | 10/11 Pro/Enterprise | Primary development |
| macOS | 13+ (Ventura/Sonoma) | Development |
| Ubuntu Linux | 22.04 LTS | Server/Development |
| Amazon Linux | 2023 | AWS deployment |

### 2.2 Integrated Development Environment (IDE)
| Tool | Version | Purpose | License |
|------|---------|---------|---------|
| Visual Studio Code | Latest | Primary IDE | Free |
| VS Code Extensions | Various | Productivity | Free |
| PyCharm Professional | 2024.x | Python development | Paid |
| WebStorm | 2024.x | Frontend development | Paid |
| DataGrip | 2024.x | Database management | Paid |
| Postman | Latest | API testing | Free/Paid |
| Insomnia | Latest | API testing (alternative) | Free |

### 2.3 VS Code Required Extensions
| Extension | Purpose |
|-----------|---------|
| Python | Python language support |
| Pylance | Python IntelliSense |
| ESLint | JavaScript linting |
| Prettier | Code formatting |
| TypeScript and JavaScript | TS support |
| Tailwind CSS IntelliSense | Tailwind autocomplete |
| GitLens | Git visualization |
| Docker | Container support |
| REST Client | API testing |
| Thunder Client | API testing |
| AWS Toolkit | AWS integration |
| GitHub Copilot | AI coding assistant |
| Error Lens | Inline error display |
| Auto Rename Tag | HTML/JSX tag renaming |
| ES7+ React Snippets | React code snippets |

---

## 3. Programming Languages

### 3.1 Backend Languages
| Language | Version | Purpose |
|----------|---------|---------|
| Python | 3.11+ | Primary backend, AI/ML |
| SQL | Standard | Database queries |
| Bash/Shell | - | Scripting, automation |

### 3.2 Frontend Languages
| Language | Version | Purpose |
|----------|---------|---------|
| TypeScript | 5.x | Primary frontend |
| JavaScript | ES2022+ | Frontend runtime |
| HTML5 | - | Markup |
| CSS3 | - | Styling |
| JSON | - | Data interchange |
| YAML | - | Configuration |
| Markdown | - | Documentation |

---

## 4. Frontend Technology Stack

### 4.1 Core Framework
| Package | Version | Purpose | Required |
|---------|---------|---------|----------|
| React | 18.x | UI framework | ✅ Required |
| React DOM | 18.x | DOM rendering | ✅ Required |
| TypeScript | 5.x | Type safety | ✅ Required |

### 4.2 Build Tools
| Tool | Version | Purpose | Required |
|------|---------|---------|----------|
| Vite | 5.x | Build tool, dev server | ✅ Required |
| @vitejs/plugin-react | Latest | React support for Vite | ✅ Required |
| SWC | Latest | Fast compilation | ✅ Required |
| ESBuild | Latest | Bundling | ✅ Required |

### 4.3 Styling
| Package | Version | Purpose | Required |
|---------|---------|---------|----------|
| Tailwind CSS | 4.x | Utility-first CSS | ✅ Required |
| PostCSS | 8.x | CSS processing | ✅ Required |
| Autoprefixer | Latest | CSS vendor prefixes | ✅ Required |
| @tailwindcss/forms | Latest | Form styling | ✅ Required |
| @tailwindcss/typography | Latest | Prose styling | Recommended |

### 4.4 Routing & State Management
| Package | Version | Purpose | Required |
|---------|---------|---------|----------|
| React Router DOM | 6.x | Client-side routing | ✅ Required |
| React Query | 5.x | Server state management | ✅ Required |
| Zustand | 4.x | Client state management | ✅ Required |
| Jotai | 2.x | Atomic state (alternative) | Optional |

### 4.5 HTTP & API
| Package | Version | Purpose | Required |
|---------|---------|---------|----------|
| Axios | 1.x | HTTP client | ✅ Required |
| @tanstack/react-query | 5.x | Data fetching | ✅ Required |
| SWR | 2.x | Data fetching (alternative) | Optional |

### 4.6 UI Components & Icons
| Package | Version | Purpose | Required |
|---------|---------|---------|----------|
| Lucide React | Latest | Icon library | ✅ Required |
| Headless UI | 2.x | Accessible components | ✅ Required |
| Radix UI | Latest | Unstyled components | Recommended |
| Framer Motion | 11.x | Animations | Recommended |
| React Hot Toast | 2.x | Toast notifications | ✅ Required |
| React Hook Form | 7.x | Form handling | ✅ Required |
| Zod | 3.x | Schema validation | ✅ Required |

### 4.7 Charts & Visualization
| Package | Version | Purpose | Required |
|---------|---------|---------|----------|
| Recharts | 2.x | Charts library | ✅ Required |
| Chart.js | 4.x | Charts (alternative) | Optional |
| react-chartjs-2 | 5.x | Chart.js React wrapper | Optional |
| D3.js | 7.x | Advanced visualizations | Optional |

### 4.8 Data Tables
| Package | Version | Purpose | Required |
|---------|---------|---------|----------|
| @tanstack/react-table | 8.x | Headless tables | ✅ Required |
| AG Grid | Latest | Enterprise grid | Optional (paid) |

### 4.9 Date & Time
| Package | Version | Purpose | Required |
|---------|---------|---------|----------|
| date-fns | 3.x | Date utilities | ✅ Required |
| dayjs | 1.x | Date library (alternative) | Optional |

### 4.10 PDF & Documents
| Package | Version | Purpose | Required |
|---------|---------|---------|----------|
| react-pdf | 7.x | PDF viewing | Recommended |
| @react-pdf/renderer | 3.x | PDF generation | Recommended |
| html2canvas | 1.x | Screenshot capture | Optional |
| jsPDF | 2.x | PDF creation | Optional |

### 4.11 Code Quality
| Tool | Version | Purpose | Required |
|------|---------|---------|----------|
| ESLint | 8.x | JavaScript linting | ✅ Required |
| Prettier | 3.x | Code formatting | ✅ Required |
| TypeScript ESLint | Latest | TS linting | ✅ Required |
| Husky | 9.x | Git hooks | ✅ Required |
| lint-staged | 15.x | Pre-commit linting | ✅ Required |

### 4.12 Testing
| Tool | Version | Purpose | Required |
|------|---------|---------|----------|
| Vitest | 1.x | Unit testing | ✅ Required |
| React Testing Library | 14.x | Component testing | ✅ Required |
| Playwright | 1.x | E2E testing | ✅ Required |
| Cypress | 13.x | E2E testing (alternative) | Optional |
| MSW | 2.x | API mocking | ✅ Required |

---

## 5. Backend Technology Stack

### 5.1 Core Framework
| Package | Version | Purpose | Required |
|---------|---------|---------|----------|
| FastAPI | 0.109+ | REST API framework | ✅ Required |
| Uvicorn | 0.27+ | ASGI server | ✅ Required |
| Gunicorn | 21.x | Production server | ✅ Required |
| Starlette | 0.35+ | ASGI toolkit | ✅ Required |

### 5.2 Database & ORM
| Package | Version | Purpose | Required |
|---------|---------|---------|----------|
| SQLAlchemy | 2.x | ORM (async) | ✅ Required |
| Alembic | 1.13+ | Database migrations | ✅ Required |
| asyncpg | 0.29+ | PostgreSQL async driver | ✅ Required |
| aiosqlite | 0.19+ | SQLite async driver | ✅ Required |
| psycopg2-binary | 2.9+ | PostgreSQL sync driver | Recommended |

### 5.3 Data Validation & Serialization
| Package | Version | Purpose | Required |
|---------|---------|---------|----------|
| Pydantic | 2.x | Data validation | ✅ Required |
| pydantic-settings | 2.x | Settings management | ✅ Required |
| python-multipart | 0.0.6+ | Form data parsing | ✅ Required |
| orjson | 3.x | Fast JSON | Recommended |

### 5.4 HTTP Client
| Package | Version | Purpose | Required |
|---------|---------|---------|----------|
| httpx | 0.26+ | Async HTTP client | ✅ Required |
| aiohttp | 3.9+ | Async HTTP (alternative) | Optional |
| requests | 2.31+ | Sync HTTP client | Recommended |

### 5.5 Authentication & Security
| Package | Version | Purpose | Required |
|---------|---------|---------|----------|
| python-jose | 3.3+ | JWT tokens | ✅ Required |
| passlib | 1.7+ | Password hashing | ✅ Required |
| bcrypt | 4.x | Password hashing backend | ✅ Required |
| cryptography | 42.x | Encryption utilities | ✅ Required |
| PyJWT | 2.x | JWT (alternative) | Optional |

### 5.6 Environment & Configuration
| Package | Version | Purpose | Required |
|---------|---------|---------|----------|
| python-dotenv | 1.x | Env file loading | ✅ Required |

### 5.7 Caching
| Package | Version | Purpose | Required |
|---------|---------|---------|----------|
| redis | 5.x | Redis client | ✅ Required |
| aiocache | 0.12+ | Async caching | Recommended |

### 5.8 Task Queue
| Package | Version | Purpose | Required |
|---------|---------|---------|----------|
| Celery | 5.3+ | Task queue | ✅ Required |
| rq | 1.15+ | Simple queue (alternative) | Optional |
| arq | 0.26+ | Async queue | Optional |

### 5.9 Testing
| Tool | Version | Purpose | Required |
|------|---------|---------|----------|
| pytest | 8.x | Testing framework | ✅ Required |
| pytest-asyncio | 0.23+ | Async test support | ✅ Required |
| pytest-cov | 4.x | Coverage | ✅ Required |
| httpx | 0.26+ | API testing | ✅ Required |
| Faker | 22.x | Test data generation | ✅ Required |
| factory_boy | 3.x | Test factories | Recommended |

### 5.10 Logging & Monitoring
| Package | Version | Purpose | Required |
|---------|---------|---------|----------|
| loguru | 0.7+ | Logging | ✅ Required |
| structlog | 24.x | Structured logging | Recommended |
| sentry-sdk | 1.x | Error tracking | ✅ Required |
| opentelemetry-api | 1.x | Tracing | Recommended |
| prometheus_client | 0.19+ | Metrics | Recommended |

### 5.11 Code Quality
| Tool | Version | Purpose | Required |
|------|---------|---------|----------|
| black | 24.x | Code formatting | ✅ Required |
| isort | 5.x | Import sorting | ✅ Required |
| ruff | 0.2+ | Fast linting | ✅ Required |
| mypy | 1.8+ | Static typing | ✅ Required |
| flake8 | 7.x | Linting (alternative) | Optional |
| bandit | 1.7+ | Security linting | ✅ Required |
| pre-commit | 3.x | Git hooks | ✅ Required |

---

## 6. AI/ML Technology Stack

### 6.1 LLM Integration
| Package | Version | Purpose | Required |
|---------|---------|---------|----------|
| openai | 1.x | OpenAI SDK | ✅ Required |
| anthropic | 0.18+ | Anthropic SDK | ✅ Required |
| boto3 | 1.34+ | AWS SDK (Bedrock) | ✅ Required |
| botocore | 1.34+ | AWS core | ✅ Required |

### 6.2 LangChain Stack
| Package | Version | Purpose | Required |
|---------|---------|---------|----------|
| langchain | 0.1+ | LLM orchestration | ✅ Required |
| langchain-core | 0.1+ | Core abstractions | ✅ Required |
| langchain-community | 0.0.20+ | Community integrations | ✅ Required |
| langchain-openai | 0.0.5+ | OpenAI integration | ✅ Required |
| langchain-aws | 0.0.5+ | AWS/Bedrock integration | ✅ Required |
| langgraph | 0.0.26+ | Agent workflows | Recommended |
| langserve | 0.0.40+ | API deployment | Optional |
| langsmith | 0.0.87+ | LLM observability | ✅ Required |

### 6.3 Vector Databases & Embeddings
| Package | Version | Purpose | Required |
|---------|---------|---------|----------|
| opensearch-py | 2.4+ | OpenSearch client | ✅ Required |
| faiss-cpu | 1.7+ | Local vector search | Recommended |
| chromadb | 0.4+ | Vector DB (dev) | Recommended |
| pinecone-client | 3.x | Pinecone (alternative) | Optional |
| tiktoken | 0.5+ | Token counting | ✅ Required |
| sentence-transformers | 2.x | Embeddings | Recommended |

### 6.4 Document Processing
| Package | Version | Purpose | Required |
|---------|---------|---------|----------|
| PyPDF2 | 3.x | PDF parsing | ✅ Required |
| pypdf | 3.x | PDF parsing (modern) | ✅ Required |
| python-docx | 1.x | Word doc parsing | ✅ Required |
| unstructured | 0.12+ | Document parsing | ✅ Required |
| pdfplumber | 0.10+ | PDF extraction | Recommended |
| pytesseract | 0.3+ | OCR | Recommended |

### 6.5 ML & Data Science
| Package | Version | Purpose | Required |
|---------|---------|---------|----------|
| numpy | 1.26+ | Numerical computing | ✅ Required |
| pandas | 2.x | Data manipulation | ✅ Required |
| scikit-learn | 1.4+ | ML utilities | Recommended |
| scipy | 1.12+ | Scientific computing | Recommended |

---

## 7. Database Technologies

### 7.1 Relational Databases
| Database | Version | Purpose | Required |
|----------|---------|---------|----------|
| PostgreSQL | 15+ | Production database | ✅ Required |
| SQLite | 3.x | Local development | ✅ Required |
| Amazon Aurora | PostgreSQL 15 | AWS production | Recommended |

### 7.2 Vector Databases
| Database | Version | Purpose | Required |
|----------|---------|---------|----------|
| Amazon OpenSearch | 2.11+ | RAG vector search | ✅ Required |
| Pinecone | Latest | Vector DB (alternative) | Optional |
| Weaviate | Latest | Vector DB (alternative) | Optional |
| Qdrant | Latest | Vector DB (alternative) | Optional |

### 7.3 Caching & In-Memory
| Database | Version | Purpose | Required |
|----------|---------|---------|----------|
| Redis | 7.x | Caching, sessions | ✅ Required |
| Amazon ElastiCache | Redis 7+ | AWS managed Redis | ✅ Required |

### 7.4 NoSQL (Optional)
| Database | Version | Purpose | Required |
|----------|---------|---------|----------|
| Amazon DynamoDB | - | Session storage | Optional |
| MongoDB | 7.x | Document storage | Optional |

### 7.5 Database Tools
| Tool | Version | Purpose | Required |
|------|---------|---------|----------|
| pgAdmin | 4.x | PostgreSQL GUI | Recommended |
| DBeaver | 23.x | Universal DB tool | Recommended |
| DataGrip | 2024.x | JetBrains DB IDE | Optional (paid) |

---

## 8. DevOps & Infrastructure

### 8.1 Containerization
| Tool | Version | Purpose | Required |
|------|---------|---------|----------|
| Docker | 25.x | Containerization | ✅ Required |
| Docker Compose | 2.24+ | Multi-container apps | ✅ Required |
| Docker Desktop | Latest | Local containers | ✅ Required |

### 8.2 Container Orchestration
| Tool | Version | Purpose | Required |
|------|---------|---------|----------|
| Amazon ECS | - | Container orchestration | Recommended |
| AWS Fargate | - | Serverless containers | Recommended |
| Kubernetes | 1.29+ | Container orchestration | Optional |
| Amazon EKS | - | Managed Kubernetes | Optional |

### 8.3 Infrastructure as Code
| Tool | Version | Purpose | Required |
|------|---------|---------|----------|
| Terraform | 1.7+ | Infrastructure provisioning | ✅ Required |
| AWS CloudFormation | - | AWS native IaC | Optional |
| AWS CDK | 2.x | Cloud Development Kit | Optional |
| Pulumi | 3.x | IaC (alternative) | Optional |

### 8.4 CI/CD Pipelines
| Tool | Version | Purpose | Required |
|------|---------|---------|----------|
| GitHub Actions | - | CI/CD automation | ✅ Required |
| AWS CodePipeline | - | AWS CI/CD | Recommended |
| AWS CodeBuild | - | Build automation | Recommended |
| AWS CodeDeploy | - | Deployment automation | Recommended |
| Jenkins | 2.x | CI/CD (alternative) | Optional |
| CircleCI | - | CI/CD (alternative) | Optional |

### 8.5 Version Control
| Tool | Version | Purpose | Required |
|------|---------|---------|----------|
| Git | 2.43+ | Version control | ✅ Required |
| GitHub | - | Code hosting | ✅ Required |
| GitHub CLI | 2.x | CLI tooling | Recommended |

---

## 9. AWS Cloud Services (Complete List)

### 9.1 Compute
| Service | Purpose | Required |
|---------|---------|----------|
| AWS App Runner | Backend hosting | ✅ Required |
| AWS Lambda | Serverless functions | ✅ Required |
| Amazon ECS | Container orchestration | ✅ Required |
| AWS Fargate | Serverless containers | ✅ Required |
| Amazon EC2 | Virtual machines | Recommended |
| AWS Batch | Batch processing | Optional |

### 9.2 AI/ML Services
| Service | Purpose | Required |
|---------|---------|----------|
| Amazon Bedrock | LLM (Claude 3) | ✅ Required |
| Amazon SageMaker | Custom ML training | Recommended |
| Amazon Comprehend | NLP/Text analysis | ✅ Required |
| Amazon Textract | Document OCR | ✅ Required |
| Amazon Kendra | Enterprise search | Recommended |
| Amazon Rekognition | Image analysis | Optional |

### 9.3 Database Services
| Service | Purpose | Required |
|---------|---------|----------|
| Amazon RDS | PostgreSQL hosting | ✅ Required |
| Amazon Aurora | High-perf PostgreSQL | Recommended |
| Amazon DynamoDB | NoSQL | Recommended |
| Amazon ElastiCache | Redis caching | ✅ Required |
| Amazon OpenSearch Service | Vector search/RAG | ✅ Required |

### 9.4 Storage
| Service | Purpose | Required |
|---------|---------|----------|
| Amazon S3 | Object storage | ✅ Required |
| Amazon EFS | Shared file storage | Recommended |
| AWS Backup | Automated backups | ✅ Required |

### 9.5 Networking & CDN
| Service | Purpose | Required |
|---------|---------|----------|
| Amazon VPC | Network isolation | ✅ Required |
| Amazon Route 53 | DNS | ✅ Required |
| Amazon CloudFront | CDN | ✅ Required |
| Elastic Load Balancing | Load distribution | ✅ Required |
| AWS WAF | Web firewall | ✅ Required |
| AWS Shield | DDoS protection | ✅ Required |
| AWS PrivateLink | Private connectivity | Recommended |
| Amazon API Gateway | API management | Recommended |

### 9.6 Security & Identity
| Service | Purpose | Required |
|---------|---------|----------|
| AWS IAM | Access management | ✅ Required |
| Amazon Cognito | User authentication | ✅ Required |
| AWS Secrets Manager | Secrets storage | ✅ Required |
| AWS KMS | Encryption keys | ✅ Required |
| AWS Certificate Manager | SSL certificates | ✅ Required |
| Amazon GuardDuty | Threat detection | ✅ Required |
| AWS Security Hub | Security posture | Recommended |
| AWS Config | Compliance | ✅ Required |

### 9.7 Hosting
| Service | Purpose | Required |
|---------|---------|----------|
| AWS Amplify | Frontend hosting | ✅ Required |
| Amazon S3 + CloudFront | Static hosting | Alternative |

### 9.8 Monitoring & Logging
| Service | Purpose | Required |
|---------|---------|----------|
| Amazon CloudWatch | Logs & metrics | ✅ Required |
| AWS X-Ray | Distributed tracing | ✅ Required |
| AWS CloudTrail | API auditing | ✅ Required |

### 9.9 CI/CD
| Service | Purpose | Required |
|---------|---------|----------|
| AWS CodePipeline | Pipeline automation | Recommended |
| AWS CodeBuild | Build service | Recommended |
| AWS CodeDeploy | Deployment | Recommended |
| Amazon ECR | Container registry | ✅ Required |

### 9.10 Messaging & Integration
| Service | Purpose | Required |
|---------|---------|----------|
| Amazon SQS | Message queuing | ✅ Required |
| Amazon SNS | Notifications | ✅ Required |
| Amazon EventBridge | Event bus | ✅ Required |
| AWS Step Functions | Workflow orchestration | ✅ Required |

### 9.11 Analytics
| Service | Purpose | Required |
|---------|---------|----------|
| Amazon QuickSight | BI dashboards | Recommended |
| Amazon Athena | SQL on S3 | Recommended |
| AWS Glue | ETL | Recommended |

---

## 10. External Services & APIs

### 10.1 AI/LLM Providers
| Service | Purpose | Required |
|---------|---------|----------|
| OpenAI API | GPT-4/GPT-4o | ✅ Required |
| Anthropic API | Claude (direct) | Optional |
| Cohere API | Embeddings | Optional |

### 10.2 Monitoring & Error Tracking
| Service | Purpose | Required |
|---------|---------|----------|
| Sentry | Error tracking | ✅ Required |
| Datadog | APM monitoring | Optional |
| New Relic | APM (alternative) | Optional |
| PagerDuty | Incident management | Recommended |

### 10.3 Communication
| Service | Purpose | Required |
|---------|---------|----------|
| SendGrid | Email delivery | Recommended |
| Amazon SES | Email (AWS) | Alternative |
| Twilio | SMS notifications | Optional |
| Slack API | Team notifications | Recommended |

### 10.4 Documentation
| Tool | Purpose | Required |
|------|---------|----------|
| Swagger/OpenAPI | API documentation | ✅ Required |
| Redoc | API docs rendering | Recommended |
| MkDocs | Project documentation | Recommended |
| Docusaurus | Docs site | Optional |

---

## 11. Development Workflow Tools

### 11.1 Package Managers
| Tool | Purpose | Required |
|------|---------|----------|
| npm | Node packages | ✅ Required |
| pnpm | Fast npm alternative | Recommended |
| yarn | npm alternative | Optional |
| pip | Python packages | ✅ Required |
| poetry | Python dependency mgmt | Recommended |
| pipenv | Python env mgmt | Optional |

### 11.2 Runtime Managers
| Tool | Purpose | Required |
|------|---------|----------|
| nvm | Node version management | ✅ Required |
| pyenv | Python version mgmt | Recommended |

### 11.3 API Testing
| Tool | Purpose | Required |
|------|---------|----------|
| Postman | API testing | ✅ Required |
| Insomnia | API testing | Optional |
| HTTPie | CLI API testing | Recommended |
| curl | CLI HTTP client | ✅ Required |

---

## 12. Security Tools

### 12.1 Dependency Scanning
| Tool | Purpose | Required |
|------|---------|----------|
| npm audit | JS vulnerability scan | ✅ Required |
| pip-audit | Python vulnerability scan | ✅ Required |
| Snyk | Security scanning | Recommended |
| Dependabot | Dependency updates | ✅ Required |
| OWASP Dependency-Check | Vulnerability scanning | Recommended |

### 12.2 Code Security
| Tool | Purpose | Required |
|------|---------|----------|
| Bandit | Python security linting | ✅ Required |
| ESLint security plugin | JS security linting | ✅ Required |
| SonarQube | Code quality & security | Recommended |
| Semgrep | Static analysis | Recommended |

### 12.3 Secrets Management
| Tool | Purpose | Required |
|------|---------|----------|
| AWS Secrets Manager | Cloud secrets | ✅ Required |
| HashiCorp Vault | Secrets management | Optional |
| git-secrets | Prevent secret commits | ✅ Required |
| gitleaks | Secret detection | ✅ Required |

---

## 13. Summary - Complete Tool Count

| Category | Count |
|----------|-------|
| Programming Languages | 10 |
| Frontend Packages | 50+ |
| Backend Packages | 60+ |
| AI/ML Packages | 30+ |
| Database Technologies | 15 |
| AWS Services | 45+ |
| DevOps Tools | 20+ |
| Security Tools | 15+ |
| **Total Unique Technologies** | **250+** |

---

## 14. Installation Commands Summary

### Frontend Setup
```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install react-router-dom axios lucide-react @tanstack/react-query zustand
npm install react-hook-form zod @hookform/resolvers
npm install recharts @tanstack/react-table
npm install framer-motion react-hot-toast
npm install -D tailwindcss postcss autoprefixer
npm install -D @tailwindcss/forms @tailwindcss/typography
npm install -D vitest @testing-library/react playwright msw
npm install -D eslint prettier husky lint-staged
```

### Backend Setup
```bash
python -m venv venv
source venv/bin/activate  # or .\venv\Scripts\activate on Windows
pip install fastapi uvicorn gunicorn
pip install sqlalchemy alembic asyncpg aiosqlite
pip install pydantic pydantic-settings python-dotenv
pip install httpx python-jose passlib bcrypt
pip install openai anthropic boto3 langchain
pip install langchain-openai langchain-aws langchain-community
pip install opensearch-py tiktoken
pip install pytest pytest-asyncio pytest-cov
pip install black isort ruff mypy bandit
pip install loguru sentry-sdk
pip install redis celery
pip install pypdf python-docx unstructured
pip install numpy pandas
```

---

*Document Version: 1.0*
*Total Pages: 15+*
*Last Updated: February 2026*
