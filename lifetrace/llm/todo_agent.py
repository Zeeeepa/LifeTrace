"""Todo Agent - 使用 PydanticAI 构建的智能任务助手

该模块实现了一个智能 Agent，支持：
1. 对话式任务拆解
2. 任务编辑建议
3. 澄清问题生成
4. 任务问答
"""

from dataclasses import dataclass, field
from typing import Any

from pydantic import BaseModel
from pydantic_ai import Agent, RunContext

from lifetrace.storage import todo_mgr
from lifetrace.util.logging_config import get_logger
from lifetrace.util.prompt_loader import get_prompt
from lifetrace.util.settings import settings

logger = get_logger()


# ============================================================================
# 结构化输出类型定义
# ============================================================================


class AgentQuestion(BaseModel):
    """澄清问题"""

    id: str
    question: str
    options: list[str]


class AgentEditProposal(BaseModel):
    """编辑提议"""

    field: str  # "name" | "description" | "user_notes"
    current_value: str | None
    proposed_value: str
    reason: str


class AgentDecomposeProposal(BaseModel):
    """拆解提议"""

    subtasks: list[dict[str, Any]]  # [{name, description?}]
    reason: str


class AgentResponse(BaseModel):
    """Agent 响应"""

    response_type: str  # "message" | "questions" | "edit_proposal" | "decompose_proposal"
    content: str
    questions: list[AgentQuestion] | None = None
    edit_proposal: AgentEditProposal | None = None
    decompose_proposal: AgentDecomposeProposal | None = None


# ============================================================================
# 依赖注入类型
# ============================================================================


@dataclass
class TodoAgentDeps:
    """Agent 依赖"""

    todo_id: int | None = None
    todo_context: dict[str, Any] = field(default_factory=dict)
    conversation_history: list[dict[str, str]] = field(default_factory=list)


# ============================================================================
# 创建 Agent
# ============================================================================

# 使用惰性初始化，因为需要从配置读取 model
_agent: Agent[TodoAgentDeps, str] | None = None


def _get_llm_model() -> str:
    """获取 LLM 模型配置"""
    try:
        from lifetrace.core.dependencies import get_rag_service

        rag_service = get_rag_service()
        if rag_service.llm_client.is_available():
            # PydanticAI 格式: provider:model
            model = rag_service.llm_client.model
            base_url = rag_service.llm_client.base_url
            # 如果使用 OpenAI 兼容 API，返回 openai:model
            return f"openai:{model}", base_url, rag_service.llm_client.api_key
    except Exception as e:
        logger.warning(f"获取 LLM 配置失败，使用默认配置: {e}")
    # 从项目默认配置读取（与项目默认配置一致）
    return (
        f"openai:{settings.llm.model}",
        settings.llm.base_url,
        settings.llm.api_key,  # 可能为占位符，但保持与配置一致
    )


def get_todo_agent() -> Agent[TodoAgentDeps, str]:
    """获取或创建 Todo Agent 单例"""
    global _agent
    if _agent is None:
        model, base_url, api_key = _get_llm_model()
        system_prompt = get_prompt("todo_agent", "system_prompt")
        if not system_prompt:
            system_prompt = _get_default_system_prompt()

        # 根据 PydanticAI 1.37.0 API 创建模型
        # 使用 OpenAIProvider 配置自定义 base_url（支持阿里云等 OpenAI 兼容 API）
        if base_url and api_key:
            from pydantic_ai.models.openai import OpenAIChatModel
            from pydantic_ai.providers.openai import OpenAIProvider

            model_name = model.replace("openai:", "")
            model_instance = OpenAIChatModel(
                model_name,
                provider=OpenAIProvider(
                    base_url=base_url,
                    api_key=api_key,
                ),
            )
        else:
            model_instance = model

        _agent = Agent(
            model_instance,
            deps_type=TodoAgentDeps,
            instructions=system_prompt,  # PydanticAI 1.x 使用 instructions
        )

        # 注册工具
        _register_tools(_agent)

    return _agent


def _get_default_system_prompt() -> str:
    """获取默认系统提示词"""
    return """你是一个专业的任务管理助手（Todo Agent）。你的核心能力包括：

1. **理解上下文**：深入理解用户选中的 todo 的背景和目的
2. **智能问答**：回答关于 todo 的问题
3. **任务拆解**：当检测到复杂任务时，主动提议是否需要拆解
4. **澄清概念**：通过不超过 5 个多选题帮助理清模糊的任务
5. **编辑建议**：提议修改 todo 的名称、描述或备注（需用户确认）

**行为准则：**
- 始终先理解 todo 的背景和目的
- 编辑操作必须先提出建议，获得用户确认后才能执行
- 拆解建议要具体可执行，子任务数量控制在 2-5 个
- 多选题要聚焦于任务的关键决策点
- 使用 JSON 格式返回结构化数据

**响应格式：**
根据用户需求，返回以下格式之一：

1. 普通回复：
```json
{"response_type": "message", "content": "你的回复内容"}
```

2. 澄清问题：
```json
{"response_type": "questions", "content": "让我问你几个问题来更好地理解任务", "questions": [{"id": "q1", "question": "问题1", "options": ["选项1", "选项2"]}]}
```

3. 编辑提议：
```json
{"response_type": "edit_proposal", "content": "我建议修改任务", "edit_proposal": {"field": "description", "current_value": "当前值", "proposed_value": "新值", "reason": "修改原因"}}
```

4. 拆解提议：
```json
{"response_type": "decompose_proposal", "content": "建议将任务拆解", "decompose_proposal": {"subtasks": [{"name": "子任务1", "description": "描述"}], "reason": "拆解原因"}}
```

请用中文回答，保持简洁明了。"""


def _register_tools(agent: Agent[TodoAgentDeps, str]) -> None:
    """注册 Agent 工具"""

    @agent.tool
    async def get_todo_context(ctx: RunContext[TodoAgentDeps]) -> str:
        """获取当前 todo 的完整上下文（父任务、子任务、描述等）

        Returns:
            todo 上下文的 JSON 字符串
        """
        if ctx.deps.todo_id is None:
            return '{"error": "未选中任何待办"}'

        context = todo_mgr.get_todo_context(ctx.deps.todo_id)
        if not context:
            return '{"error": "无法获取待办上下文"}'

        # 更新依赖中的上下文
        ctx.deps.todo_context = context

        import json

        return json.dumps(context, ensure_ascii=False, default=str)

    @agent.tool
    async def ask_clarification_questions(
        ctx: RunContext[TodoAgentDeps],
        questions: list[dict[str, Any]],
    ) -> str:
        """生成澄清问题来理清 todo 概念

        Args:
            questions: 问题列表，每个问题包含 id, question, options 字段

        Returns:
            确认消息
        """
        if not questions or len(questions) > 5:  # noqa: PLR2004
            return "问题数量应在 1-5 个之间"

        # 验证问题格式
        for q in questions:
            if not all(k in q for k in ["id", "question", "options"]):
                return "问题格式不正确，需要 id, question, options 字段"

        return f"已生成 {len(questions)} 个澄清问题"

    @agent.tool
    async def propose_decomposition(
        ctx: RunContext[TodoAgentDeps],
        subtasks: list[dict[str, Any]],
        reason: str,
    ) -> str:
        """提议将 todo 拆解为子任务

        Args:
            subtasks: 子任务列表，每个包含 name 和可选的 description
            reason: 拆解原因

        Returns:
            确认消息
        """
        if not subtasks:
            return "子任务列表不能为空"

        if len(subtasks) > 5:  # noqa: PLR2004
            return "子任务数量不应超过 5 个"

        # 验证子任务格式
        for st in subtasks:
            if "name" not in st:
                return "子任务必须包含 name 字段"

        return f"已生成 {len(subtasks)} 个子任务的拆解提议"

    @agent.tool
    async def propose_edit(
        ctx: RunContext[TodoAgentDeps],
        field: str,
        proposed_value: str,
        reason: str,
    ) -> str:
        """提议编辑 todo 的某个字段

        Args:
            field: 要编辑的字段，可选值: name, description, user_notes
            proposed_value: 提议的新值
            reason: 编辑原因

        Returns:
            确认消息
        """
        valid_fields = ["name", "description", "user_notes"]
        if field not in valid_fields:
            return f"无效的字段名，可选值: {', '.join(valid_fields)}"

        if not proposed_value:
            return "提议值不能为空"

        # 获取当前值
        current_value = None
        if ctx.deps.todo_context and "current" in ctx.deps.todo_context:
            current_value = ctx.deps.todo_context["current"].get(field)

        return f"已生成编辑提议: {field} 从 '{current_value}' 修改为 '{proposed_value}'"


# ============================================================================
# Agent 运行函数
# ============================================================================


async def run_agent_stream(
    message: str,
    todo_id: int | None = None,
    conversation_history: list[dict[str, str]] | None = None,
):
    """运行 Agent 并流式返回结果

    Args:
        message: 用户消息
        todo_id: 当前选中的 todo ID
        conversation_history: 对话历史

    Yields:
        流式文本块
    """
    agent = get_todo_agent()

    # 准备依赖
    todo_context = {}
    if todo_id:
        context = todo_mgr.get_todo_context(todo_id)
        if context:
            todo_context = context

    deps = TodoAgentDeps(
        todo_id=todo_id,
        todo_context=todo_context,
        conversation_history=conversation_history or [],
    )

    # 构建增强的用户消息
    enhanced_message = message
    if todo_context and "current" in todo_context:
        current = todo_context["current"]
        context_info = f"""
【当前选中的待办】
- 名称: {current.get('name', '未知')}
- 描述: {current.get('description') or '无'}
- 备注: {current.get('user_notes') or '无'}
- 状态: {current.get('status', '未知')}
- 优先级: {current.get('priority', '无')}

【用户消息】
{message}
"""
        enhanced_message = context_info

    logger.info(f"[TodoAgent] 运行 Agent, todo_id={todo_id}, message={message[:100]}...")

    try:
        # 使用 run_stream 流式运行
        async with agent.run_stream(enhanced_message, deps=deps) as result:
            async for text in result.stream_text(delta=True):
                yield text
    except Exception as e:
        logger.error(f"[TodoAgent] Agent 运行失败: {e}")
        yield f'{{"response_type": "message", "content": "抱歉，处理您的请求时出错了: {e!s}"}}'


async def run_agent(
    message: str,
    todo_id: int | None = None,
    conversation_history: list[dict[str, str]] | None = None,
) -> str:
    """运行 Agent 并返回完整结果

    Args:
        message: 用户消息
        todo_id: 当前选中的 todo ID
        conversation_history: 对话历史

    Returns:
        Agent 响应文本
    """
    result = []
    async for chunk in run_agent_stream(message, todo_id, conversation_history):
        result.append(chunk)
    return "".join(result)


# ============================================================================
# 确认操作函数
# ============================================================================


async def confirm_edit(
    todo_id: int,
    field: str,
    new_value: str,
) -> dict[str, Any]:
    """确认并执行编辑操作

    Args:
        todo_id: 待办 ID
        field: 要编辑的字段
        new_value: 新值

    Returns:
        操作结果
    """
    valid_fields = ["name", "description", "user_notes"]
    if field not in valid_fields:
        return {"success": False, "error": f"无效的字段名: {field}"}

    # 执行更新
    update_kwargs = {field: new_value}
    success = todo_mgr.update_todo(todo_id, **update_kwargs)

    if success:
        logger.info(f"[TodoAgent] 编辑成功: todo_id={todo_id}, field={field}")
        return {"success": True, "message": f"已更新 {field}"}
    else:
        logger.error(f"[TodoAgent] 编辑失败: todo_id={todo_id}, field={field}")
        return {"success": False, "error": "更新失败"}


async def confirm_decompose(
    todo_id: int,
    subtasks: list[dict[str, Any]],
) -> dict[str, Any]:
    """确认并执行拆解操作

    Args:
        todo_id: 父待办 ID
        subtasks: 子任务列表

    Returns:
        操作结果
    """
    created_ids = []
    for i, subtask in enumerate(subtasks):
        name = subtask.get("name")
        if not name:
            continue

        new_id = todo_mgr.create_todo(
            name=name,
            description=subtask.get("description"),
            parent_todo_id=todo_id,
            order=i + 1,
        )
        if new_id:
            created_ids.append(new_id)

    if created_ids:
        logger.info(f"[TodoAgent] 拆解成功: parent_id={todo_id}, created={created_ids}")
        return {
            "success": True,
            "message": f"已创建 {len(created_ids)} 个子任务",
            "created_ids": created_ids,
        }
    else:
        logger.error(f"[TodoAgent] 拆解失败: parent_id={todo_id}")
        return {"success": False, "error": "创建子任务失败"}

