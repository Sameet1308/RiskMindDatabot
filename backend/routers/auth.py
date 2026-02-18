"""
Auth Router - Login endpoint for RiskMind
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from datetime import datetime
import hashlib

from database.connection import get_db

router = APIRouter()


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    email: str
    full_name: str
    role: str
    assigned_policies: list[str]


@router.post("/login", response_model=LoginResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate user and return profile with assigned policies."""
    result = await db.execute(
        text("SELECT id, email, hashed_password, full_name, role, is_active FROM users WHERE email = :email"),
        {"email": req.email.strip().lower()},
    )
    user = result.fetchone()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    uid, email, stored_hash, full_name, role, is_active = user

    if not is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    if hash_password(req.password) != stored_hash:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Update last_login
    await db.execute(
        text("UPDATE users SET last_login = :now WHERE id = :uid"),
        {"now": datetime.utcnow().isoformat(), "uid": uid},
    )
    await db.commit()

    # Fetch assigned policies
    result = await db.execute(
        text("SELECT policy_number FROM policies WHERE assigned_to = :email ORDER BY policy_number"),
        {"email": email},
    )
    policies = [row[0] for row in result.fetchall()]

    return LoginResponse(email=email, full_name=full_name, role=role, assigned_policies=policies)
