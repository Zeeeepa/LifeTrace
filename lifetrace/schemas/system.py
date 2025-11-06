"""系统资源相关的 Pydantic 模型"""

from datetime import datetime
from typing import Any, Dict, List

from pydantic import BaseModel


class ProcessInfo(BaseModel):
    pid: int
    name: str
    cmdline: str
    memory_mb: float
    memory_vms_mb: float
    cpu_percent: float


class SystemResourcesResponse(BaseModel):
    memory: Dict[str, float]
    cpu: Dict[str, Any]
    disk: Dict[str, Dict[str, float]]
    lifetrace_processes: List[ProcessInfo]
    storage: Dict[str, Any]
    summary: Dict[str, Any]
    timestamp: datetime
