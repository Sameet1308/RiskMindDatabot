# RiskMind - AWS Cloud Requirements for Demo

## Executive Summary

This document outlines the AWS resources needed to deploy a working demo of RiskMind, an Underwriting Co-Pilot application.

**Estimated Monthly Cost:** $50-150/month for demo (can be less with free tier)

---

## Required AWS Services

### 1. Compute (Backend API)

| Service | Configuration | Purpose | Est. Cost |
|---------|--------------|---------|-----------|
| **AWS App Runner** | 1 vCPU, 2GB RAM | Host FastAPI backend | ~$25/month |
| *OR* **AWS Lambda + API Gateway** | 128-512MB | Serverless alternative | Pay-per-request |

---

### 2. Frontend Hosting

| Service | Configuration | Purpose | Est. Cost |
|---------|--------------|---------|-----------|
| **AWS Amplify** | Free tier | Host React frontend | Free-$5/month |
| *OR* **S3 + CloudFront** | Static hosting | CDN-backed hosting | ~$1/month |

---

### 3. Database

| Service | Configuration | Purpose | Est. Cost |
|---------|--------------|---------|-----------|
| **RDS PostgreSQL** | db.t3.micro | Claims data storage | ~$15/month |
| *OR* **Aurora Serverless v2** | 0.5-2 ACU | Auto-scaling option | Pay-per-use |

---

### 4. AI/LLM Layer

| Service | Configuration | Purpose | Est. Cost |
|---------|--------------|---------|-----------|
| **Amazon Bedrock** | Claude 3 / Llama 3 | LLM for analysis | Pay-per-token |
| *OR* **OpenAI API** | GPT-4o-mini | External LLM | ~$5-20/month |

**Bedrock Pricing Example:**
- Claude 3 Haiku: ~$0.00025/1K input tokens
- For demo: ~$5-15/month

---

### 5. Vector Database (for RAG - Guidelines Search)

| Service | Configuration | Purpose | Est. Cost |
|---------|--------------|---------|-----------|
| **Amazon OpenSearch Serverless** | Minimal | Store guideline embeddings | ~$25/month |
| *OR* **Pinecone** (external) | Free tier | Simpler setup | Free |

---

### 6. Storage

| Service | Configuration | Purpose | Est. Cost |
|---------|--------------|---------|-----------|
| **S3** | Standard | Store PDFs, documents | ~$1/month |

---

### 7. Security & Auth (Optional for Demo)

| Service | Configuration | Purpose | Est. Cost |
|---------|--------------|---------|-----------|
| **Cognito** | Free tier | User authentication | Free |
| **Secrets Manager** | Few secrets | Store API keys | ~$1/month |

---

## Minimum Viable Demo Stack

For a working demo with minimal cost:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    RISKMIND AWS ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌──────────────┐      ┌──────────────┐      ┌──────────────┐     │
│   │   Amplify    │      │  App Runner  │      │     RDS      │     │
│   │  (Frontend)  │─────▶│  (Backend)   │─────▶│ (PostgreSQL) │     │
│   │    React     │      │   FastAPI    │      │              │     │
│   └──────────────┘      └──────────────┘      └──────────────┘     │
│                                │                                    │
│                                ▼                                    │
│                         ┌──────────────┐                           │
│                         │   Bedrock    │                           │
│                         │  (Claude 3)  │                           │
│                         └──────────────┘                           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Required AWS Access/Permissions

| Resource | Access Needed |
|----------|--------------|
| **IAM** | Create roles for App Runner, Bedrock |
| **Bedrock** | Model access (request Claude/Llama access) |
| **RDS** | Create database instance |
| **App Runner** | Deploy container/code |
| **Amplify** | Connect to GitHub repo |
| **S3** | Create bucket |

---

## What We Need From Company

### 1. AWS Account Access
- [ ] AWS Account ID
- [ ] IAM user with permissions OR Admin access for setup
- [ ] Region preference (us-east-1 recommended)

### 2. Bedrock Model Access
- [ ] Request access to Claude 3 or Llama 3 models in Bedrock console
- [ ] ~24-48 hours for approval

### 3. Budget Approval
- [ ] Estimated $50-150/month for demo environment
- [ ] Can shut down when not demoing to save costs

### 4. Domain (Optional)
- [ ] Custom domain for demo (e.g., riskmind-demo.company.com)
- [ ] SSL certificate via AWS Certificate Manager (free)

---

## Cost Summary

| Component | Monthly Cost |
|-----------|-------------|
| App Runner (Backend) | $25 |
| RDS PostgreSQL | $15 |
| Amplify (Frontend) | $5 |
| Bedrock (LLM) | $10-20 |
| S3 + Misc | $5 |
| **TOTAL** | **$60-70/month** |

*Can reduce to ~$30/month using Lambda + Aurora Serverless*

---

## Alternative: Local Demo (No Cloud Cost)

If cloud budget is not approved, we can demo locally:
- SQLite instead of RDS
- Local React dev server
- OpenAI API ($10 credits) instead of Bedrock
- **Cost: ~$10 one-time**

---

## Timeline to Deploy

| Phase | Duration |
|-------|----------|
| AWS account setup | 1 day |
| Bedrock access approval | 1-2 days |
| Infrastructure deployment | 1 day |
| App deployment + testing | 1-2 days |
| **Total** | **4-6 days** |

---

## Questions for Company

1. Can we get AWS account access with appropriate permissions?
2. Is $50-150/month budget approved for demo environment?
3. Do we need SSO/corporate authentication for the demo?
4. Any compliance requirements (data residency, encryption)?
5. Preferred AWS region?
