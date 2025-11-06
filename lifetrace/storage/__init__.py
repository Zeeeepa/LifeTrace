"""
存储模块
包含数据库管理和数据模型
"""

from .database import DatabaseManager, db_manager
from .models import (
    Base,
    Event,
    Screenshot,
    OCRResult,
    SearchIndex,
    ProcessingQueue,
    UserBehaviorStats,
    AppUsageLog,
    DailyStats,
)

__all__ = [
    "DatabaseManager",
    "db_manager",
    "Base",
    "Event",
    "Screenshot",
    "OCRResult",
    "SearchIndex",
    "ProcessingQueue",
    "UserBehaviorStats",
    "AppUsageLog",
    "DailyStats",
]
