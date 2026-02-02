"""
DDL 提醒任务
定期检查待办事项的截止日期，根据每个待办的提醒设置生成通知
"""

import json
from datetime import datetime, timedelta

from lifetrace.storage import todo_mgr
from lifetrace.storage.models import Todo
from lifetrace.storage.notification_storage import (
    add_notification,
    clear_dismissed_mark,
    clear_notification_by_todo_id,
    get_notifications_by_todo_id,
    is_notification_dismissed,
)
from lifetrace.util.logging_config import get_logger
from lifetrace.util.settings import settings
from lifetrace.util.time_utils import get_utc_now, naive_as_utc

logger = get_logger()

DEFAULT_REMINDER_OFFSET_MINUTES = 5


def _normalize_reminder_offsets(value: object | None) -> list[int] | None:
    if value is None:
        return None
    if isinstance(value, str):
        if not value.strip():
            return []
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            return []
    if isinstance(value, list):
        offsets: list[int] = []
        for item in value:
            try:
                offset = int(item)
            except (TypeError, ValueError):
                continue
            if offset < 0:
                continue
            offsets.append(offset)
        return sorted(set(offsets))
    return []


def _parse_notification_deadline(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except (TypeError, ValueError):
        return None
    return naive_as_utc(parsed)


def _format_remaining(deadline: datetime, now: datetime) -> str:
    remaining_seconds = max(0, int((deadline - now).total_seconds()))
    minutes = remaining_seconds // 60
    if minutes < 60:
        return f"{minutes}分钟"
    hours = minutes // 60
    if hours < 24 and minutes % 60 == 0:
        return f"{hours}小时"
    days = hours // 24
    if days >= 1 and hours % 24 == 0:
        return f"{days}天"
    return f"{minutes}分钟"


def execute_deadline_reminder_task():  # noqa: C901
    """
    执行 DDL 提醒任务
    根据每个待办的提醒偏移，生成通知
    """
    try:
        default_offset = settings.get(
            "jobs.deadline_reminder.params.reminder_window_minutes",
            DEFAULT_REMINDER_OFFSET_MINUTES,
        )
        try:
            default_offset = int(default_offset)
        except (TypeError, ValueError):
            default_offset = DEFAULT_REMINDER_OFFSET_MINUTES
        if default_offset < 0:
            default_offset = DEFAULT_REMINDER_OFFSET_MINUTES

        interval_seconds = settings.get("jobs.deadline_reminder.interval", 30)
        try:
            interval_seconds = float(interval_seconds)
        except (TypeError, ValueError):
            interval_seconds = 30
        misfire_grace = settings.get("scheduler.misfire_grace_time", 60)
        try:
            misfire_grace = int(misfire_grace)
        except (TypeError, ValueError):
            misfire_grace = 60
        lookback_seconds = max(60, int(interval_seconds * 2), misfire_grace)

        now = get_utc_now()
        window_start = now - timedelta(seconds=lookback_seconds)

        # 查询活跃且有 deadline 的待办事项
        with todo_mgr.db_base.get_session() as session:
            todos = (
                session.query(Todo)
                .filter(
                    Todo.status == "active",
                    Todo.deadline.isnot(None),
                )
                .all()
            )

            if not todos:
                logger.debug("没有带截止时间的待办事项")
                return

            logger.info(f"找到 {len(todos)} 个带截止时间的待办事项")

            # 为每个待办生成通知
            for todo in todos:
                if not todo.deadline:
                    continue

                # 确保 deadline 是 UTC timezone-aware
                # SQLite 存储 datetime 为字符串，SQLAlchemy 读取时为 naive datetime
                # 由于我们统一使用 UTC 存储，数据库中的 naive datetime 就是 UTC 时间
                deadline_utc = naive_as_utc(todo.deadline)

                existing_notifications = get_notifications_by_todo_id(todo.id)
                if existing_notifications:
                    for existing in existing_notifications:
                        existing_deadline = _parse_notification_deadline(existing.get("deadline"))
                        if (
                            existing_deadline
                            and abs((deadline_utc - existing_deadline).total_seconds()) >= 1
                        ):
                            clear_notification_by_todo_id(todo.id)
                            clear_dismissed_mark(todo.id)
                            logger.debug(
                                "待办 %s 的 deadline 已更新，清理旧通知",
                                todo.id,
                            )
                            break

                offsets = _normalize_reminder_offsets(getattr(todo, "reminder_offsets", None))
                if offsets is None:
                    offsets = [default_offset]
                if not offsets:
                    continue

                for offset in offsets:
                    reminder_at = deadline_utc - timedelta(minutes=offset)
                    if reminder_at > now or reminder_at < window_start:
                        continue

                    if is_notification_dismissed(todo.id, reminder_at):
                        logger.debug(
                            "待办 %s 的提醒 %s 已被取消，跳过",
                            todo.id,
                            reminder_at,
                        )
                        continue

                    notification_id = f"todo_{todo.id}_reminder_{int(reminder_at.timestamp())}"
                    remaining = _format_remaining(deadline_utc, now)
                    title = todo.name
                    content = f"还有 {remaining}"

                    added = add_notification(
                        notification_id=notification_id,
                        title=title,
                        content=content,
                        timestamp=now,
                        todo_id=todo.id,
                        deadline=deadline_utc,
                        reminder_at=reminder_at,
                        reminder_offset=offset,
                    )

                    if added:
                        logger.info(
                            "生成 DDL 提醒通知: todo_id=%s, name=%s, deadline=%s, offset=%s",
                            todo.id,
                            todo.name,
                            deadline_utc,
                            offset,
                        )

    except Exception as e:
        logger.error(f"执行 DDL 提醒任务失败: {e}", exc_info=True)
