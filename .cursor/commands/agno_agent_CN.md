# Agno Agent 开发快捷命令

## 概述

本指南涵盖 **Agno Agent Tools** 的开发 - 基于 [Agno 框架](https://docs.agno.com/) 的 AI 待办管理工具包。

FreeTodoToolkit 为 Agno Agent 提供 14 个工具，包括 Todo CRUD 操作、任务拆解、时间解析、冲突检测、统计分析和标签管理。

---

## 🏗️ 架构

### 目录结构

```
lifetrace/
├── config/prompts/agno_tools/     # 本地化消息和提示词
│   ├── zh/                        # 中文消息
│   │   ├── instructions.yaml      # Agent 系统指令
│   │   ├── todo.yaml              # Todo CRUD 消息
│   │   ├── breakdown.yaml         # 任务拆解提示词
│   │   ├── time.yaml              # 时间解析消息
│   │   ├── conflict.yaml          # 冲突检测消息
│   │   ├── stats.yaml             # 统计分析消息
│   │   └── tags.yaml              # 标签管理消息
│   └── en/                        # 英文消息（结构相同）
│
└── llm/agno_tools/                # Python 实现
    ├── __init__.py                # 模块导出
    ├── base.py                    # 消息加载器 (AgnoToolsMessageLoader)
    ├── toolkit.py                 # 主 FreeTodoToolkit 类
    └── tools/                     # 各工具实现
        ├── __init__.py            # 工具导出
        ├── todo_tools.py          # Todo CRUD (6 个方法)
        ├── breakdown_tools.py     # 任务拆解 (1 个方法)
        ├── time_tools.py          # 时间解析 (1 个方法)
        ├── conflict_tools.py      # 冲突检测 (1 个方法)
        ├── stats_tools.py         # 统计分析 (2 个方法)
        └── tag_tools.py           # 标签管理 (3 个方法)
```

### 设计模式

- **Mixin 模式**：每个工具类别是独立的 mixin 类
- **组合模式**：FreeTodoToolkit 继承所有 mixin + Agno Toolkit
- **国际化**：消息从语言特定的 YAML 文件加载
- **懒加载**：数据库和 LLM 客户端按需初始化

---

## 🔧 添加新工具

### 步骤 1：添加消息（中英文）

在 `config/prompts/agno_tools/zh/` 和 `en/` 中创建或更新 YAML 文件：

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

### 步骤 2：创建工具 Mixin

在 `llm/agno_tools/tools/` 中创建新文件：

```python
# llm/agno_tools/tools/my_tools.py
"""My Tools - 这些工具的功能描述"""

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
    todo_repo: "SqlTodoRepository"  # 如果需要

    def _msg(self, key: str, **kwargs) -> str:
        return get_message(self.lang, key, **kwargs)

    def my_tool_method(self, param: str) -> str:
        """工具描述，让 LLM 理解何时使用此工具

        Args:
            param: 参数描述

        Returns:
            结果消息
        """
        try:
            # 实现逻辑
            result = f"processed {param}"
            return self._msg("my_tool_success", result=result)
        except Exception as e:
            logger.error(f"Failed: {e}")
            return self._msg("my_tool_failed", error=str(e))
```

### 步骤 3：注册到 Toolkit

更新 `llm/agno_tools/tools/__init__.py`：

```python
from lifetrace.llm.agno_tools.tools.my_tools import MyTools

__all__ = [..., "MyTools"]
```

更新 `llm/agno_tools/toolkit.py`：

```python
from lifetrace.llm.agno_tools.tools import (
    ...,
    MyTools,
)

class FreeTodoToolkit(
    ...,
    MyTools,  # 添加 mixin
    Toolkit,
):
    def __init__(self, lang: str = "en", **kwargs):
        ...
        tools = [
            ...,
            self.my_tool_method,  # 注册工具
        ]
```

---

## 📝 消息配置

### YAML 结构

消息按功能组织：

| 文件 | 用途 |
|------|------|
| `instructions.yaml` | Agent 系统提示词 |
| `todo.yaml` | Todo CRUD 消息 |
| `breakdown.yaml` | 任务拆解提示词 |
| `time.yaml` | 时间解析消息 |
| `conflict.yaml` | 冲突检测消息 |
| `stats.yaml` | 统计分析消息 |
| `tags.yaml` | 标签管理消息 |

### 消息格式

- 使用 `{placeholder}` 进行变量替换
- 多行提示词使用 YAML `|` 语法
- 保持消息简洁且信息丰富

```yaml
# 带占位符的简单消息
create_success: "成功创建待办 #{id}: {name}"

# 多行提示词
breakdown_prompt: |
  请将此任务拆解为子任务。

  任务: {task_description}

  返回 JSON 格式。
```

### 访问消息

```python
# 在工具方法中
def _msg(self, key: str, **kwargs) -> str:
    return get_message(self.lang, key, **kwargs)

# 使用
return self._msg("create_success", id=123, name="买菜")
```

---

## 🌐 国际化

### 语言选择

语言通过调用链传递：

```
请求头 (Accept-Language)
    ↓
Chat Router (get_request_language)
    ↓
AgnoAgentService(lang=lang)
    ↓
FreeTodoToolkit(lang=lang)
    ↓
AgnoToolsMessageLoader(lang)
```

### 添加新语言

1. 创建新目录：`config/prompts/agno_tools/{lang}/`
2. 从 `en/` 复制所有 YAML 文件
3. 翻译所有消息
4. 加载器会自动检测新语言

---

## 🧪 测试工具

### 快速测试脚本

```python
from lifetrace.llm.agno_tools import FreeTodoToolkit

# 测试中文
toolkit_zh = FreeTodoToolkit(lang="zh")
print(toolkit_zh.list_todos(status="active", limit=5))

# 测试英文
toolkit_en = FreeTodoToolkit(lang="en")
print(toolkit_en.list_todos(status="active", limit=5))
```

### 运行测试

```bash
uv run python -c "
from lifetrace.llm.agno_tools import FreeTodoToolkit
tk = FreeTodoToolkit(lang='zh')
print(tk.parse_time('明天下午3点'))
"
```

---

## 📋 工具参考

### Todo 管理（6 个工具）

| 方法 | 描述 |
|------|------|
| `create_todo(name, description?, deadline?, priority?, tags?)` | 创建新待办 |
| `complete_todo(todo_id)` | 标记为完成 |
| `update_todo(todo_id, name?, description?, deadline?, priority?)` | 更新待办 |
| `list_todos(status?, limit?)` | 列出待办 |
| `search_todos(keyword)` | 按关键词搜索 |
| `delete_todo(todo_id)` | 删除待办 |

### 任务拆解（1 个工具）

| 方法 | 描述 |
|------|------|
| `breakdown_task(task_description)` | 使用 LLM 将复杂任务拆解为子任务 |

### 时间解析（1 个工具）

| 方法 | 描述 |
|------|------|
| `parse_time(time_expression)` | 将自然语言时间解析为 ISO 格式 |

### 冲突检测（1 个工具）

| 方法 | 描述 |
|------|------|
| `check_schedule_conflict(start_time, end_time?)` | 检测时间冲突 |

### 统计分析（2 个工具）

| 方法 | 描述 |
|------|------|
| `get_todo_stats(date_range?)` | 获取统计摘要 |
| `get_overdue_todos()` | 列出逾期待办 |

### 标签管理（3 个工具）

| 方法 | 描述 |
|------|------|
| `list_tags()` | 列出所有标签及计数 |
| `get_todos_by_tag(tag)` | 按标签获取待办 |
| `suggest_tags(todo_name)` | 使用 LLM 推荐标签 |

---

## ✅ 开发检查清单

添加新工具时：

- [ ] 在 `zh/` 和 `en/` 目录中创建 YAML 消息
- [ ] 创建带有正确类型提示的工具 mixin 类
- [ ] 添加文档字符串让 LLM 理解工具用途
- [ ] 所有用户可见消息使用 `_msg()`
- [ ] 处理异常并返回错误消息
- [ ] 在 `tools/__init__.py` 中注册工具
- [ ] 将 mixin 添加到 `FreeTodoToolkit` 类
- [ ] 在 `tools` 列表中注册方法
- [ ] 使用两种语言测试
- [ ] 更新工具参考文档
