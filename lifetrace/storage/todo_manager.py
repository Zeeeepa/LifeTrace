"""Todo 管理器 - 负责 Todo/Tag/Attachment 相关数据库操作"""

from __future__ import annotations

import contextlib
import json
from typing import TYPE_CHECKING, Any

from sqlalchemy.exc import SQLAlchemyError

from lifetrace.storage.models import Tag, Todo, TodoAttachmentRelation, TodoTagRelation
from lifetrace.storage.sql_utils import col
from lifetrace.storage.todo_manager_attachments import TodoAttachmentMixin
from lifetrace.util.logging_config import get_logger
from lifetrace.util.time_utils import get_utc_now

logger = get_logger()

_UNSET = object()

if TYPE_CHECKING:
    from datetime import datetime

    from lifetrace.storage.database_base import DatabaseBase


def _safe_int_list(value: Any) -> list[int]:
    if value is None:
        return []
    if isinstance(value, list):
        out: list[int] = []
        for item in value:
            with contextlib.suppress(Exception):
                out.append(int(item))
        return out
    # 兼容数据库中存的 JSON 字符串
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return _safe_int_list(parsed)
        except Exception:
            return []
    return []


def _normalize_reminder_offsets(value: Any) -> list[int] | None:
    if value is None:
        return None
    offsets = _safe_int_list(value)
    cleaned = sorted({offset for offset in offsets if offset >= 0})
    return cleaned


def _serialize_reminder_offsets(value: Any) -> str | None:
    normalized = _normalize_reminder_offsets(value)
    if normalized is None:
        return None
    return json.dumps(normalized)


def _normalize_percent(value: Any) -> int:
    if value is None:
        return 0
    try:
        percent = int(value)
    except Exception:
        return 0
    return max(0, min(100, percent))


class TodoManager(TodoAttachmentMixin):
    """Todo 管理类"""

    def __init__(self, db_base: DatabaseBase):
        self.db_base = db_base

    # ========== 查询辅助 ==========
    def _get_todo_tags(self, session, todo_id: int) -> list[str]:
        rows = (
            session.query(col(Tag.tag_name))
            .join(TodoTagRelation, col(TodoTagRelation.tag_id) == col(Tag.id))
            .filter(col(TodoTagRelation.todo_id) == todo_id)
            .all()
        )
        return [r[0] for r in rows if r and r[0]]

    def _todo_to_dict(self, session, todo: Todo) -> dict[str, Any]:
        todo_id = todo.id
        if todo_id is None:
            raise ValueError("Todo must have an id before serialization.")
        return {
            "id": todo_id,
            "uid": getattr(todo, "uid", None),
            "name": todo.name,
            "description": todo.description,
            "user_notes": todo.user_notes,
            "parent_todo_id": todo.parent_todo_id,
            "deadline": todo.deadline,
            "start_time": todo.start_time,
            "end_time": todo.end_time,
            "reminder_offsets": _normalize_reminder_offsets(
                getattr(todo, "reminder_offsets", None)
            ),
            "status": todo.status,
            "priority": todo.priority,
            "completed_at": getattr(todo, "completed_at", None),
            "percent_complete": (
                todo.percent_complete if getattr(todo, "percent_complete", None) is not None else 0
            ),
            "rrule": getattr(todo, "rrule", None),
            "order": getattr(todo, "order", 0),
            "tags": self._get_todo_tags(session, todo_id),
            "attachments": self._get_todo_attachments(session, todo_id),
            "related_activities": _safe_int_list(todo.related_activities),
            "source_type": getattr(todo, "source_type", None),
            "source_key": getattr(todo, "source_key", None),
            "source_date": getattr(todo, "source_date", None),
            "created_at": todo.created_at,
            "updated_at": todo.updated_at,
        }

    def get_todo_context(self, todo_id: int) -> dict[str, Any] | None:
        """获取任务的所有相关上下文（父任务链、同级任务、子任务）"""
        try:
            with self.db_base.get_session() as session:
                # 获取当前任务
                current_todo = session.query(Todo).filter_by(id=todo_id).first()
                if not current_todo:
                    return None

                current_dict = self._todo_to_dict(session, current_todo)

                # 递归向上查找所有父任务
                parents: list[dict[str, Any]] = []
                parent_id = current_todo.parent_todo_id
                visited_parents = set()  # 防止循环引用

                while parent_id is not None and parent_id not in visited_parents:
                    visited_parents.add(parent_id)
                    parent_todo = session.query(Todo).filter_by(id=parent_id).first()
                    if not parent_todo:
                        break
                    parents.append(self._todo_to_dict(session, parent_todo))
                    parent_id = parent_todo.parent_todo_id

                # 查找所有同级任务（相同 parent_todo_id，排除当前任务）
                siblings: list[dict[str, Any]] = []
                if current_todo.parent_todo_id is not None:
                    sibling_todos = (
                        session.query(Todo)
                        .filter(
                            col(Todo.parent_todo_id) == current_todo.parent_todo_id,
                            col(Todo.id) != todo_id,
                        )
                        .all()
                    )
                    siblings = [self._todo_to_dict(session, t) for t in sibling_todos]

                # 递归向下查找所有子任务
                def _get_children_recursive(parent_todo_id: int) -> list[dict[str, Any]]:
                    children: list[dict[str, Any]] = []
                    child_todos = (
                        session.query(Todo).filter(col(Todo.parent_todo_id) == parent_todo_id).all()
                    )
                    for child in child_todos:
                        child_dict = self._todo_to_dict(session, child)
                        # 递归获取子任务的子任务
                        child_dict["children"] = _get_children_recursive(child.id)
                        children.append(child_dict)
                    return children

                children = _get_children_recursive(todo_id)

                return {
                    "current": current_dict,
                    "parents": parents,
                    "siblings": siblings,
                    "children": children,
                }
        except SQLAlchemyError as e:
            logger.error(f"获取 todo 上下文失败: {e}")
            return None

    # ========== CRUD ==========
    def create_todo(  # noqa: PLR0913
        self,
        *,
        name: str,
        description: str | None = None,
        user_notes: str | None = None,
        parent_todo_id: int | None = None,
        deadline: datetime | None = None,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
        reminder_offsets: list[int] | None = None,
        status: str = "active",
        priority: str = "none",
        completed_at: datetime | None = None,
        percent_complete: int | None = None,
        rrule: str | None = None,
        uid: str | None = None,
        order: int = 0,
        tags: list[str] | None = None,
        related_activities: list[int] | None = None,
    ) -> int | None:
        try:
            resolved_percent = (
                _normalize_percent(percent_complete) if percent_complete is not None else None
            )
            if resolved_percent is None:
                resolved_percent = 100 if status == "completed" else 0

            resolved_completed_at = completed_at
            if resolved_completed_at is None and status == "completed":
                resolved_completed_at = get_utc_now()

            cleaned_rrule = (rrule or "").strip() or None
            cleaned_uid = (uid or "").strip() or None

            with self.db_base.get_session() as session:
                todo_kwargs: dict[str, Any] = {
                    "name": name,
                    "description": description,
                    "user_notes": user_notes,
                    "parent_todo_id": parent_todo_id,
                    "deadline": deadline,
                    "start_time": start_time,
                    "end_time": end_time,
                    "reminder_offsets": _serialize_reminder_offsets(reminder_offsets),
                    "status": status,
                    "priority": priority,
                    "completed_at": resolved_completed_at,
                    "percent_complete": resolved_percent,
                    "rrule": cleaned_rrule,
                    "order": order,
                    "related_activities": json.dumps(_safe_int_list(related_activities)),
                }
                if cleaned_uid:
                    todo_kwargs["uid"] = cleaned_uid

                todo = Todo(**todo_kwargs)
                session.add(todo)
                session.flush()

                if tags is not None:
                    if todo.id is None:
                        raise ValueError("Todo must have an id before tagging.")
                    self._set_todo_tags(session, todo.id, tags)

                logger.info(f"创建 todo: {todo.id} - {name}")
                return todo.id
        except SQLAlchemyError as e:
            logger.error(f"创建 todo 失败: {e}")
            return None

    def get_todo(self, todo_id: int) -> dict[str, Any] | None:
        try:
            with self.db_base.get_session() as session:
                todo = session.query(Todo).filter_by(id=todo_id).first()
                if not todo:
                    return None
                return self._todo_to_dict(session, todo)
        except SQLAlchemyError as e:
            logger.error(f"获取 todo 失败: {e}")
            return None

    def get_todo_by_uid(self, uid: str) -> dict[str, Any] | None:
        if not uid:
            return None
        try:
            with self.db_base.get_session() as session:
                todo = session.query(Todo).filter_by(uid=uid).first()
                if not todo:
                    return None
                return self._todo_to_dict(session, todo)
        except SQLAlchemyError as e:
            logger.error(f"根据 uid 获取 todo 失败: {e}")
            return None

    def list_todos(
        self,
        *,
        limit: int = 200,
        offset: int = 0,
        status: str | None = None,
    ) -> list[dict[str, Any]]:
        try:
            with self.db_base.get_session() as session:
                q = session.query(Todo)
                # 默认不返回软删除数据（如果未来使用 deleted_at）
                with contextlib.suppress(Exception):
                    q = q.filter(col(Todo.deleted_at).is_(None))

                if status:
                    q = q.filter(col(Todo.status) == status)

                todos = q.order_by(col(Todo.created_at).desc()).offset(offset).limit(limit).all()
                return [self._todo_to_dict(session, t) for t in todos]
        except SQLAlchemyError as e:
            logger.error(f"列出 todo 失败: {e}")
            return []

    def count_todos(self, *, status: str | None = None) -> int:
        try:
            with self.db_base.get_session() as session:
                q = session.query(Todo)
                with contextlib.suppress(Exception):
                    q = q.filter(col(Todo.deleted_at).is_(None))
                if status:
                    q = q.filter(col(Todo.status) == status)
                return q.count()
        except SQLAlchemyError as e:
            logger.error(f"统计 todo 数量失败: {e}")
            return 0

    def get_active_todos_for_prompt(self, limit: int = 100) -> list[dict[str, Any]]:
        """获取用于提示词的活跃 todo 列表（精简字段）。

        返回的数据适合直接序列化为 JSON 传给 LLM，让模型了解当前已有的待办。
        """
        try:
            with self.db_base.get_session() as session:
                q = session.query(Todo)
                with contextlib.suppress(Exception):
                    q = q.filter(col(Todo.deleted_at).is_(None))

                q = (
                    q.filter(col(Todo.status) == "active")
                    .order_by(col(Todo.created_at).desc())
                    .limit(limit)
                )
                todos = q.all()

                result: list[dict[str, Any]] = []
                for t in todos:
                    result.append(
                        {
                            "id": t.id,
                            "name": t.name,
                            "description": t.description,
                            "deadline": t.deadline.isoformat() if t.deadline else None,
                        }
                    )
                return result
        except SQLAlchemyError as e:
            logger.error(f"获取用于提示词的活跃 todo 列表失败: {e}")
            return []

    def _apply_todo_updates(  # noqa: PLR0913
        self,
        todo: Todo,
        *,
        name: str | Any = _UNSET,
        description: str | Any = _UNSET,
        user_notes: str | Any = _UNSET,
        parent_todo_id: int | None | Any = _UNSET,
        deadline: datetime | None | Any = _UNSET,
        start_time: datetime | None | Any = _UNSET,
        end_time: datetime | None | Any = _UNSET,
        reminder_offsets: list[int] | None | Any = _UNSET,
        status: str | Any = _UNSET,
        priority: str | Any = _UNSET,
        completed_at: datetime | None | Any = _UNSET,
        percent_complete: int | Any = _UNSET,
        rrule: str | None | Any = _UNSET,
        order: int | Any = _UNSET,
        related_activities: list[int] | Any = _UNSET,
    ) -> None:
        """应用待办字段更新"""
        # 使用字典映射来减少复杂度
        if percent_complete is not _UNSET:
            percent_complete = _normalize_percent(percent_complete)
        if rrule is not _UNSET:
            rrule = (rrule or "").strip() or None

        updates = {
            "name": name,
            "description": description,
            "user_notes": user_notes,
            "parent_todo_id": parent_todo_id,
            "deadline": deadline,
            "start_time": start_time,
            "end_time": end_time,
            "status": status,
            "priority": priority,
            "completed_at": completed_at,
            "percent_complete": percent_complete,
            "rrule": rrule,
            "order": order,
        }

        for attr, value in updates.items():
            if value is not _UNSET:
                setattr(todo, attr, value)

        if reminder_offsets is not _UNSET:
            todo.reminder_offsets = _serialize_reminder_offsets(reminder_offsets)

        # 特殊处理 related_activities（需要 JSON 序列化）
        if related_activities is not _UNSET:
            todo.related_activities = json.dumps(_safe_int_list(related_activities))

    def update_todo(  # noqa: PLR0913
        self,
        todo_id: int,
        *,
        name: str | Any = _UNSET,
        description: str | Any = _UNSET,
        user_notes: str | Any = _UNSET,
        parent_todo_id: int | None | Any = _UNSET,
        deadline: datetime | None | Any = _UNSET,
        start_time: datetime | None | Any = _UNSET,
        end_time: datetime | None | Any = _UNSET,
        reminder_offsets: list[int] | None | Any = _UNSET,
        status: str | Any = _UNSET,
        priority: str | Any = _UNSET,
        completed_at: datetime | None | Any = _UNSET,
        percent_complete: int | Any = _UNSET,
        rrule: str | None | Any = _UNSET,
        order: int | Any = _UNSET,
        tags: list[str] | Any = _UNSET,
        related_activities: list[int] | Any = _UNSET,
    ) -> bool:
        try:
            with self.db_base.get_session() as session:
                todo = session.query(Todo).filter_by(id=todo_id).first()
                if not todo:
                    logger.warning(f"todo 不存在: {todo_id}")
                    return False

                resolved_completed_at = completed_at
                resolved_percent = percent_complete

                if status is not _UNSET:
                    if status == "completed":
                        if completed_at is _UNSET:
                            resolved_completed_at = get_utc_now()
                        if percent_complete is _UNSET:
                            resolved_percent = 100
                    else:
                        if completed_at is _UNSET:
                            resolved_completed_at = None
                        if percent_complete is _UNSET:
                            resolved_percent = 0

                self._apply_todo_updates(
                    todo,
                    name=name,
                    description=description,
                    user_notes=user_notes,
                    parent_todo_id=parent_todo_id,
                    deadline=deadline,
                    start_time=start_time,
                    end_time=end_time,
                    reminder_offsets=reminder_offsets,
                    status=status,
                    priority=priority,
                    completed_at=resolved_completed_at,
                    percent_complete=resolved_percent,
                    rrule=rrule,
                    order=order,
                    related_activities=related_activities,
                )

                todo.updated_at = get_utc_now()
                session.flush()

                if tags is not _UNSET:
                    self._set_todo_tags(session, todo_id, tags or [])

                logger.info(f"更新 todo: {todo_id}")
                return True
        except SQLAlchemyError as e:
            logger.error(f"更新 todo 失败: {e}")
            return False

    def _delete_todo_recursive(self, session, todo_id: int) -> None:
        """递归删除 todo 及其所有子任务"""
        # 查找所有子任务
        child_todos = session.query(Todo).filter(col(Todo.parent_todo_id) == todo_id).all()

        # 递归删除所有子任务
        for child in child_todos:
            self._delete_todo_recursive(session, child.id)

        # 清理关联关系（不删除 Tag/Attachment 实体）
        session.query(TodoTagRelation).filter(col(TodoTagRelation.todo_id) == todo_id).delete()
        session.query(TodoAttachmentRelation).filter(
            col(TodoAttachmentRelation.todo_id) == todo_id
        ).delete()

        # 删除 todo 本身
        todo = session.query(Todo).filter_by(id=todo_id).first()
        if todo:
            session.delete(todo)
            logger.info(f"删除 todo: {todo_id}")

    def delete_todo(self, todo_id: int) -> bool:
        try:
            with self.db_base.get_session() as session:
                todo = session.query(Todo).filter_by(id=todo_id).first()
                if not todo:
                    logger.warning(f"todo 不存在: {todo_id}")
                    return False

                # 递归删除 todo 及其所有子任务
                self._delete_todo_recursive(session, todo_id)
                session.flush()
                logger.info(f"删除 todo 及其子任务: {todo_id}")
                return True
        except SQLAlchemyError as e:
            logger.error(f"删除 todo 失败: {e}")
            return False

    # ========== 关系写入 ==========
    def reorder_todos(self, items: list[dict[str, Any]]) -> bool:
        """批量更新待办的排序和父子关系

        Args:
            items: 待办列表，每个元素包含 id, order, 可选 parent_todo_id

        Returns:
            是否全部更新成功
        """
        try:
            with self.db_base.get_session() as session:
                for item in items:
                    todo_id = item.get("id")
                    if not todo_id:
                        continue

                    todo = session.query(Todo).filter_by(id=todo_id).first()
                    if not todo:
                        logger.warning(f"reorder_todos: todo 不存在: {todo_id}")
                        continue

                    # 更新 order
                    if "order" in item:
                        todo.order = item["order"]

                    # 更新 parent_todo_id（如果提供了该字段）
                    if "parent_todo_id" in item:
                        todo.parent_todo_id = item["parent_todo_id"]

                    todo.updated_at = get_utc_now()

                session.flush()
                logger.info(f"批量重排序 {len(items)} 个待办")
                return True
        except SQLAlchemyError as e:
            logger.error(f"批量重排序待办失败: {e}")
            return False

    def _set_todo_tags(self, session, todo_id: int, tags: list[str]) -> None:
        # 清空旧关系
        session.query(TodoTagRelation).filter(col(TodoTagRelation.todo_id) == todo_id).delete()

        # 去重/清洗
        cleaned = []
        seen = set()
        for t in tags:
            name = (t or "").strip()
            if not name:
                continue
            if name in seen:
                continue
            seen.add(name)
            cleaned.append(name)

        for tag_name in cleaned:
            tag = session.query(Tag).filter_by(tag_name=tag_name).first()
            if not tag:
                tag = Tag(tag_name=tag_name)
                session.add(tag)
                session.flush()

            if tag.id is None:
                raise ValueError("Tag must have an id before creating relation.")
            rel = TodoTagRelation(todo_id=todo_id, tag_id=tag.id)
            session.add(rel)
