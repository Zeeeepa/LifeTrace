"""Todo 管理路由 - 使用依赖注入"""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, Path, Query, Response, UploadFile

from lifetrace.core.dependencies import get_todo_service
from lifetrace.schemas.todo import (
    TodoCreate,
    TodoListResponse,
    TodoReorderRequest,
    TodoResponse,
    TodoUpdate,
)
from lifetrace.services.icalendar_service import ICalendarService
from lifetrace.services.todo_service import TodoService

router = APIRouter(prefix="/api/todos", tags=["todos"])


@router.get("", response_model=TodoListResponse)
async def list_todos(
    limit: int = Query(200, ge=1, le=2000, description="返回数量限制"),
    offset: int = Query(0, ge=0, description="偏移量"),
    status: str | None = Query(None, description="状态筛选：active/completed/canceled"),
    service: TodoService = Depends(get_todo_service),
):
    """获取待办列表"""
    return service.list_todos(limit, offset, status)


@router.get("/{todo_id}", response_model=TodoResponse)
async def get_todo(
    todo_id: int = Path(..., description="Todo ID"),
    service: TodoService = Depends(get_todo_service),
):
    """获取单个待办"""
    return service.get_todo(todo_id)


@router.post("", response_model=TodoResponse, status_code=201)
async def create_todo(
    todo: TodoCreate,
    service: TodoService = Depends(get_todo_service),
):
    """创建待办"""
    return service.create_todo(todo)


@router.put("/{todo_id}", response_model=TodoResponse)
async def update_todo(
    todo_id: int = Path(..., description="Todo ID"),
    todo: TodoUpdate = None,
    service: TodoService = Depends(get_todo_service),
):
    """更新待办"""
    return service.update_todo(todo_id, todo)


@router.delete("/{todo_id}", status_code=204)
async def delete_todo(
    todo_id: int = Path(..., description="Todo ID"),
    service: TodoService = Depends(get_todo_service),
):
    """删除待办"""
    service.delete_todo(todo_id)


@router.post("/reorder", status_code=200)
async def reorder_todos(
    request: TodoReorderRequest,
    service: TodoService = Depends(get_todo_service),
):
    """批量更新待办的排序和父子关系"""
    items = [
        {
            "id": item.id,
            "order": item.order,
            **({"parent_todo_id": item.parent_todo_id} if item.parent_todo_id is not None else {}),
        }
        for item in request.items
    ]
    return service.reorder_todos(items)


@router.get("/export/ics")
async def export_ics(
    limit: int = Query(2000, ge=1, le=2000, description="导出数量限制"),
    offset: int = Query(0, ge=0, description="导出偏移量"),
    status: str | None = Query(None, description="状态筛选：active/completed/canceled"),
    service: TodoService = Depends(get_todo_service),
):
    """导出 Todo 为 ICS 文件"""
    payload = service.list_todos(limit, offset, status)
    todos = [t.model_dump() if hasattr(t, "model_dump") else t for t in payload.get("todos", [])]
    ics_content = ICalendarService().export_todos(todos)
    filename = "lifetrace-todos.ics" if not status else f"lifetrace-todos-{status}.ics"
    return Response(
        content=ics_content,
        media_type="text/calendar; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/import/ics", response_model=list[TodoResponse])
async def import_ics(
    file: UploadFile = File(...),
    service: TodoService = Depends(get_todo_service),
):
    """从 ICS 文件导入 Todo"""
    if not file.filename:
        raise HTTPException(status_code=400, detail="未提供 ICS 文件")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="ICS 文件为空")

    try:
        ics_text = content.decode("utf-8")
    except UnicodeDecodeError:
        ics_text = content.decode("utf-8", errors="ignore")

    todos = ICalendarService().import_todos(ics_text)
    created: list[TodoResponse] = []
    seen_uids: set[str] = set()
    for todo in todos:
        uid = (todo.uid or "").strip()
        if uid:
            if uid in seen_uids:
                continue
            seen_uids.add(uid)
            if service.get_todo_by_uid(uid):
                continue
        created.append(service.create_todo(todo))
    return created
