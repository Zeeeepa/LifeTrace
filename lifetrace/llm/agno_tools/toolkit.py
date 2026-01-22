"""FreeTodo Toolkit for Agno Agent

Main toolkit class that combines all tool mixins.
"""

from __future__ import annotations

from agno.tools import Toolkit

from lifetrace.llm.agno_tools.base import AgnoToolsMessageLoader
from lifetrace.llm.agno_tools.tools import (
    BreakdownTools,
    ConflictTools,
    StatsTools,
    TagTools,
    TimeTools,
    TodoTools,
)
from lifetrace.util.logging_config import get_logger

logger = get_logger()


class FreeTodoToolkit(
    TodoTools,
    BreakdownTools,
    TimeTools,
    ConflictTools,
    StatsTools,
    TagTools,
    Toolkit,
):
    """FreeTodo Toolkit - Todo management tools for Agno Agent

    Combines all tool mixins into a single Toolkit.
    Supports internationalization through lang parameter.

    Tools included:
    - Todo CRUD: create_todo, complete_todo, update_todo, list_todos, search_todos, delete_todo
    - Task breakdown: breakdown_task
    - Time parsing: parse_time
    - Conflict detection: check_schedule_conflict
    - Statistics: get_todo_stats, get_overdue_todos
    - Tag management: list_tags, get_todos_by_tag, suggest_tags
    """

    def __init__(self, lang: str = "en", **kwargs):
        """Initialize FreeTodoToolkit

        Args:
            lang: Language code for messages ('zh' or 'en'), defaults to 'en'
            **kwargs: Additional arguments passed to Toolkit base class
        """
        self.lang = lang

        # Initialize message loader (preload messages)
        AgnoToolsMessageLoader(lang)

        # Lazy import to avoid circular dependencies
        from lifetrace.repositories.sql_todo_repository import SqlTodoRepository
        from lifetrace.storage.database import db_base

        self.db_base = db_base
        self.todo_repo = SqlTodoRepository(db_base)

        # Register all tools from mixins
        tools = [
            # Todo management (from TodoTools)
            self.create_todo,
            self.complete_todo,
            self.update_todo,
            self.list_todos,
            self.search_todos,
            self.delete_todo,
            # Task breakdown (from BreakdownTools)
            self.breakdown_task,
            # Time parsing (from TimeTools)
            self.parse_time,
            # Conflict detection (from ConflictTools)
            self.check_schedule_conflict,
            # Statistics (from StatsTools)
            self.get_todo_stats,
            self.get_overdue_todos,
            # Tag management (from TagTools)
            self.list_tags,
            self.get_todos_by_tag,
            self.suggest_tags,
        ]

        super().__init__(name="freetodo_toolkit", tools=tools, **kwargs)
        logger.info(f"FreeTodoToolkit initialized with lang={lang}, tools={len(tools)}")
