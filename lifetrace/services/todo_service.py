"""Todo 业务逻辑层

处理 Todo 相关的业务逻辑，与数据访问层解耦。
"""

from typing import Any

from fastapi import HTTPException

from lifetrace.repositories.interfaces import ITodoRepository
from lifetrace.schemas.todo import TodoAttachmentResponse, TodoCreate, TodoResponse, TodoUpdate
from lifetrace.storage.notification_storage import (
    clear_dismissed_mark,
    clear_notification_by_todo_id,
)
from lifetrace.util.logging_config import get_logger

logger = get_logger()


class TodoService:
    """Todo 业务逻辑层"""

    def __init__(self, repository: ITodoRepository):
        self.repository = repository

    def get_todo(self, todo_id: int) -> TodoResponse:
        """获取单个 Todo"""
        todo = self.repository.get_by_id(todo_id)
        if not todo:
            raise HTTPException(status_code=404, detail="todo 不存在")
        return TodoResponse(**todo)

    def get_todo_by_uid(self, uid: str) -> TodoResponse | None:
        """根据 UID 获取单个 Todo"""
        todo = self.repository.get_by_uid(uid)
        return TodoResponse(**todo) if todo else None

    def list_todos(self, limit: int, offset: int, status: str | None) -> dict[str, Any]:
        """获取 Todo 列表"""
        todos = self.repository.list_todos(limit, offset, status)
        total = self.repository.count(status)
        return {"total": total, "todos": [TodoResponse(**t) for t in todos]}

    def create_todo(self, data: TodoCreate) -> TodoResponse:
        """创建 Todo"""
        start_time = data.start_time
        deadline = data.deadline
        if start_time is None and deadline is not None:
            start_time = deadline
            deadline = None
        todo_id = self.repository.create(
            uid=data.uid,
            name=data.name,
            description=data.description,
            user_notes=data.user_notes,
            parent_todo_id=data.parent_todo_id,
            deadline=deadline,
            start_time=start_time,
            end_time=data.end_time,
            time_zone=data.time_zone,
            is_all_day=data.is_all_day,
            reminder_offsets=data.reminder_offsets,
            status=data.status.value if data.status else "active",
            priority=data.priority.value if data.priority else "none",
            completed_at=data.completed_at,
            percent_complete=data.percent_complete,
            rrule=data.rrule,
            order=data.order,
            tags=data.tags,
            related_activities=data.related_activities,
        )
        if not todo_id:
            raise HTTPException(status_code=500, detail="创建 todo 失败")

        return self.get_todo(todo_id)

    def update_todo(self, todo_id: int, data: TodoUpdate) -> TodoResponse:
        """更新 Todo"""
        # 检查是否存在
        if not self.repository.get_by_id(todo_id):
            raise HTTPException(status_code=404, detail="todo 不存在")

        # 提取有效字段（只更新请求中携带的字段）
        fields_set = (
            getattr(data, "model_fields_set", None)
            or getattr(data, "__fields_set__", None)
            or set()
        )
        kwargs = {field: getattr(data, field) for field in fields_set}

        # 枚举转字符串
        if "status" in kwargs and kwargs["status"] is not None:
            kwargs["status"] = kwargs["status"].value
        if "priority" in kwargs and kwargs["priority"] is not None:
            kwargs["priority"] = kwargs["priority"].value

        if "deadline" in kwargs:
            if "start_time" not in kwargs:
                kwargs["start_time"] = kwargs["deadline"]
            kwargs.pop("deadline", None)

        if not self.repository.update(todo_id, **kwargs):
            raise HTTPException(status_code=500, detail="更新 todo 失败")

        if "start_time" in fields_set or "reminder_offsets" in fields_set:
            clear_notification_by_todo_id(todo_id)
            clear_dismissed_mark(todo_id)

        return self.get_todo(todo_id)

    def delete_todo(self, todo_id: int) -> None:
        """删除 Todo"""
        if not self.repository.get_by_id(todo_id):
            raise HTTPException(status_code=404, detail="todo 不存在")
        if not self.repository.delete(todo_id):
            raise HTTPException(status_code=500, detail="删除 todo 失败")

    def reorder_todos(self, items: list[dict[str, Any]]) -> dict[str, Any]:
        """批量重排序 Todo"""
        if not self.repository.reorder(items):
            raise HTTPException(status_code=500, detail="批量重排序失败")
        return {"success": True, "message": f"成功更新 {len(items)} 个待办的排序"}

    def add_attachment(
        self,
        *,
        todo_id: int,
        file_name: str,
        file_path: str,
        file_size: int | None,
        mime_type: str | None,
        file_hash: str | None,
        source: str = "user",
    ) -> TodoAttachmentResponse:
        if not self.repository.get_by_id(todo_id):
            raise HTTPException(status_code=404, detail="todo 不存在")

        attachment = self.repository.add_attachment(
            todo_id=todo_id,
            file_name=file_name,
            file_path=file_path,
            file_size=file_size,
            mime_type=mime_type,
            file_hash=file_hash,
            source=source,
        )
        if not attachment:
            raise HTTPException(status_code=500, detail="创建附件失败")

        return TodoAttachmentResponse(**attachment)

    def remove_attachment(self, *, todo_id: int, attachment_id: int) -> None:
        if not self.repository.get_by_id(todo_id):
            raise HTTPException(status_code=404, detail="todo 不存在")
        if not self.repository.remove_attachment(todo_id=todo_id, attachment_id=attachment_id):
            raise HTTPException(status_code=404, detail="附件不存在或已解绑")

    def get_attachment(self, attachment_id: int) -> dict[str, Any]:
        attachment = self.repository.get_attachment(attachment_id)
        if not attachment:
            raise HTTPException(status_code=404, detail="附件不存在")
        return attachment
