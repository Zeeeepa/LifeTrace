# Agno Agent Development Quick Commands

## Overview

This guide covers development of **Agno Agent Tools** - the AI-powered todo management toolkit based on the [Agno framework](https://docs.agno.com/).

The FreeTodoToolkit provides 14 tools for the Agno Agent to manage todos, including CRUD operations, task breakdown, time parsing, conflict detection, statistics, and tag management.

---

## 🏗️ Architecture

### Directory Structure

```
lifetrace/
├── config/prompts/agno_tools/     # Localized messages & prompts
│   ├── zh/                        # Chinese messages
│   │   ├── instructions.yaml      # Agent system instructions
│   │   ├── todo.yaml              # Todo CRUD messages
│   │   ├── breakdown.yaml         # Task breakdown prompts
│   │   ├── time.yaml              # Time parsing messages
│   │   ├── conflict.yaml          # Conflict detection messages
│   │   ├── stats.yaml             # Statistics messages
│   │   └── tags.yaml              # Tag management messages
│   └── en/                        # English messages (same structure)
│
└── llm/agno_tools/                # Python implementation
    ├── __init__.py                # Module exports
    ├── base.py                    # Message loader (AgnoToolsMessageLoader)
    ├── toolkit.py                 # Main FreeTodoToolkit class
    └── tools/                     # Individual tool implementations
        ├── __init__.py            # Tool exports
        ├── todo_tools.py          # Todo CRUD (6 methods)
        ├── breakdown_tools.py     # Task breakdown (1 method)
        ├── time_tools.py          # Time parsing (1 method)
        ├── conflict_tools.py      # Conflict detection (1 method)
        ├── stats_tools.py         # Statistics (2 methods)
        └── tag_tools.py           # Tag management (3 methods)
```

### Design Patterns

- **Mixin Pattern**: Each tool category is a separate mixin class
- **Composition**: FreeTodoToolkit inherits from all mixins + Agno Toolkit
- **i18n**: Messages loaded from language-specific YAML files
- **Lazy Loading**: Database and LLM clients initialized on-demand

---

## 🔧 Adding a New Tool

### Step 1: Add Messages (Both Languages)

Create or update YAML files in `config/prompts/agno_tools/zh/` and `en/`:

```yaml
# config/prompts/agno_tools/zh/my_tool.yaml
my_tool_success: "操作成功: {result}"
my_tool_failed: "操作失败: {error}"
my_tool_prompt: |
  这是给 LLM 的提示词模板。
  参数: {param}
```

```yaml
# config/prompts/agno_tools/en/my_tool.yaml
my_tool_success: "Operation successful: {result}"
my_tool_failed: "Operation failed: {error}"
my_tool_prompt: |
  This is a prompt template for LLM.
  Parameter: {param}
```

### Step 2: Create Tool Mixin

Create a new file in `llm/agno_tools/tools/`:

```python
# llm/agno_tools/tools/my_tools.py
"""My Tools - Description of what these tools do."""

from __future__ import annotations
from typing import TYPE_CHECKING

from lifetrace.llm.agno_tools.base import get_message
from lifetrace.util.logging_config import get_logger

if TYPE_CHECKING:
    from lifetrace.repositories.sql_todo_repository import SqlTodoRepository

logger = get_logger()


class MyTools:
    """My tools mixin"""

    lang: str
    todo_repo: "SqlTodoRepository"  # If needed

    def _msg(self, key: str, **kwargs) -> str:
        return get_message(self.lang, key, **kwargs)

    def my_tool_method(self, param: str) -> str:
        """Tool description for LLM to understand when to use it

        Args:
            param: Description of the parameter

        Returns:
            Result message
        """
        try:
            # Implementation
            result = f"processed {param}"
            return self._msg("my_tool_success", result=result)
        except Exception as e:
            logger.error(f"Failed: {e}")
            return self._msg("my_tool_failed", error=str(e))
```

### Step 3: Register in Toolkit

Update `llm/agno_tools/tools/__init__.py`:

```python
from lifetrace.llm.agno_tools.tools.my_tools import MyTools

__all__ = [..., "MyTools"]
```

Update `llm/agno_tools/toolkit.py`:

```python
from lifetrace.llm.agno_tools.tools import (
    ...,
    MyTools,
)

class FreeTodoToolkit(
    ...,
    MyTools,  # Add mixin
    Toolkit,
):
    def __init__(self, lang: str = "en", **kwargs):
        ...
        tools = [
            ...,
            self.my_tool_method,  # Register tool
        ]
```

---

## 📝 Message Configuration

### YAML Structure

Messages are organized by functionality:

| File | Purpose |
|------|---------|
| `instructions.yaml` | Agent system prompt |
| `todo.yaml` | Todo CRUD messages |
| `breakdown.yaml` | Task breakdown prompts |
| `time.yaml` | Time parsing messages |
| `conflict.yaml` | Conflict detection |
| `stats.yaml` | Statistics messages |
| `tags.yaml` | Tag management |

### Message Format

- Use `{placeholder}` for variable substitution
- Multi-line prompts use YAML `|` syntax
- Keep messages concise and informative

```yaml
# Simple message with placeholder
create_success: "Created todo #{id}: {name}"

# Multi-line prompt
breakdown_prompt: |
  Break down this task into subtasks.

  Task: {task_description}

  Return JSON format.
```

### Accessing Messages

```python
# In tool methods
def _msg(self, key: str, **kwargs) -> str:
    return get_message(self.lang, key, **kwargs)

# Usage
return self._msg("create_success", id=123, name="Buy groceries")
```

---

## 🌐 Internationalization

### Language Selection

Language is passed through the call chain:

```
Request Header (Accept-Language)
    ↓
Chat Router (get_request_language)
    ↓
AgnoAgentService(lang=lang)
    ↓
FreeTodoToolkit(lang=lang)
    ↓
AgnoToolsMessageLoader(lang)
```

### Adding a New Language

1. Create new directory: `config/prompts/agno_tools/{lang}/`
2. Copy all YAML files from `en/`
3. Translate all messages
4. The loader will automatically detect the new language

---

## 🧪 Testing Tools

### Quick Test Script

```python
from lifetrace.llm.agno_tools import FreeTodoToolkit

# Test Chinese
toolkit_zh = FreeTodoToolkit(lang="zh")
print(toolkit_zh.list_todos(status="active", limit=5))

# Test English
toolkit_en = FreeTodoToolkit(lang="en")
print(toolkit_en.list_todos(status="active", limit=5))
```

### Running Tests

```bash
uv run python -c "
from lifetrace.llm.agno_tools import FreeTodoToolkit
tk = FreeTodoToolkit(lang='zh')
print(tk.parse_time('明天下午3点'))
"
```

---

## 📋 Tool Reference

### Todo Management (6 tools)

| Method | Description |
|--------|-------------|
| `create_todo(name, description?, deadline?, priority?, tags?)` | Create new todo |
| `complete_todo(todo_id)` | Mark as completed |
| `update_todo(todo_id, name?, description?, deadline?, priority?)` | Update todo |
| `list_todos(status?, limit?)` | List todos |
| `search_todos(keyword)` | Search by keyword |
| `delete_todo(todo_id)` | Delete todo |

### Task Breakdown (1 tool)

| Method | Description |
|--------|-------------|
| `breakdown_task(task_description)` | Break complex task into subtasks using LLM |

### Time Parsing (1 tool)

| Method | Description |
|--------|-------------|
| `parse_time(time_expression)` | Parse natural language time to ISO format |

### Conflict Detection (1 tool)

| Method | Description |
|--------|-------------|
| `check_schedule_conflict(start_time, end_time?)` | Check time conflicts |

### Statistics (2 tools)

| Method | Description |
|--------|-------------|
| `get_todo_stats(date_range?)` | Get statistics summary |
| `get_overdue_todos()` | List overdue todos |

### Tag Management (3 tools)

| Method | Description |
|--------|-------------|
| `list_tags()` | List all tags with counts |
| `get_todos_by_tag(tag)` | Get todos by tag |
| `suggest_tags(todo_name)` | Suggest tags using LLM |

---

## ✅ Development Checklist

When adding new tools:

- [ ] Create YAML messages in both `zh/` and `en/` directories
- [ ] Create tool mixin class with proper type hints
- [ ] Add docstrings for LLM to understand tool usage
- [ ] Use `_msg()` for all user-facing messages
- [ ] Handle exceptions and return error messages
- [ ] Register tool in `tools/__init__.py`
- [ ] Add mixin to `FreeTodoToolkit` class
- [ ] Register method in `tools` list
- [ ] Test with both languages
- [ ] Update tool reference documentation
