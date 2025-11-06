"""截图相关的 Pydantic 模型"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ScreenshotResponse(BaseModel):
    id: int
    file_path: str
    app_name: Optional[str]
    window_title: Optional[str]
    created_at: datetime
    text_content: Optional[str]
    width: int
    height: int
