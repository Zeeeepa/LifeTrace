"""
DDL 提醒任务
定期检查待办事项的截止日期，根据每个待办的提醒设置生成通知
"""

import json
from datetime import datetime, timedelta

from sqlalchemy import or_

from lifetrace.storage import todo_mgr
from lifetrace.storage.models import Todo
from lifetrace.storage.notification_storage import (
    add_notification,
    clear_dismissed_mark,
    clear_notification_by_todo_id,
    get_notifications_by_todo_id,
    is_notification_dismissed,
)
from lifetrace.storage.sql_utils import col
from lifetrace.util.logging_config import get_logger
from lifetrace.util.settings import settings
from lifetrace.util.time_utils import get_utc_now, naive_as_utc

logger = get_logger()

MINUTES_PER_HOUR = 60
HOURS_PER_DAY = 24


def _normalize_reminder_offsets(value: object | None) -> list[int]:
    if value is None:
        return []
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


def _parse_notification_time(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except (TypeError, ValueError):
        return None
    return naive_as_utc(parsed)


def _format_remaining(deadline: datetime, now: datetime) -> str:
    remaining_seconds = max(0, int((deadline - now).total_seconds()))
    minutes = remaining_seconds // MINUTES_PER_HOUR
    if minutes < MINUTES_PER_HOUR:
        return f"{minutes}分钟"
    hours = minutes // MINUTES_PER_HOUR
    if hours < HOURS_PER_DAY and minutes % MINUTES_PER_HOUR == 0:
        return f"{hours}小时"
    days = hours // HOURS_PER_DAY
    if days >= 1 and hours % HOURS_PER_DAY == 0:
        return f"{days}天"
    return f"{minutes}分钟"


def execute_deadline_reminder_task():  # noqa: C901, PLR0912
    """
    执行 DDL 提醒任务
    根据每个待办的提醒偏移，生成通知
    """
    try:
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

        # 查询活跃且有时间的待办事项
        with todo_mgr.db_base.get_session() as session:
            todos = (
                session.query(Todo)
                .filter(
                    col(Todo.status) == "active",
                    or_(col(Todo.start_time).isnot(None), col(Todo.deadline).isnot(None)),
                )
                .all()
            )

            if not todos:
                logger.debug("没有带时间的待办事项")
                return

            logger.info(f"找到 {len(todos)} 个带时间的待办事项")

            # 为每个待办生成通知
            for todo in todos:
                schedule_time = todo.start_time or todo.deadline
                if not schedule_time:
                    continue

                # 确保时间是 UTC timezone-aware
                # SQLite 存储 datetime 为字符串，SQLAlchemy 读取时为 naive datetime
                # 由于我们统一使用 UTC 存储，数据库中的 naive datetime 就是 UTC 时间
                schedule_utc = naive_as_utc(schedule_time)

                existing_notifications = get_notifications_by_todo_id(todo.id)
                if existing_notifications:
                    for existing in existing_notifications:
                        existing_time = _parse_notification_time(
                            existing.get("schedule_time") or existing.get("deadline")
                        )
                        if (
                            existing_time
                            and abs((schedule_utc - existing_time).total_seconds()) >= 1
                        ):
                            clear_notification_by_todo_id(todo.id)
                            clear_dismissed_mark(todo.id)
                            logger.debug(
                                "待办 %s 的时间已更新，清理旧通知",
                                todo.id,
                            )
                            break

                offsets = _normalize_reminder_offsets(getattr(todo, "reminder_offsets", None))
                if not offsets:
                    continue

                for offset in offsets:
                    reminder_at = schedule_utc - timedelta(minutes=offset)
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
                    remaining = _format_remaining(schedule_utc, now)
                    title = todo.name
                    content = f"还有 {remaining}"

                    added = add_notification(
                        notification_id=notification_id,
                        title=title,
                        content=content,
                        timestamp=now,
                        todo_id=todo.id,
                        schedule_time=schedule_utc,
                        reminder_at=reminder_at,
                        reminder_offset=offset,
                    )

                    if added:
                        logger.info(
                            "生成提醒通知: todo_id=%s, name=%s, time=%s, offset=%s",
                            todo.id,
                            todo.name,
                            schedule_utc,
                            offset,
                        )

    except Exception as e:
        logger.error(f"执行 DDL 提醒任务失败: {e}", exc_info=True)
