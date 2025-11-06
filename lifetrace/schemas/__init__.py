"""Pydantic 模型定义"""

from lifetrace.schemas.chat import (
    ChatMessage,
    ChatMessageWithContext,
    ChatResponse,
    NewChatRequest,
    NewChatResponse,
)
from lifetrace.schemas.config import ConfigResponse
from lifetrace.schemas.event import EventDetailResponse, EventResponse
from lifetrace.schemas.plan import PlanContent, TodoItem
from lifetrace.schemas.screenshot import ScreenshotResponse
from lifetrace.schemas.search import SearchRequest
from lifetrace.schemas.stats import (
    AppUsageStatsResponse,
    BehaviorStatsResponse,
    DashboardStatsResponse,
    StatisticsResponse,
)
from lifetrace.schemas.system import ProcessInfo, SystemResourcesResponse
from lifetrace.schemas.vector import (
    MultimodalSearchRequest,
    MultimodalSearchResult,
    MultimodalStatsResponse,
    SemanticSearchRequest,
    SemanticSearchResult,
    VectorStatsResponse,
)

__all__ = [
    # Chat
    "ChatMessage",
    "ChatMessageWithContext",
    "ChatResponse",
    "NewChatRequest",
    "NewChatResponse",
    # Config
    "ConfigResponse",
    # Event
    "EventResponse",
    "EventDetailResponse",
    # Plan
    "TodoItem",
    "PlanContent",
    # Screenshot
    "ScreenshotResponse",
    # Search
    "SearchRequest",
    # Stats
    "StatisticsResponse",
    "BehaviorStatsResponse",
    "DashboardStatsResponse",
    "AppUsageStatsResponse",
    # System
    "ProcessInfo",
    "SystemResourcesResponse",
    # Vector
    "SemanticSearchRequest",
    "SemanticSearchResult",
    "MultimodalSearchRequest",
    "MultimodalSearchResult",
    "VectorStatsResponse",
    "MultimodalStatsResponse",
]
