"""
Storage 模块

提供数据库管理和模型定义。

注意：
- 该包在导入时**不应**执行数据库初始化/迁移等副作用操作。
- 需要访问 `db_base` / `*_mgr` 等对象时，采用懒加载，避免在 Alembic 迁移环境中
  （`lifetrace/migrations/env.py`）导入模型时触发递归迁移。
"""

from __future__ import annotations

import importlib

__all__ = [
    # 各个功能管理器（由 lifetrace.storage.database 初始化）
    "screenshot_mgr",
    "event_mgr",
    "ocr_mgr",
    "todo_mgr",
    "chat_mgr",
    "stats_mgr",
    "journal_mgr",
    "activity_mgr",
    # 数据库基础
    "db_base",
    "get_session",
    "get_db",
]

_LAZY_EXPORTS: set[str] = set(__all__)


def __getattr__(name: str):
    if name in _LAZY_EXPORTS:
        # 仅在真正需要时才触发数据库初始化
        _database = importlib.import_module("lifetrace.storage.database")
        return getattr(_database, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


def __dir__() -> list[str]:
    return sorted(set(globals().keys()) | _LAZY_EXPORTS)
