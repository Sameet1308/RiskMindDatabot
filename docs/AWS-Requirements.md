# RiskMind AWS Requirements - Complete Specification

## Executive Summary

This document outlines **ALL AWS services, access levels, and configurations** required for the RiskMind Underwriting Co-Pilot platform. This is a production-grade AI application requiring compute, database, AI/ML, security, and monitoring services.

---

## AWS Services Required

### 1. AI/ML Services

| Service | Purpose | Configuration | Access Required |
|---------|---------|---------------|-----------------|
| **Amazon Bedrock** | LLM for risk analysis | Claude 3.5 Sonnet (PRIMARY), Claude 3 Haiku, Claude 3 Opus | Full invoke access, model management |
| **Amazon SageMaker** | Custom model training (future) | ml.t3.medium instances | Create/manage endpoints |
| **Amazon Comprehend** | Text analysis, entity extraction | Standard tier | Full access |
| **Amazon Textract** | Document OCR (policy PDFs) | Standard tier | Full access |
| **Amazon Kendra** | Enterprise search (alternative to OpenSearch) | Developer edition | Full access |

### 2. Compute Services

| Service | Purpose | Configuration | Access Required |
|---------|---------|---------------|-----------------|
| **AWS App Runner** | Backend API hosting | 1 vCPU, 2GB RAM, auto-scaling | Create/deploy/manage services |
| **AWS Lambda** | Serverless functions | Python 3.11 runtime, 512MB-1GB | Create/invoke/manage |
| **Amazon ECS** | Container orchestration (alternative) | Fargate mode | Full cluster management |
| **Amazon EC2** | Development/testing VMs | t3.large instances | Launch/terminate/connect |
| **AWS Batch** | Batch processing jobs | Managed compute | Full access |

### 3. Database Services

| Service | Purpose | Configuration | Access Required |
|---------|---------|---------------|-----------------|
| **Amazon RDS** | Primary PostgreSQL database | db.t3.medium, 100GB, Multi-AZ | Full management |
| **Amazon Aurora** | High-performance DB (production) | Aurora PostgreSQL Serverless v2 | Full management |
| **Amazon DynamoDB** | NoSQL for session/cache | On-demand capacity | Full access |
| **Amazon ElastiCache** | Redis caching layer | cache.t3.micro | Full access |
| **Amazon OpenSearch Service** | Vector search for RAG | t3.medium.search, 50GB | Full domain management |

### 4. Storage Services

| Service | Purpose | Configuration | Access Required |
|---------|---------|---------------|-----------------|
| **Amazon S3** | Document storage, static assets | Standard tier, versioning enabled | Full bucket management |
| **Amazon EFS** | Shared file storage | General purpose | Full access |
| **AWS Backup** | Automated backups | Daily backups, 30-day retention | Full access |

### 5. Networking & Content Delivery

| Service | Purpose | Configuration | Access Required |
|---------|---------|---------------|-----------------|
| **Amazon VPC** | Network isolation | Custom VPC, public/private subnets | Full management |
| **Amazon Route 53** | DNS management | Hosted zones | Full access |
| **Amazon CloudFront** | CDN for frontend | Standard distribution | Full access |
| **AWS WAF** | Web application firewall | Managed rules | Full access |
| **Elastic Load Balancing** | Load distribution | Application Load Balancer | Full access |
| **AWS PrivateLink** | Private connectivity to services | VPC endpoints | Create/manage |
| **Amazon API Gateway** | API management (alternative) | REST/HTTP APIs | Full access |

### 6. Security & Identity

| Service | Purpose | Configuration | Access Required |
|---------|---------|---------------|-----------------|
| **AWS IAM** | User/role management | Custom policies | Full management |
| **Amazon Cognito** | User authentication | User pools, identity pools | Full access |
| **AWS Secrets Manager** | API keys, credentials | Automatic rotation | Create/read secrets |
| **AWS KMS** | Encryption keys | Customer managed keys | Full access |
| **AWS Certificate Manager** | SSL/TLS certificates | Public certificates | Request/manage |
| **AWS Shield** | DDoS protection | Standard (minimum) | Enabled |
| **Amazon GuardDuty** | Threat detection | Standard tier | View findings |
| **AWS Security Hub** | Security posture | Standard tier | View/manage |

### 7. Frontend Hosting

| Service | Purpose | Configuration | Access Required |
|---------|---------|---------------|-----------------|
| **AWS Amplify** | React app hosting | CI/CD from GitHub | Full access |
| **Amazon S3 + CloudFront** | Alternative static hosting | Static website hosting | Full access |

### 8. Monitoring & Logging

| Service | Purpose | Configuration | Access Required |
|---------|---------|---------------|-----------------|
| **Amazon CloudWatch** | Logs, metrics, alarms | Custom dashboards | Full access |
| **AWS X-Ray** | Distributed tracing | Sampling enabled | Full access |
| **Amazon CloudTrail** | API audit logs | Multi-region trail | Full access |
| **AWS Config** | Resource compliance | Standard rules | Full access |

### 9. CI/CD & DevOps

| Service | Purpose | Configuration | Access Required |
|---------|---------|---------------|-----------------|
| **AWS CodePipeline** | CI/CD automation | GitHub source | Full access |
| **AWS CodeBuild** | Build automation | Linux containers | Full access |
| **AWS CodeDeploy** | Deployment automation | Blue/green deployments | Full access |
| **Amazon ECR** | Container registry | Private repositories | Full access |

### 10. Analytics & Reporting

| Service | Purpose | Configuration | Access Required |
|---------|---------|---------------|-----------------|
| **Amazon QuickSight** | Business intelligence | Standard edition | Create/view dashboards |
| **Amazon Athena** | SQL queries on S3 data | Standard tier | Full access |
| **AWS Glue** | ETL and data catalog | Serverless | Full access |

### 11. Messaging & Integration

| Service | Purpose | Configuration | Access Required |
|---------|---------|---------------|-----------------|
| **Amazon SQS** | Message queuing | Standard queues | Full access |
| **Amazon SNS** | Notifications, alerts | Standard topics | Full access |
| **Amazon EventBridge** | Event-driven architecture | Custom event bus | Full access |
| **AWS Step Functions** | Workflow orchestration | Standard workflows | Full access |

---

## IAM Policies Required

### Developer Policy (PowerUserAccess + Bedrock)

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "bedrock:*",
                "rds:*",
                "es:*",
                "opensearch:*",
                "s3:*",
                "lambda:*",
                "ecs:*",
                "ecr:*",
                "apprunner:*",
                "amplify:*",
                "cognito:*",
                "cognito-idp:*",
                "secretsmanager:*",
                "kms:*",
                "logs:*",
                "cloudwatch:*",
                "xray:*",
                "sqs:*",
                "sns:*",
                "events:*",
                "states:*",
                "dynamodb:*",
                "elasticache:*",
                "codepipeline:*",
                "codebuild:*",
                "codedeploy:*",
                "cloudfront:*",
                "route53:*",
                "acm:*",
                "waf:*",
                "wafv2:*",
                "elasticloadbalancing:*",
                "ec2:*",
                "vpc:*",
                "apigateway:*",
                "textract:*",
                "comprehend:*",
                "kendra:*",
                "quicksight:*",
                "athena:*",
                "glue:*",
                "backup:*",
                "efs:*"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Deny",
            "Action": [
                "iam:CreateUser",
                "iam:DeleteUser",
                "iam:CreateAccessKey",
                "iam:DeleteAccessKey",
                "organizations:*",
                "account:*"
            ],
            "Resource": "*"
        }
    ]
}
```

---

## Bedrock Model Access Requirements

Request access to the following foundational models in Amazon Bedrock:

### Priority 1 - REQUIRED (Request Immediately)
| Model | Provider | Use Case | Priority |
|-------|----------|----------|----------|
| **Claude 3.5 Sonnet** | Anthropic | PRIMARY MODEL - Best for risk analysis, complex reasoning | ⭐ HIGHEST |
| **Claude 3 Haiku** | Anthropic | Fast responses, chat, simple queries | ⭐ HIGH |
| **Titan Text Embeddings V2** | Amazon | Vector embeddings for RAG search | ⭐ HIGH |

### Priority 2 - RECOMMENDED (Request for Flexibility)
| Model | Provider | Use Case | Priority |
|-------|----------|----------|----------|
| **Claude 3 Sonnet** | Anthropic | Backup model, balanced performance | MEDIUM |
| **Claude 3 Opus** | Anthropic | Most powerful, complex analysis (expensive) | MEDIUM |
| **Titan Text Express** | Amazon | Fallback LLM option | MEDIUM |

### Priority 3 - OPTIONAL (Nice to Have)
| Model | Provider | Use Case | Priority |
|-------|----------|----------|----------|
| **Cohere Command R+** | Cohere | Alternative LLM | LOW |
| **Cohere Embed** | Cohere | Alternative embeddings | LOW |

### Model Usage Strategy
```
┌─────────────────────────────────────────────────────────────┐
│  RiskMind Model Usage                                        │
├─────────────────────────────────────────────────────────────┤
│  Chat/Quick Questions  →  Claude 3 Haiku (fast, cheap)      │
│  Risk Analysis         →  Claude 3.5 Sonnet (accurate)      │
│  Complex Cases         →  Claude 3 Opus (most powerful)     │
│  RAG/Vector Search     →  Titan Embeddings V2               │
└─────────────────────────────────────────────────────────────┘
```

---

## Infrastructure Sizing

### Development Environment
| Resource | Size | Est. Monthly Cost |
|----------|------|-------------------|
| RDS PostgreSQL | db.t3.micro | $15 |
| OpenSearch | t3.small.search | $35 |
| App Runner | 0.25 vCPU, 0.5GB | $10 |
| Lambda | 100K invocations | $1 |
| S3 | 10GB | $1 |
| CloudWatch | Basic | $5 |
| **Dev Total** | | **~$70/month** |

### Production Environment
| Resource | Size | Est. Monthly Cost |
|----------|------|-------------------|
| Aurora PostgreSQL | Serverless v2, 2-8 ACUs | $100-200 |
| OpenSearch | m6g.large.search, 100GB | $200-300 |
| App Runner | 1 vCPU, 2GB, auto-scale | $50-100 |
| Lambda | 1M invocations | $10-20 |
| S3 | 100GB + transfer | $10-20 |
| CloudFront | 100GB transfer | $10-20 |
| ElastiCache | cache.t3.medium | $50 |
| Cognito | 10K users | $50 |
| Bedrock Claude | 1M tokens/day | $200-400 |
| CloudWatch | Enhanced | $30-50 |
| WAF | Standard rules | $10 |
| Secrets Manager | 10 secrets | $5 |
| **Production Total** | | **~$750-1,200/month** |

---

## Network Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              AWS CLOUD                                   │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                         VPC (10.0.0.0/16)                          │  │
│  │                                                                     │  │
│  │  ┌─────────────────────┐    ┌─────────────────────┐               │  │
│  │  │   Public Subnet A    │    │   Public Subnet B    │               │  │
│  │  │   (10.0.1.0/24)      │    │   (10.0.2.0/24)      │               │  │
│  │  │                       │    │                       │               │  │
│  │  │  ┌─────────────────┐ │    │  ┌─────────────────┐ │               │  │
│  │  │  │ NAT Gateway     │ │    │  │ NAT Gateway     │ │               │  │
│  │  │  └─────────────────┘ │    │  └─────────────────┘ │               │  │
│  │  │  ┌─────────────────┐ │    │                       │               │  │
│  │  │  │ ALB             │ │    │                       │               │  │
│  │  │  └─────────────────┘ │    │                       │               │  │
│  │  └─────────────────────┘    └─────────────────────┘               │  │
│  │                                                                     │  │
│  │  ┌─────────────────────┐    ┌─────────────────────┐               │  │
│  │  │   Private Subnet A   │    │   Private Subnet B   │               │  │
│  │  │   (10.0.10.0/24)     │    │   (10.0.20.0/24)     │               │  │
│  │  │                       │    │                       │               │  │
│  │  │  ┌─────────────────┐ │    │  ┌─────────────────┐ │               │  │
│  │  │  │ App Runner      │ │    │  │ App Runner      │ │               │  │
│  │  │  │ (Backend API)   │ │    │  │ (Replica)       │ │               │  │
│  │  │  └─────────────────┘ │    │  └─────────────────┘ │               │  │
│  │  │  ┌─────────────────┐ │    │  ┌─────────────────┐ │               │  │
│  │  │  │ Lambda          │ │    │  │ ElastiCache     │ │               │  │
│  │  │  │ Functions       │ │    │  │ (Redis)         │ │               │  │
│  │  │  └─────────────────┘ │    │  └─────────────────┘ │               │  │
│  │  └─────────────────────┘    └─────────────────────┘               │  │
│  │                                                                     │  │
│  │  ┌─────────────────────┐    ┌─────────────────────┐               │  │
│  │  │   Data Subnet A      │    │   Data Subnet B      │               │  │
│  │  │   (10.0.100.0/24)    │    │   (10.0.200.0/24)    │               │  │
│  │  │                       │    │                       │               │  │
│  │  │  ┌─────────────────┐ │    │  ┌─────────────────┐ │               │  │
│  │  │  │ RDS Primary     │ │    │  │ RDS Standby     │ │               │  │
│  │  │  │ (PostgreSQL)    │ │    │  │ (Multi-AZ)      │ │               │  │
│  │  │  └─────────────────┘ │    │  └─────────────────┘ │               │  │
│  │  │  ┌─────────────────┐ │    │                       │               │  │
│  │  │  │ OpenSearch      │ │    │                       │               │  │
│  │  │  │ (Vector DB)     │ │    │                       │               │  │
│  │  │  └─────────────────┘ │    │                       │               │  │
│  │  └─────────────────────┘    └─────────────────────┘               │  │
│  │                                                                     │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │ CloudFront   │  │ Route 53     │  │ WAF          │                  │
│  │ (CDN)        │  │ (DNS)        │  │ (Firewall)   │                  │
│  └──────────────┘  └──────────────┘  └──────────────┘                  │
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │ Cognito      │  │ Secrets Mgr  │  │ KMS          │                  │
│  │ (Auth)       │  │ (Secrets)    │  │ (Encryption) │                  │
│  └──────────────┘  └──────────────┘  └──────────────┘                  │
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │ Bedrock      │  │ S3           │  │ CloudWatch   │                  │
│  │ (LLM)        │  │ (Storage)    │  │ (Monitoring) │                  │
│  └──────────────┘  └──────────────┘  └──────────────┘                  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Security Requirements

### Encryption
- **At Rest**: All data encrypted using AWS KMS (AES-256)
- **In Transit**: TLS 1.3 enforced on all endpoints
- **Database**: RDS encryption enabled
- **S3**: Server-side encryption enabled

### Network Security
- VPC with private subnets for backend
- Security groups restricting inbound traffic
- WAF rules blocking common attacks
- VPC Flow Logs enabled

### Identity & Access
- Cognito user pools for authentication
- MFA enabled for all admin users
- IAM roles for service-to-service auth
- Short-lived credentials only

### Compliance
- CloudTrail for API auditing
- Config rules for compliance checks
- GuardDuty for threat detection
- Regular security assessments

---

## Developer Access Requirements

### Option A: Full Console Access (Recommended)
Developers get AWS Console login with ability to view and manage resources.

### Option B: Programmatic Access Only (Minimum)
IT Admin sets up resources, developers receive credentials to use in code.

---

## MINIMUM ACCESS REQUIRED (Must Have)

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

### Minimum IAM Permissions (for programmatic access)
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

## GOOD TO HAVE (Recommended for Developers)

These console permissions make development faster and easier:

| Service | Access Level | Why It Helps |
|---------|--------------|--------------|
| **Amazon Bedrock** | Full invoke | Test prompts in Bedrock Playground |
| **Amazon CloudWatch** | Read logs | Debug production issues quickly |
| **AWS App Runner** | View + Deploy | See deployment status, restart services |
| **AWS Amplify** | View + Deploy | See frontend builds, environment variables |
| **Amazon RDS** | Read only | View database metrics, connection info |
| **Amazon S3** | Read + Write | Browse uploaded files, check storage |
| **AWS Secrets Manager** | Read only | Verify secret values |
| **Amazon OpenSearch** | Read only | Test RAG queries in console |

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
                "secretsmanager:ListSecrets",
                "es:ESHttpGet",
                "es:ESHttpPost",
                "rds:Describe*",
                "cognito-idp:*"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Deny",
            "Action": [
                "rds:DeleteDBInstance",
                "rds:DeleteDBCluster",
                "s3:DeleteBucket",
                "iam:*"
            ],
            "Resource": "*"
        }
    ]
}
```

---

## Summary: What to Ask IT For

### If IT Gives Full Console Access:
✅ Request "Developer" IAM group with permissions above
✅ Get AWS Console login credentials
✅ Much easier development experience

### If IT Only Gives Programmatic Access:
✅ Request the 8 credentials listed in "Minimum Required"
✅ Ask IT to enable Bedrock models (Claude 3.5 Sonnet, Haiku, Titan)
✅ Ask IT to create RDS, OpenSearch, Cognito, S3 resources
✅ You can still build the app, but debugging is harder

---

## Team Access Summary

| Role | Console Access | Services |
|------|----------------|----------|
| **Admin** | Full account | All services + billing + IAM |
| **Lead Developer** | Full console | All services except IAM/billing |
| **Developer** | Console or Keys | Bedrock, RDS, S3, CloudWatch, Amplify |
| **QA Engineer** | Read only | CloudWatch, App Runner logs |
| **Stakeholder** | Read only | CloudWatch dashboards |

---

## Action Items for IT/Admin Team

1. ✅ Create AWS account or use existing
2. ✅ Enable Amazon Bedrock in region (us-east-1 recommended)
3. ✅ Request access to all Anthropic Claude models in Bedrock
4. ✅ Request access to Amazon Titan models in Bedrock
5. ✅ Create IAM users for each team member
6. ✅ Create VPC with public/private subnets
7. ✅ Set up RDS PostgreSQL instance
8. ✅ Create OpenSearch Service domain
9. ✅ Configure Cognito user pool
10. ✅ Set up App Runner and Amplify
11. ✅ Configure CloudWatch alarms
12. ✅ Set budget alert at $1,500/month
13. ✅ Enable CloudTrail and Config

---

## Contact & Support

For AWS setup assistance:
- AWS Support (if you have a support plan)
- AWS Solutions Architect (for enterprise accounts)
- Internal IT/Cloud team

---

*Document Version: 1.0*
*Last Updated: February 2026*
