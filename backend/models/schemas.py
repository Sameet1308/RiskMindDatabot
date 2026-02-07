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
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    policy = relationship("Policy", back_populates="claims")


class Guideline(Base):
    __tablename__ = "guidelines"
    
    id = Column(Integer, primary_key=True, index=True)
    section_code = Column(String(50), index=True)
    title = Column(String(200))
    content = Column(Text)
    category = Column(String(100))
    threshold_type = Column(String(50))
    threshold_value = Column(Float, nullable=True)
    action = Column(String(100))


# Pydantic Schemas for API
class ClaimBase(BaseModel):
    claim_number: str
    claim_date: datetime
    claim_amount: float
    claim_type: str
    status: str
    description: Optional[str] = None

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
