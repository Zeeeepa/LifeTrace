"""聊天相关的 Pydantic 模型"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class ChatMessage(BaseModel):
    message: str


class ChatMessageWithContext(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    event_context: Optional[List[Dict[str, Any]]] = None  # 新增事件上下文


class ChatResponse(BaseModel):
    response: str
    timestamp: datetime
    query_info: Optional[Dict[str, Any]] = None
    retrieval_info: Optional[Dict[str, Any]] = None
    performance: Optional[Dict[str, Any]] = None
    session_id: Optional[str] = None


class NewChatRequest(BaseModel):
    session_id: Optional[str] = None


class NewChatResponse(BaseModel):
    session_id: str
    message: str
    timestamp: datetime
