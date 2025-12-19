"""FastAPI 依赖注入模块

提供数据库会话和服务层的依赖注入工厂函数。
"""

from collections.abc import Generator

from fastapi import Depends
from sqlalchemy.orm import Session

from lifetrace.repositories.interfaces import ITodoRepository
from lifetrace.repositories.sql_todo_repository import SqlTodoRepository
from lifetrace.services.todo_service import TodoService
from lifetrace.storage.database import db_base
from lifetrace.storage.database_base import DatabaseBase


def get_db_base() -> DatabaseBase:
    """获取数据库基础实例（复用 storage 模块的单例）"""
    return db_base


def get_db_session(
    db_base: DatabaseBase = Depends(get_db_base),
) -> Generator[Session]:
    """获取数据库会话 - 请求级别生命周期"""
    session = db_base.SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


# ========== Todo 模块依赖注入 ==========


def get_todo_repository(
    db_base: DatabaseBase = Depends(get_db_base),
) -> ITodoRepository:
    """获取 Todo 仓库实例"""
    return SqlTodoRepository(db_base)


def get_todo_service(
    repo: ITodoRepository = Depends(get_todo_repository),
) -> TodoService:
    """获取 Todo 服务实例"""
    return TodoService(repo)


# ========== 延迟加载服务 ==========


def get_vector_service():
    """获取向量服务（延迟加载）"""
    from lifetrace.core.lazy_services import get_vector_service as lazy_get

    return lazy_get()


def get_rag_service():
    """获取 RAG 服务（延迟加载）"""
    from lifetrace.core.lazy_services import get_rag_service as lazy_get

    return lazy_get()
