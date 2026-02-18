"""
Analytics Playground API — meta / query / filter-values endpoints.
Uses the pandas-based AnalyticsEngine singleton (no async DB needed).
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Any, Dict, List, Optional

from services.analytics_service import AnalyticsEngine

router = APIRouter()


class AnalyticsQueryRequest(BaseModel):
    dimensions: List[str]
    metrics: List[str]
    filters: Optional[List[Dict[str, Any]]] = None
    user_email: Optional[str] = None


@router.get("/meta")
def analytics_meta():
    return AnalyticsEngine.get_meta()


@router.post("/query")
def analytics_query(req: AnalyticsQueryRequest):
    return AnalyticsEngine.query(
        dimensions=req.dimensions,
        metrics=req.metrics,
        filters=req.filters,
        user_email=req.user_email,
    )


@router.get("/filter-values/{field}")
def analytics_filter_values(field: str):
    return AnalyticsEngine.get_filter_values(field)
