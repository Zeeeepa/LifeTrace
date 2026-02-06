# Agno Agent Development Quick Commands

## Overview

This guide covers development of **Agno Agent Tools** - the AI-powered todo management toolkit based on the [Agno framework](https://docs.agno.com/).

The FreeTodoToolkit provides a set of tools for the Agno Agent to manage todos. For the complete list of available tools, please refer to the source code in `llm/agno_tools/tools/` directory.

---

## 🏗️ Architecture

### Directory Structure

```
lifetrace/
├── config/prompts/agno_tools/     # Localized messages & prompts
│   ├── zh/                        # Chinese messages
│   └── en/                        # English messages (same structure)
│
├── llm/agno_tools/                # Python implementation
│   ├── __init__.py                # Module exports
│   ├── base.py                    # Message loader (AgnoToolsMessageLoader)
│   ├── toolkit.py                 # Main FreeTodoToolkit class
│   └── tools/                     # Individual tool implementations (organized by category)
│
└── observability/                 # Agent monitoring (Phoenix + OpenInference)
    ├── __init__.py                # Module exports
    ├── config.py                  # Observability configuration
    ├── setup.py                   # Initialization entry point
    └── exporters/
        ├── __init__.py
        └── file_exporter.py       # Local JSON file exporter
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

Messages are organized by functionality in `config/prompts/agno_tools/{lang}/` directory. Each YAML file corresponds to a category of messages.

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

## 📊 Observability (Agent Monitoring)

The Agno Agent integrates with [Arize Phoenix](https://arize.com/docs/phoenix) + [OpenInference](https://github.com/arize-ai/openinference) for tracing and monitoring.

### Features

- **Local JSON Export**: Cursor-friendly trace files for AI analysis
- **Phoenix UI**: Optional web-based visualization
- **Minimal Terminal Output**: One-line summary per trace

### Configuration

In `config/config.yaml`:

```yaml
observability:
  enabled: true                    # Enable observability
  mode: both                       # local | phoenix | both
  local:
    traces_dir: traces/            # Trace file directory
    max_files: 100                 # Max files to keep
    pretty_print: true             # Format JSON for readability
  phoenix:
    endpoint: http://localhost:6006
    project_name: freetodo-agent
  terminal:
    summary_only: true             # One-line output (recommended)
```

### Trace File Format

Each agent run generates a JSON file in `data/traces/`:

```json
{
  "trace_id": "e078e147372a",
  "timestamp": "2026-01-23T08:23:48.377470+00:00",
  "duration_ms": 26910.94,
  "agent": "breakdown_task",
  "input": "{\"task_description\": \"Make a video\"}",
  "output_preview": "Task breakdown:\n1. Define topic...",
  "tool_calls": [
    {
      "name": "breakdown_task",
      "args": {"task_description": "Make a video"},
      "result_preview": "Task breakdown...",
      "duration_ms": 26910.94
    }
  ],
  "llm_calls": [],
  "status": "success",
  "span_count": 1
}
```

### Terminal Output

With `summary_only: true`:

```
[Trace] e078e147372a | 1 tools | 26.91s | traces/20260123_082348_e078e147372a.json
```

### Using Phoenix UI (Optional)

```bash
# Start Phoenix server
uv run phoenix serve

# Access http://localhost:6006
```

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
