"""Conflict Detection Tools

Schedule conflict detection for todos.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import TYPE_CHECKING

from lifetrace.llm.agno_tools.base import get_message
from lifetrace.util.logging_config import get_logger

if TYPE_CHECKING:
    from lifetrace.repositories.sql_todo_repository import SqlTodoRepository

logger = get_logger()

# Default duration for todos without explicit end time
DEFAULT_TODO_DURATION_HOURS = 1


def _parse_datetime(value: str | datetime) -> datetime:
    """Parse datetime from string or return as-is if already datetime."""
    if isinstance(value, str):
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    return value


def _check_deadline_conflict(todo: dict, start: datetime, end: datetime, conflicts: list) -> None:
    """Check if todo's deadline falls within the time range."""
    deadline = todo.get("deadline")
    if not deadline:
        return

    deadline = _parse_datetime(deadline)
    if start <= deadline <= end:
        conflicts.append({"id": todo["id"], "name": todo["name"], "time": deadline})


def _check_time_range_conflict(todo: dict, start: datetime, end: datetime, conflicts: list) -> None:
    """Check if todo's time range overlaps with the specified range."""
    todo_start = todo.get("start_time")
    if not todo_start:
        return

    todo_start = _parse_datetime(todo_start)
    deadline = todo.get("deadline")
    todo_end = (
        _parse_datetime(deadline)
        if deadline
        else todo_start + timedelta(hours=DEFAULT_TODO_DURATION_HOURS)
    )

    # Check for overlap and avoid duplicates
    if start < todo_end and end > todo_start:
        existing_ids = [c["id"] for c in conflicts]
        if todo["id"] not in existing_ids:
            conflicts.append({"id": todo["id"], "name": todo["name"], "time": todo_start})


def _find_conflicts(todos: list, start: datetime, end: datetime) -> list:
    """Find all conflicting todos within the time range."""
    conflicts = []
    for todo in todos:
        _check_deadline_conflict(todo, start, end, conflicts)
        _check_time_range_conflict(todo, start, end, conflicts)
    return conflicts


class ConflictTools:
    """Conflict detection tools mixin"""

    lang: str
    todo_repo: SqlTodoRepository

    def _msg(self, key: str, **kwargs) -> str:
        return get_message(self.lang, key, **kwargs)

    def _format_conflict_result(self, conflicts: list, time_range: str) -> str:
        """Format conflict check result as message."""
        if not conflicts:
            return self._msg("no_conflict", time_range=time_range)

        conflict_lines = [
            self._msg(
                "conflict_item",
                id=c["id"],
                name=c["name"],
                start=c["time"].strftime("%H:%M") if c["time"] else "N/A",
                end="",
            )
            for c in conflicts
        ]
        return self._msg(
            "conflict_found",
            time_range=time_range,
            count=len(conflicts),
            conflicts="\n".join(conflict_lines),
        )

    def check_schedule_conflict(self, start_time: str, end_time: str | None = None) -> str:
        """Check if the specified time conflicts with existing todos

        Args:
            start_time: Start time in ISO format
            end_time: End time in ISO format (optional, defaults to start_time + 1 hour)

        Returns:
            Conflict information or availability message
        """
        try:
            start = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
            end = (
                datetime.fromisoformat(end_time.replace("Z", "+00:00"))
                if end_time
                else start + timedelta(hours=DEFAULT_TODO_DURATION_HOURS)
            )

            time_range = f"{start.strftime('%Y-%m-%d %H:%M')} - {end.strftime('%H:%M')}"
            todos = self.todo_repo.list_todos(limit=200, offset=0, status="active")
            conflicts = _find_conflicts(todos, start, end)

            return self._format_conflict_result(conflicts, time_range)

        except Exception as e:
            logger.error(f"Failed to check schedule conflict: {e}")
            return self._msg("conflict_failed", error=str(e))
