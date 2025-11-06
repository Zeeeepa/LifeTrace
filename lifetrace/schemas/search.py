"""搜索相关的 Pydantic 模型"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class SearchRequest(BaseModel):
    query: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    app_name: Optional[str] = None
    limit: int = 50
