# ======================================
# Todo交互编辑器API
# ======================================
import asyncio
from fastapi import APIRouter, HTTPException, Request, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any, Union
from datetime import datetime
from pathlib import Path
import os
import tempfile
import shutil
import yaml
import json
import logging
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

# 使用项目的 config 实例
from lifetrace_backend.config import config

logger = logging.getLogger("lifetrace.todo_api")
router = APIRouter()

# ================ datatime utils ================
ISO_FORMAT = "%Y-%m-%dT%H:%M:%S"
DATE_ONLY_FORMAT = "%Y-%m-%d"

def parse_datetime(v: Optional[Union[str, datetime]]) -> Optional[datetime]:
    """
    将任意输入解析为 datetime 对象，兼容：
    - datetime 直接返回
    - ISO 格式: 2025-10-23T15:30:00
    - 日期格式: 2025-10-23
    - 空字符串或 None 返回 None
    """
    if v is None:
        return None
    if isinstance(v, datetime):
        return v
    v = v.strip()
    if not v:
        return None
    try:
        return datetime.fromisoformat(v)
    except Exception:
        try:
            return datetime.strptime(v[:10], DATE_ONLY_FORMAT)
        except Exception:
            raise ValueError(f"无法解析日期时间: {v!r} (必须为 ISO 或 YYYY-MM-DD 格式)")

def format_datetime(dt: Optional[datetime]) -> Optional[str]:
    """将 datetime 安全地转为 ISO 格式字符串"""
    return dt.isoformat() if isinstance(dt, datetime) else None

def safe_load_datetime(s: Optional[str]) -> Optional[datetime]:
    """YAML/JSON 反序列化时的安全加载"""
    if not s:
        return None
    try:
        return datetime.fromisoformat(s)
    except Exception:
        try:
            return datetime.strptime(s[:10], DATE_ONLY_FORMAT)
        except Exception:
            return None  # 容错

def now_iso() -> str:
    """返回当前时间的 ISO 字符串"""
    return datetime.now().isoformat()

def now() -> datetime:
    """返回当前时间的 datetime 对象"""
    return datetime.now()

# ================== 后端数据结构 ==================
class TodoMetaData(BaseModel):
    id: str                      # Unique identifier (timestamp-based)
    title: str                   # Title of the todo item
    status: str                  # Status: pending / in process / completed / cancelled / delayed
    priority: str                # Priority: low / medium / high / urgent
    created_at: datetime         # Creation timestamp
    updated_at: datetime         # Last updated timestamp
    deadline: Optional[datetime] # Optional deadline
    tags: List[str]              # List of tags / categories

class SubTask(BaseModel):
    text: str = ""          # Subtask description
    completed: bool = False # Completion status

SUBTASK_COMPLETED_TAGS = "- [x]"
SUBTASK_COMPLETED_TAGS_2 = "- [X]"

SUBTASK_INCOMPLETED_TAGS = "- [ ]"

class TodoContent(BaseModel):
    description: str             # Description for the todo item
    subtasks: List[SubTask] = [] # List of subtasks
    notes: str                   # Additional notes

class Todo(BaseModel):
    metadata: TodoMetaData
    context: TodoContent
    file_path: str

# ========== 请求模型（客户端提交的简化版本） ==========
class TodoCreateRequest(BaseModel):
    title: str = Field(..., min_length=1)
    description: Optional[str] = ""
    priority: Optional[str] = "medium"
    deadline: Optional[datetime] = None  # 接受 'YYYY-MM-DD' 或 ISO 日期时间
    tags: Optional[List[str]] = []
    subtasks: Optional[List[str]] = []
    notes: Optional[str] = ""

    @field_validator("priority", mode="before")
    def clean_priority(cls, v):
        if not v:
            return "medium"
        v = v.lower()
        allowed = {"low", "medium", "high", "urgent"}
        return v if v in allowed else "medium"

    @field_validator("deadline", mode="before")
    def clean_deadline(cls, v):
        return parse_datetime(v)

# ========== 辅助函数 ==========
def ensure_todos_dir() -> Path:
    todos_dir = Path(config.base_dir) / "todos"
    todos_dir.mkdir(parents=True, exist_ok=True)
    return todos_dir

def render_todo_markdown(todo: Todo) -> str:
    """
    将 Todo 对象渲染为 Markdown 字符串，顶部为 YAML frontmatter（metadata），正文为 description + subtasks checklist + notes
    """
    # 将 metadata 转为字典并把 datetime 转为 ISO 字符串，方便 YAML 可读
    meta = todo.metadata.model_dump()
    meta_serializable = meta.copy()
    meta_serializable["created_at"] = format_datetime(meta.get("created_at"))
    meta_serializable["updated_at"] = format_datetime(meta.get("updated_at"))
    meta_serializable["deadline"] = format_datetime(meta.get("deadline"))

    front = "---\n" + yaml.safe_dump(meta_serializable, allow_unicode=True, sort_keys=False) + "---\n\n"

    # 正文
    body_parts = []
    if todo.context.description:
        body_parts.append(todo.context.description.strip() + "\n\n")
    # subtasks -> checklist
    if todo.context.subtasks:
        for s in todo.context.subtasks:
            if s.completed:
                body_parts.append(f"{SUBTASK_COMPLETED_TAGS} {s.text}\n")
            else:
                body_parts.append(f"{SUBTASK_INCOMPLETED_TAGS} {s.text}\n")
        body_parts.append("\n")
    if todo.context.notes:
        body_parts.append("Notes:\n\n" + todo.context.notes.strip() + "\n")

    return front + "".join(body_parts)

def write_atomic(path: Path, text: str):
    # 在同目录下写临时文件再移动，减少跨文件系统问题
    temp_dir = str(path.parent)
    fd, tmp = tempfile.mkstemp(prefix=f".{path.name}.", dir=temp_dir)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(text)
        # 使用 shutil.move 做原子替换（大多数情况下）
        shutil.move(tmp, str(path))
    finally:
        if os.path.exists(tmp):
            try:
                os.remove(tmp)
            except Exception:
                pass

# ========== API 路由 /api/todo/create ==========
@router.post("/create")
async def create_todo_endpoint(req: TodoCreateRequest, request: Request = None):
    """
    创建 Todo：使用给定的数据结构构建 Todo 对象并保存为 Markdown 文件
    返回:
    {
      "success": true,
      "todo_id": "20251020_143022",
      "file_path": "data/todos/20251020_143022.md",
      "message": "Todo 创建成功"
    }
    """
    try:
        todos_dir = ensure_todos_dir()

        # 生成 id（基于当前时间）
        todo_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{todo_id}.md"
        file_path = todos_dir / filename

        now = datetime.now()
        # metadata.status 默认 pending（可后续由 update 接口修改）
        metadata = TodoMetaData(
            id=todo_id,
            title=req.title,
            status="pending",
            priority=req.priority,
            created_at=now,
            updated_at=now,
            deadline=req.deadline if isinstance(req.deadline, datetime) else (None if req.deadline is None else req.deadline),
            tags=req.tags or []
        )

        content = TodoContent(
            description=(req.description or ""),
            subtasks=[SubTask(text=subtask) for subtask in req.subtasks] or [],
            notes=(req.notes or "")
        )

        todo = Todo(
            metadata=metadata,
            context=content,
            file_path=str(file_path)
        )

        md_text = render_todo_markdown(todo)

        write_atomic(file_path, md_text)

        # 返回相对路径（相对于项目根）
        project_root = Path(__file__).parent.parent
        rel_path = os.path.relpath(file_path, start=project_root)

        return {
            "success": True,
            "todo_id": todo_id,
            "file_path": rel_path.replace("\\", "/"),
            "message": "Todo 创建成功"
        }

    except ValueError as ve:
        logger.warning(f"请求校验失败: {ve}")
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.exception(f"创建 Todo 失败: {e}")
        raise HTTPException(status_code=500, detail="创建 Todo 失败")

# ========== 提供从文件加载回 Todo 对象的工具（供 list/get 使用） ==========
def load_todo_from_file(path: Path) -> Optional[Todo]:
    if not path.exists():
        return None
    try:
        text = path.read_text(encoding="utf-8")
        # 分离 YAML frontmatter
        if text.startswith("---"):
            parts = text.split("---", 2)
            if len(parts) >= 3:
                meta_yaml = parts[1]
                body = parts[2].strip()
                meta = yaml.safe_load(meta_yaml) or {}
            else:
                return None
        else:
            # 没有 frontmatter，返回None
            return None

        # 解析 metadata
        created = safe_load_datetime(meta.get("created_at"))
        updated = safe_load_datetime(meta.get("updated_at"))
        deadline = safe_load_datetime(meta.get("deadline"))

        metadata = TodoMetaData(
            id=meta.get("id", path.stem),
            title=meta.get("title", ""),
            status=meta.get("status", "pending"),
            priority=meta.get("priority", "medium"),
            created_at=created or datetime.fromtimestamp(path.stat().st_ctime),
            updated_at=updated or datetime.fromtimestamp(path.stat().st_mtime),
            deadline=deadline,
            tags=meta.get("tags", []) or []
        )

        # 简单从 body 提取 description、subtasks、notes（尽量兼容）
        lines = body.splitlines()
        description_lines = []
        subtasks = []
        notes_lines = []
        mode = "desc"
        for ln in lines:
            ln_strip = ln.strip()
            if ln_strip.startswith(SUBTASK_INCOMPLETED_TAGS) or ln_strip.startswith(SUBTASK_COMPLETED_TAGS) or ln_strip.startswith(SUBTASK_COMPLETED_TAGS_2):
                mode = "tasks"
                completed = ln_strip.lower().startswith(SUBTASK_COMPLETED_TAGS) # use - [ ] and - [x] to indicate completion
                task_text = ln_strip[5:].strip()
                subtasks.append(SubTask(text=task_text, completed=completed))
            elif ln_strip.lower().startswith("notes:"):
                mode = "notes"
            else:
                if mode == "desc":
                    description_lines.append(ln)
                elif mode == "tasks":
                    # if it's not a checklist line, maybe it's still description continuation
                    pass
                elif mode == "notes":
                    notes_lines.append(ln)

        content = TodoContent(
            description="\n".join(description_lines).strip(),
            subtasks=subtasks,
            notes="\n".join(notes_lines).strip()
        )

        todo = Todo(
            metadata=metadata,
            context=content,
            file_path=str(path)
        )
        return todo
    except Exception as e:
        logger.exception(f"加载 todo 文件失败: {path} - {e}")
        return None

# ========== 获取 Todo 列表 /api/todo/list ==========
@router.get("/list")
async def list_todos_endpoint(
    status: Optional[str] = Query(None, description="状态筛选 (pending/in process/completed/cancelled/delayed)"),
    priority: Optional[str] = Query(None, description="优先级筛选 (low/medium/high/urgent)"),
    tag: Optional[str] = Query(None, description="标签筛选（匹配包含）"),
    sort: Optional[str] = Query("created_at", description="排序字段: created_at/updated_at/deadline/priority")
):
    """
    列出 todos（读取 todos 目录的 markdown 文件并解析元数据），支持简单过滤与排序。
    返回结构:
    {
      "todos": [ { id, title, status, priority, created_at, updated_at, deadline, tags, file_path }, ... ],
      "total": N
    }
    """
    try:
        todos_dir = ensure_todos_dir()
        files = sorted(todos_dir.glob("*.md"))

        todos: List[Dict[str, Any]] = []
        for f in files:
            todo_obj = load_todo_from_file(f)
            if not todo_obj:
                continue
            meta = todo_obj.metadata

            # 过滤
            if status and meta.status != status:
                continue
            if priority and meta.priority != priority:
                continue
            if tag and tag not in (meta.tags or []):
                continue

            # 准备返回项（将 datetime 转为 ISO string）
            item = {
                "id": meta.id,
                "title": meta.title,
                "status": meta.status,
                "priority": meta.priority,
                "created_at": meta.created_at.isoformat() if meta.created_at else None,
                "updated_at": meta.updated_at.isoformat() if meta.updated_at else None,
                "deadline": meta.deadline.isoformat() if meta.deadline else None,
                "tags": meta.tags or [],
                "file_path": os.path.relpath(f, start=Path(__file__).parent.parent).replace("\\", "/")
            }
            todos.append(item)

        # 排序处理
        reverse = True  # 默认为最新优先
        if sort == "created_at":
            todos.sort(key=lambda x: x.get("created_at") or "", reverse=reverse)
        elif sort == "updated_at":
            todos.sort(key=lambda x: x.get("updated_at") or "", reverse=reverse)
        elif sort == "deadline":
            # 将 None 放在末尾
            def dl_key(x): return x.get("deadline") or ("9999-12-31T00:00:00")
            todos.sort(key=dl_key, reverse=False)  # deadline 早的在前
        elif sort == "priority":
            # priority order: urgent > high > medium > low
            order = {"urgent": 3, "high": 2, "medium": 1, "low": 0}
            todos.sort(key=lambda x: order.get(x.get("priority", "medium"), 1), reverse=True)
        else:
            # unknown sort: fallback to created_at desc
            todos.sort(key=lambda x: x.get("created_at") or "", reverse=reverse)

        return {
            "todos": todos,
            "total": len(todos)
        }

    except Exception as e:
        logger.exception(f"获取 Todo 列表失败: {e}")
        raise HTTPException(status_code=500, detail="获取 Todo 列表失败")

# ========== 获取 Todo 信息 /api/todo/get/{todo_id} ==========
@router.get("/get/{todo_id}", response_model=Todo)
async def get_todo_endpoint(todo_id: str):
    """
    获取单个 Todo 详情（包括 metadata 和 context）
    """
    try:
        todos_dir = ensure_todos_dir()
        file_path = todos_dir / f"{todo_id}.md"
        todo_obj = load_todo_from_file(file_path)
        if not todo_obj:
            raise HTTPException(status_code=404, detail="Todo 未找到")

        # 将 Todo(Pydantic) 转成可 JSON 序列化的 dict（把 datetime 转 ISO）
        meta = todo_obj.metadata
        content = todo_obj.context

        resp = {
            "metadata": {
                "id": meta.id,
                "title": meta.title,
                "status": meta.status,
                "priority": meta.priority,
                "created_at": meta.created_at.isoformat() if meta.created_at else None,
                "updated_at": meta.updated_at.isoformat() if meta.updated_at else None,
                "deadline": meta.deadline.isoformat() if meta.deadline else None,
                "tags": meta.tags or []
            },
            "context": {
                "description": content.description,
                "subtasks": [{"text": s.text, "completed": s.completed} for s in content.subtasks],
                "notes": content.notes or ""
            },
            "file_path": os.path.relpath(file_path, start=Path(__file__).parent.parent).replace("\\","/")
        }

        return resp

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"获取 Todo 失败: {e}")
        raise HTTPException(status_code=500, detail="获取 Todo 失败")


# ========== 更新 Todo 信息 /api/todo/update/{todo_id} ==========
@router.put("/update/{todo_id}")
async def update_todo_endpoint(todo_id: str, req: TodoCreateRequest):
    """
    更新 Todo 信息（仅允许更新部分字段：title, description, priority, deadline, tags, subtasks, notes）
    """
    try:
        todos_dir = ensure_todos_dir()
        file_path = todos_dir / f"{todo_id}.md"
        todo_obj = load_todo_from_file(file_path)
        if not todo_obj:
            raise HTTPException(status_code=404, detail="Todo 未找到")

        # 更新允许的字段
        update_fields = req.model_dump(exclude_unset=True)
        metadata_fields = {"title", "priority", "deadline", "tags"}
        context_fields = {"description", "subtasks", "notes"}

        # ==== metadata更新 ======
        for key in metadata_fields & update_fields.keys():
            value = update_fields[key]
            # 支持 deadline 特殊处理
            if key == "deadline":
                value = parse_datetime(value)
            setattr(todo_obj.metadata, key, value)
        
        # === context 更新 ===
        for key in context_fields & update_fields.keys():
            value = update_fields[key]
            if key == "subtasks" and value is not None:
                value = [SubTask(text=s) for s in value]
            setattr(todo_obj.context, key, value)

        # 更新时间戳
        todo_obj.metadata.updated_at = datetime.now()

        md_text = render_todo_markdown(todo_obj)
        write_atomic(file_path, md_text)

        return {
            "success": True,
            "message": "Todo 更新成功"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"更新 Todo 失败: {e}")
        raise HTTPException(status_code=500, detail="更新 Todo 失败")


# ========== 删除 Todo 信息 /api/todo/delete/{todo_id} ==========
@router.delete("/delete/{todo_id}")
async def delete_todo_endpoint(todo_id: str):
    """
    删除指定的 Todo 文件。
    删除操作为物理删除（直接移除对应的 Markdown 文件）。

    返回:
    {
        "success": true,
        "todo_id": "20251023_152045",
        "message": "Todo 删除成功"
    }
    """
    try:
        todos_dir = ensure_todos_dir()
        file_path = todos_dir / f"{todo_id}.md"

        if not file_path.exists():
            raise HTTPException(status_code=404, detail="Todo 未找到")

        # 安全删除
        try:
            os.remove(file_path)
        except Exception as e:
            logger.error(f"删除文件失败: {e}")
            raise HTTPException(status_code=500, detail="删除 Todo 文件失败")

        return {
            "success": True,
            "todo_id": todo_id,
            "message": "Todo 删除成功"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"删除 Todo 失败: {e}")
        raise HTTPException(status_code=500, detail="删除 Todo 失败")

# ========= WebSocket 连接管理器 =========
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        data = json.dumps(message, ensure_ascii=False)
        for conn in list(self.active_connections):
            try:
                await conn.send_text(data)
            except Exception:
                self.disconnect(conn)

manager = ConnectionManager()

# ========= 文件系统事件处理器 =========
class TodoFileEventHandler(FileSystemEventHandler):
    def __init__(self, loop):
        super().__init__()
        self.loop = loop

    def _build_message(self, event_type: str, file_path: Path):
        if not file_path.name.endswith(".md"):
            return None

        todo_id = file_path.stem
        rel_path = file_path.relative_to(Path.cwd())
        return {
            "event": event_type,
            "todo_id": todo_id,
            "file_path": str(rel_path).replace("\\", "/"),
            "timestamp": datetime.now().isoformat(timespec="seconds"),
        }

    def on_created(self, event):
        msg = self._build_message("file_created", Path(event.src_path))
        if msg:
            asyncio.run_coroutine_threadsafe(manager.broadcast(msg), self.loop)

    def on_modified(self, event):
        msg = self._build_message("file_modified", Path(event.src_path))
        if msg:
            asyncio.run_coroutine_threadsafe(manager.broadcast(msg), self.loop)

    def on_deleted(self, event):
        msg = self._build_message("file_deleted", Path(event.src_path))
        if msg:
            asyncio.run_coroutine_threadsafe(manager.broadcast(msg), self.loop)

# ========= WebSocket 路由 =========
@router.websocket("/watch")
async def todo_watch_endpoint(websocket: WebSocket):
    """
    WebSocket 端点：
    - 监控 todos 目录变化；
    - 实时推送事件（file_created, file_modified, file_deleted）。
    """
    await manager.connect(websocket)
    try:
        # 如果首次连接，还没有 observer，则启动监控线程
        if not hasattr(router, "observer"):
            todos_dir = ensure_todos_dir()
            loop = asyncio.get_event_loop()
            event_handler = TodoFileEventHandler(loop)
            observer = Observer()
            observer.schedule(event_handler, str(todos_dir), recursive=False)
            observer.start()
            router.observer = observer

        # 等待客户端消息（保持连接）
        while True:
            await websocket.receive_text()

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        manager.disconnect(websocket)
        print(f"WebSocket error: {e}")