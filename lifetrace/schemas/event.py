"""事件相关的 Pydantic 模型"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel

from lifetrace.schemas.screenshot import ScreenshotResponse


class EventResponse(BaseModel):
    id: int
    app_name: Optional[str]
    window_title: Optional[str]
    start_time: datetime
    end_time: Optional[datetime]
    screenshot_count: int
    first_screenshot_id: Optional[int]
    ai_title: Optional[str] = None
    ai_summary: Optional[str] = None


class EventDetailResponse(BaseModel):
    id: int
    app_name: Optional[str]
    window_title: Optional[str]
    start_time: datetime
    end_time: Optional[datetime]
    screenshots: List[ScreenshotResponse]
    ai_title: Optional[str] = None
    ai_summary: Optional[str] = None


class EventListResponse(BaseModel):
    """事件列表响应，包含事件列表和总数"""
    events: List[EventResponse]
    total_count: int

    class Config:
        from_attributes = True
