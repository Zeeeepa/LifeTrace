"""Todo 管理相关路由（面向 free-todo-frontend）"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Path, Query

from lifetrace.schemas.todo import TodoCreate, TodoListResponse, TodoResponse, TodoUpdate
from lifetrace.storage import todo_mgr
from lifetrace.util.logging_config import get_logger

logger = get_logger()

router = APIRouter(prefix="/api/todos", tags=["todos"])


@router.get("", response_model=TodoListResponse)
async def list_todos(
    limit: int = Query(200, ge=1, le=2000, description="返回数量限制"),
    offset: int = Query(0, ge=0, description="偏移量"),
    status: str | None = Query(None, description="状态筛选：active/completed/canceled"),
):
    try:
        todos = todo_mgr.list_todos(limit=limit, offset=offset, status=status)
        total = todo_mgr.count_todos(status=status)
        return TodoListResponse(total=total, todos=[TodoResponse(**t) for t in todos])
    except Exception as e:
        logger.error(f"获取 todo 列表失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"获取 todo 列表失败: {str(e)}") from e


@router.post("", response_model=TodoResponse, status_code=201)
async def create_todo(todo: TodoCreate):
    try:
        todo_id = todo_mgr.create_todo(
            name=todo.name,
            description=todo.description,
            user_notes=todo.user_notes,
            parent_todo_id=todo.parent_todo_id,
            deadline=todo.deadline,
            start_time=todo.start_time,
            status=todo.status.value if todo.status else "active",
            priority=todo.priority.value if todo.priority else "none",
            order=todo.order,
            tags=todo.tags,
            related_activities=todo.related_activities,
        )
        if not todo_id:
            raise HTTPException(status_code=500, detail="创建 todo 失败")
        created = todo_mgr.get_todo(todo_id)
        if not created:
            raise HTTPException(status_code=500, detail="获取创建的 todo 失败")
        return TodoResponse(**created)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"创建 todo 失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"创建 todo 失败: {str(e)}") from e


@router.get("/{todo_id}", response_model=TodoResponse)
async def get_todo(todo_id: int = Path(..., description="Todo ID")):
    todo = todo_mgr.get_todo(todo_id)
    if not todo:
        raise HTTPException(status_code=404, detail="todo 不存在")
    return TodoResponse(**todo)


@router.put("/{todo_id}", response_model=TodoResponse)
async def update_todo(
    todo_id: int = Path(..., description="Todo ID"),
    todo: TodoUpdate = None,
):
    try:
        if todo is None:
            raise HTTPException(status_code=400, detail="请求体不能为空")
        existing = todo_mgr.get_todo(todo_id)
        if not existing:
            raise HTTPException(status_code=404, detail="todo 不存在")

        # 仅传递“本次请求携带”的字段；不携带的字段保持不变
        fields_set = (
            getattr(todo, "model_fields_set", None)
            or getattr(todo, "__fields_set__", None)
            or set()
        )
        kwargs = {}
        for field in fields_set:
            kwargs[field] = getattr(todo, field)

        # 枚举字段转成字符串
        if "status" in kwargs and kwargs["status"] is not None:
            kwargs["status"] = kwargs["status"].value
        if "priority" in kwargs and kwargs["priority"] is not None:
            kwargs["priority"] = kwargs["priority"].value

        success = todo_mgr.update_todo(todo_id, **kwargs)

        if not success:
            raise HTTPException(status_code=500, detail="更新 todo 失败")

        updated = todo_mgr.get_todo(todo_id)
        if not updated:
            raise HTTPException(status_code=500, detail="获取更新后的 todo 失败")
        return TodoResponse(**updated)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新 todo 失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"更新 todo 失败: {str(e)}") from e


@router.delete("/{todo_id}", status_code=204)
async def delete_todo(todo_id: int = Path(..., description="Todo ID")):
    try:
        existing = todo_mgr.get_todo(todo_id)
        if not existing:
            raise HTTPException(status_code=404, detail="todo 不存在")

        success = todo_mgr.delete_todo(todo_id)
        if not success:
            raise HTTPException(status_code=500, detail="删除 todo 失败")
        return None
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除 todo 失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"删除 todo 失败: {str(e)}") from e
