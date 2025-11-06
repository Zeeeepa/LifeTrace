"""向量数据库相关的 Pydantic 模型"""

from typing import Any, Dict, Optional

from pydantic import BaseModel


class SemanticSearchRequest(BaseModel):
    query: str
    top_k: int = 10
    use_rerank: bool = True
    retrieve_k: Optional[int] = None
    filters: Optional[Dict[str, Any]] = None


class SemanticSearchResult(BaseModel):
    text: str
    score: float
    metadata: Dict[str, Any]
    ocr_result: Optional[Dict[str, Any]] = None
    screenshot: Optional[Dict[str, Any]] = None


class MultimodalSearchRequest(BaseModel):
    query: str
    top_k: int = 10
    text_weight: Optional[float] = None
    image_weight: Optional[float] = None
    filters: Optional[Dict[str, Any]] = None


class MultimodalSearchResult(BaseModel):
    text: str
    combined_score: float
    text_score: float
    image_score: float
    text_weight: float
    image_weight: float
    metadata: Dict[str, Any]
    ocr_result: Optional[Dict[str, Any]] = None
    screenshot: Optional[Dict[str, Any]] = None


class VectorStatsResponse(BaseModel):
    enabled: bool
    collection_name: Optional[str] = None
    document_count: Optional[int] = None
    error: Optional[str] = None


class MultimodalStatsResponse(BaseModel):
    enabled: bool
    multimodal_available: bool
    text_weight: float
    image_weight: float
    text_database: Dict[str, Any]
    image_database: Dict[str, Any]
    error: Optional[str] = None
