"""配置相关的 Pydantic 模型"""

from typing import Any, Dict

from pydantic import BaseModel


class ConfigResponse(BaseModel):
    base_dir: str
    screenshots_dir: str
    database_path: str
    server: Dict[str, Any]
    record: Dict[str, Any]
    ocr: Dict[str, Any]
    storage: Dict[str, Any]
