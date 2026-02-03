from __future__ import annotations

from lifetrace.storage.models import Todo
from lifetrace.storage.todo_manager_ical import TodoIcalMixin


class StubTodoManager(TodoIcalMixin):
    def _get_todo_tags(self, session, todo_id: int):
        return []

    def _get_todo_attachments(self, session, todo_id: int):
        return []

    def _set_todo_tags(self, session, todo_id: int, tags):
        return None


def test_todo_to_dict_coerces_is_all_day_none() -> None:
    manager = StubTodoManager()
    todo = Todo(name="Test")
    todo.id = 1
    todo.is_all_day = None

    data = manager._todo_to_dict(None, todo)

    assert data["is_all_day"] is False
