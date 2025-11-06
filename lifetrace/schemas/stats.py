"""统计相关的 Pydantic 模型"""

from typing import Any, Dict, List

from pydantic import BaseModel


class StatisticsResponse(BaseModel):
    total_screenshots: int
    processed_screenshots: int
    pending_tasks: int
    today_screenshots: int
    processing_rate: float


class BehaviorStatsResponse(BaseModel):
    behavior_records: List[Dict[str, Any]]
    daily_stats: List[Dict[str, Any]]
    action_distribution: Dict[str, int]
    hourly_activity: Dict[int, int]
    total_records: int


class DashboardStatsResponse(BaseModel):
    today_activity: Dict[str, int]
    weekly_trend: List[Dict[str, Any]]
    top_actions: List[Dict[str, Any]]
    performance_metrics: Dict[str, float]


class AppUsageStatsResponse(BaseModel):
    app_usage_summary: List[Dict[str, Any]]
    daily_app_usage: List[Dict[str, Any]]
    hourly_app_distribution: Dict[int, Dict[str, int]]
    top_apps_by_time: List[Dict[str, Any]]
    app_switching_patterns: List[Dict[str, Any]]
    total_apps_used: int
    total_usage_time: float

    class Config:
        arbitrary_types_allowed = True
