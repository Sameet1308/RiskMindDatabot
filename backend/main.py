"""
RiskMind API - Underwriting Co-Pilot Backend
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv

load_dotenv()

from routers import claims, analysis, guidelines
from routers.chat import router as chat_router
from routers.alerts import router as alerts_router
from routers.memo import router as memo_router
from routers.policies import router as policies_router
from routers.decisions import router as decisions_router
from routers.dashboard import router as dashboard_router
from database.connection import init_db, get_db, async_session

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize database
    await init_db()
    print("[OK] Database initialized")

    # Index guidelines + claims + decisions into ChromaDB
    try:
        from services.vector_store import index_guidelines, index_claims_and_decisions
        async with async_session() as session:
            count = await index_guidelines(session)
            print(f"[OK] ChromaDB: {count} guidelines indexed")
        async with async_session() as session:
            n_claims, n_decisions = await index_claims_and_decisions(session)
            print(f"[OK] ChromaDB: {n_claims} claims + {n_decisions} decisions indexed")
    except Exception as e:
        print(f"[WARN] ChromaDB indexing skipped: {e}")

    api_key_g = os.getenv("GOOGLE_API_KEY", "")
    api_key_o = os.getenv("OPENAI_API_KEY", "")
    if api_key_g and api_key_g != "your-google-api-key-here":
        print("[LLM] Google Gemini 2.0 Flash (FREE)")
    elif api_key_o and api_key_o != "your-openai-api-key-here":
        print("[LLM] OpenAI GPT-4o-mini (paid)")
    else:
        print("[LLM] Smart mock (no API key - set GOOGLE_API_KEY for free AI)")

    yield
    print("[OK] Shutting down...")

# Ensure upload directory exists
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "data", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

app = FastAPI(
    title="RiskMind API",
    description="Underwriting Co-Pilot with Glass Box Explainability",
    version="3.0.0",
    lifespan=lifespan
)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://localhost:5175", "http://localhost:5176", "http://localhost:5177"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded files
app.mount("/api/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Include routers
app.include_router(claims.router, prefix="/api/claims", tags=["Claims"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["Analysis"])
app.include_router(guidelines.router, prefix="/api/guidelines", tags=["Guidelines"])
app.include_router(chat_router, prefix="/api/chat", tags=["Chat"])
app.include_router(alerts_router, prefix="/api/alerts", tags=["Alerts"])
app.include_router(memo_router, prefix="/api/memo", tags=["Memo"])
app.include_router(policies_router, prefix="/api/policies", tags=["Policies"])
app.include_router(decisions_router, prefix="/api/decisions", tags=["Decisions"])
app.include_router(dashboard_router, prefix="/api/dashboard", tags=["Dashboard"])

@app.get("/")
async def root():
    return {
        "message": "Welcome to RiskMind API",
        "version": "3.0.0",
        "docs": "/docs",
        "health": "/health"
    }

@app.get("/health")
async def health_check():
    api_key = os.getenv("OPENAI_API_KEY", "")
    return {
        "status": "healthy",
        "llm_active": bool(api_key and api_key != "your-openai-api-key-here"),
        "environment": os.getenv("APP_ENV", "development")
    }
