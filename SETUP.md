# RiskMind — VM Setup Guide

Complete instructions to get RiskMind running on a fresh VM. Designed for a VS Code agent or developer to follow step by step.

## Prerequisites

- **OS:** Ubuntu 22.04+ / Windows Server 2022+ / any Linux with bash
- **Python:** 3.10+
- **Node.js:** 18+ (with npm)
- **Git:** installed
- **Ports:** 8000 (backend), 5173 (frontend) must be open

## Step 1: Clone the Repository

```bash
git clone https://github.com/Sameet1308/RiskMindDatabot.git
cd RiskMindDatabot
```

## Step 2: Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Linux/Mac:
source venv/bin/activate
# Windows:
# venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### Environment Variables

Create `backend/.env` with your LLM API keys (at minimum one provider):

```env
# Gemini (FREE tier — recommended for MVP)
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.0-flash

# Claude (optional)
ANTHROPIC_API_KEY=your_anthropic_key_here

# OpenAI (optional)
OPENAI_API_KEY=your_openai_key_here

# AWS Bedrock (optional)
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_DEFAULT_REGION=us-east-1
```

At least one LLM key is required. The system has a fallback chain: Claude → Gemini → OpenAI → Mock template. If no keys are set, it falls back to mock responses (data still works, just no AI narrative).

### Seed the Database

```bash
# From backend/ directory, with venv activated
python seed_data.py
```

This creates `riskmind.db` with sample data:
- 21 policies across 7 industries
- 55 claims linked to policies
- 2 users (sarah@apexuw.com, james@apexuw.com)
- Underwriting guidelines
- Sample decisions

### Start the Backend

```bash
# From backend/ directory
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Verify: `curl http://localhost:8000/api/dashboard/data` should return JSON.

## Step 3: Frontend Setup

```bash
# From project root
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev -- --host 0.0.0.0 --port 5173
```

Verify: Open `http://<VM_IP>:5173` in a browser.

### For Production Build

```bash
cd frontend
npm run build

# Serve the built files (using any static server)
npx serve dist -l 5173
```

## Step 4: Verify Everything Works

1. **Backend health:** `curl http://localhost:8000/docs` — should show FastAPI Swagger UI
2. **Frontend loads:** Open `http://<VM_IP>:5173` — should show login page
3. **Login:** Use `sarah@apexuw.com` / `sarah123` or `james@apexuw.com` / `james123`
4. **Chat works:** Type "Show me my portfolio summary" — should get AI response
5. **Analytics:** Navigate to Analytics tab — select dimensions/metrics, click Run Query
6. **Workbench:** Navigate to Workbench tab — should show 5 tabs with data

## Running as Background Services

### Option A: Using systemd (Linux)

Create `/etc/systemd/system/riskmind-backend.service`:

```ini
[Unit]
Description=RiskMind Backend
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/RiskMindDatabot/backend
Environment="PATH=/home/ubuntu/RiskMindDatabot/backend/venv/bin"
ExecStart=/home/ubuntu/RiskMindDatabot/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Create `/etc/systemd/system/riskmind-frontend.service`:

```ini
[Unit]
Description=RiskMind Frontend
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/RiskMindDatabot/frontend
ExecStart=/usr/bin/npx serve dist -l 5173
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable riskmind-backend riskmind-frontend
sudo systemctl start riskmind-backend riskmind-frontend
```

### Option B: Using PM2 (simpler)

```bash
npm install -g pm2

# Backend
cd backend
pm2 start "uvicorn main:app --host 0.0.0.0 --port 8000" --name riskmind-backend

# Frontend (after npm run build)
cd frontend
pm2 start "npx serve dist -l 5173" --name riskmind-frontend

# Save and auto-start on reboot
pm2 save
pm2 startup
```

### Option C: Using Docker (if Docker is available)

Not yet dockerized. Use Option A or B above.

## Nginx Reverse Proxy (Optional)

If you want both services behind a single domain:

```nginx
server {
    listen 80;
    server_name riskmind.yourdomain.com;

    # Frontend
    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Firewall Rules

```bash
# If using ufw (Ubuntu)
sudo ufw allow 8000/tcp   # Backend API
sudo ufw allow 5173/tcp   # Frontend
sudo ufw allow 80/tcp     # Nginx (if using reverse proxy)
```

## Troubleshooting

| Issue | Fix |
|---|---|
| `ModuleNotFoundError` in backend | Activate venv: `source venv/bin/activate` |
| Frontend shows blank page | Check if backend is running: `curl localhost:8000/docs` |
| Login fails | Run `python seed_data.py` to create users |
| No AI responses (just data) | Check `.env` has at least one valid LLM API key |
| Port already in use | Kill existing: `lsof -i :8000` then `kill <PID>` |
| ChromaDB errors | Delete `chroma_db/` folder and restart backend |
| CORS errors in browser | Backend already allows all origins — check port numbers |

## Tech Stack Summary

| Component | Technology | Port |
|---|---|---|
| Backend API | FastAPI + SQLite + ChromaDB | 8000 |
| Frontend | React 19 + TypeScript + Vite | 5173 |
| AI Pipeline | LangGraph + LangChain | — |
| Vector Store | ChromaDB (embedded) | — |
| Database | SQLite (file: riskmind.db) | — |

## Login Credentials

| User | Email | Password | Role | Policies |
|---|---|---|---|---|
| Sarah Mitchell | sarah@apexuw.com | sarah123 | Senior Underwriter | 10 |
| James Cooper | james@apexuw.com | james123 | Underwriter | 11 |
