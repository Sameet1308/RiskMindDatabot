"""
Database models and Pydantic schemas
"""
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from database.connection import Base


# SQLAlchemy Models
class Policy(Base):
    __tablename__ = "policies"

    id = Column(Integer, primary_key=True, index=True)
    policy_number = Column(String(50), unique=True, index=True)
    policyholder_name = Column(String(200))
    industry_type = Column(String(100))
    effective_date = Column(DateTime)
    expiration_date = Column(DateTime)
    premium = Column(Float)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    assigned_to = Column(String(255), nullable=True, index=True)  # user email
    created_at = Column(DateTime, default=datetime.utcnow)

    claims = relationship("ClaimRecord", back_populates="policy")


class ClaimRecord(Base):
    __tablename__ = "claims"
    
    id = Column(Integer, primary_key=True, index=True)
    claim_number = Column(String(50), unique=True, index=True)
    policy_id = Column(Integer, ForeignKey("policies.id"))
    claim_date = Column(DateTime)
    claim_amount = Column(Float)
    claim_type = Column(String(100))
    status = Column(String(50))
    status = Column(String(50))
    description = Column(Text)
    evidence_files = Column(Text, nullable=True)  # JSON string: [{"type": "image", "url": "...", "description": "..."}]
    created_at = Column(DateTime, default=datetime.utcnow)
    
    policy = relationship("Policy", back_populates="claims")


class Guideline(Base):
    __tablename__ = "guidelines"
    
    id = Column(Integer, primary_key=True, index=True)
    section_code = Column(String(50), index=True)
    title = Column(String(200))
    content = Column(Text)
    category = Column(String(100))
    policy_number = Column(String(50), nullable=True, index=True)
    threshold_type = Column(String(50))
    threshold_value = Column(Float, nullable=True)
    action = Column(String(100))


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(200), nullable=False)
    role = Column(String(50), default="underwriter")  # underwriter, senior_underwriter, admin
    is_active = Column(Integer, default=1)  # 1=active, 0=deactivated
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)


class Decision(Base):
    __tablename__ = "decisions"

    id = Column(Integer, primary_key=True, index=True)
    policy_number = Column(String(50), index=True, nullable=False)
    decision = Column(String(50), nullable=False)  # accept, refer, decline
    reason = Column(Text, nullable=True)
    risk_level = Column(String(50), nullable=True)
    decided_by = Column(String(200), default="demo_user")
    created_at = Column(DateTime, default=datetime.utcnow)


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_email = Column(String(255), index=True, nullable=False)
    title = Column(String(500), default="New Chat")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("chat_sessions.id"), nullable=False, index=True)
    role = Column(String(20), nullable=False)  # user, assistant
    content = Column(Text, nullable=False)
    file_url = Column(String(500), nullable=True)  # attached file URL
    sources = Column(Text, nullable=True)  # JSON string of source citations
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("ChatSession", back_populates="messages")


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(500), nullable=False)
    file_path = Column(String(1000), nullable=False)
    file_type = Column(String(50), nullable=False)  # pdf, image, doc
    file_size = Column(Integer, default=0)
    uploaded_by = Column(String(255), default="demo_user")
    analysis_summary = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


# Pydantic Schemas for API
class ClaimBase(BaseModel):
    claim_number: str
    claim_date: datetime
    claim_amount: float
    claim_type: str
    status: str
    status: str
    description: Optional[str] = None
    evidence_files: Optional[str] = None

class ClaimResponse(ClaimBase):
    id: int
    policy_id: int
    
    class Config:
        from_attributes = True


class PolicyBase(BaseModel):
    policy_number: str
    policyholder_name: str
    industry_type: str
    premium: float

class PolicyResponse(PolicyBase):
    id: int
    claims: List[ClaimResponse] = []
    
    class Config:
        from_attributes = True


class AnalysisRequest(BaseModel):
    policy_number: str


class GlassBoxEvidence(BaseModel):
    sql_query: str
    data_returned: dict
    guideline_citation: Optional[str] = None
    guideline_section: Optional[str] = None


class AnalysisResponse(BaseModel):
    recommendation: str
    risk_level: str  # "low", "medium", "high", "refer"
    reason: str
    evidence: GlassBoxEvidence
    claims_summary: dict
