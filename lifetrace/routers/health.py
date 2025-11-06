"""健康检查路由"""

from datetime import datetime

from fastapi import APIRouter

from lifetrace.routers import dependencies as deps

router = APIRouter()


@router.get("/health")
async def health_check():
    """健康检查"""
    return {
        "status": "healthy",
        "timestamp": datetime.now(),
        "database": "connected" if deps.db_manager.engine else "disconnected",
        "ocr": "available" if deps.ocr_processor.is_available() else "unavailable",
    }
