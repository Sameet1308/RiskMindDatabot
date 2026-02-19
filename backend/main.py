"""
RiskMind API - Underwriting Co-Pilot Backend
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
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
from routers.auth import router as auth_router
from routers.analytics import router as analytics_router
from routers.data import router as data_router
from database.connection import init_db, get_db, async_session

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize database
    await init_db()
    print("[OK] Database initialized")

    # Index guidelines + claims + decisions + documents into ChromaDB
    try:
        from services.vector_store import index_guidelines, index_claims_and_decisions, index_documents
        async with async_session() as session:
            count = await index_guidelines(session)
            print(f"[OK] ChromaDB: {count} guidelines indexed")
        async with async_session() as session:
            n_claims, n_decisions = await index_claims_and_decisions(session)
            print(f"[OK] ChromaDB: {n_claims} claims + {n_decisions} decisions indexed")
        async with async_session() as session:
            n_docs = await index_documents(session)
            if n_docs:
                print(f"[OK] ChromaDB: {n_docs} documents indexed")
    except Exception as e:
        print(f"[WARN] ChromaDB indexing skipped: {e}")

    # Pre-warm analytics engine
    try:
        from services.analytics_service import AnalyticsEngine
        AnalyticsEngine.load()
    except Exception as e:
        print(f"[WARN] Analytics engine skipped: {e}")

    api_key_g = os.getenv("GOOGLE_API_KEY", "")
    api_key_o = os.getenv("OPENAI_API_KEY", "")
    if api_key_g and api_key_g != "your-google-api-key-here":
        gemini_model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash-lite")
        print(f"[LLM] Google Gemini ({gemini_model}) — FREE tier")
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
    allow_origins=["*"],
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
app.include_router(auth_router, prefix="/api/auth", tags=["Auth"])
app.include_router(analytics_router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(data_router, prefix="/api/data", tags=["Data"])

@app.get("/health")
async def health_check():
    gemini_key = os.getenv("GOOGLE_API_KEY", "")
    openai_key = os.getenv("OPENAI_API_KEY", "")
    anthropic_key = os.getenv("ANTHROPIC_API_KEY", "")
    llm_active = (
        bool(gemini_key and gemini_key != "your-google-api-key-here") or
        bool(openai_key and openai_key != "your-openai-api-key-here") or
        bool(anthropic_key and anthropic_key != "your-anthropic-api-key-here")
    )
    return {
        "status": "healthy",
        "llm_active": llm_active,
        "model": os.getenv("GEMINI_MODEL", "gemini-2.0-flash"),
        "environment": os.getenv("APP_ENV", "development")
    }

# ── Serve React frontend in production ──
# In production, /app/static contains the built React app.
# All non-API routes serve index.html for SPA client-side routing.
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(STATIC_DIR):
    # Serve static assets (JS, CSS, images)
    app.mount("/assets", StaticFiles(directory=os.path.join(STATIC_DIR, "assets")), name="static-assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # Try to serve the exact file (e.g. favicon.ico, manifest.json)
        file_path = os.path.join(STATIC_DIR, full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)
        # Fallback to index.html for SPA routing
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))
else:
    # Dev mode — frontend served by Vite dev server
    @app.get("/")
    async def root():
        return {
            "message": "Welcome to RiskMind API",
            "version": "3.0.0",
            "docs": "/docs",
            "health": "/health"
        }
