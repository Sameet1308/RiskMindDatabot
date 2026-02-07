"""
RiskMind API - Underwriting Co-Pilot Backend
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv

from routers import claims, analysis, guidelines
from database.connection import init_db

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize database
    await init_db()
    print("✅ Database initialized")
    yield
    # Shutdown
    print("👋 Shutting down...")

app = FastAPI(
    title="RiskMind API",
    description="Underwriting Co-Pilot with Glass Box Explainability",
    version="1.0.0",
    lifespan=lifespan
)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(claims.router, prefix="/api/claims", tags=["Claims"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["Analysis"])
app.include_router(guidelines.router, prefix="/api/guidelines", tags=["Guidelines"])

@app.get("/")
async def root():
    return {
        "message": "Welcome to RiskMind API",
        "docs": "/docs",
        "health": "/health"
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "llm_provider": os.getenv("LLM_PROVIDER", "mock"),
        "environment": os.getenv("APP_ENV", "development")
    }
