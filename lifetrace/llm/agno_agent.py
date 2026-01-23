"""Agno Agent 服务，基于 Agno 框架的通用 Agent 实现

支持 FreeTodoToolkit 工具集和国际化消息。
支持工具调用事件流，可在前端实时展示 Agent 执行步骤。
支持 Phoenix + OpenInference 观测（通过配置启用）。
支持 session_id 传递，实现按会话聚合 trace 文件。
"""

from __future__ import annotations

import json
from collections.abc import Generator
from contextvars import ContextVar

from agno.agent import Agent, RunEvent
from agno.models.openai.like import OpenAILike

from lifetrace.llm.agno_tools import FreeTodoToolkit
from lifetrace.llm.agno_tools.base import get_message
from lifetrace.observability import setup_observability
from lifetrace.util.logging_config import get_logger
from lifetrace.util.settings import settings

# 全局 ContextVar 用于跨 span 传递 session_id
# file_exporter 可以读取这个值来按 session 聚合文件
current_session_id: ContextVar[str | None] = ContextVar("current_session_id", default=None)

logger = get_logger()

# 初始化观测系统（在模块加载时执行一次）
# 如果配置中 observability.enabled = false，则不会有任何影响
setup_observability()

# Default language, can be overridden from settings
DEFAULT_LANG = "en"

# 工具调用事件标记（用于流式输出中区分内容和工具调用事件）
TOOL_EVENT_PREFIX = "\n[TOOL_EVENT:"
TOOL_EVENT_SUFFIX = "]\n"

# 工具结果预览最大长度
RESULT_PREVIEW_MAX_LENGTH = 500


class AgnoAgentService:
    """Agno Agent 服务，提供基于 Agno 框架的智能对话能力

    Supports:
    - FreeTodoToolkit for todo management
    - Internationalization (i18n) through lang parameter
    - Streaming responses
    """

    def __init__(self, lang: str | None = None, selected_tools: list[str] | None = None):
        """初始化 Agno Agent 服务

        Args:
            lang: Language code for messages ('zh' or 'en').
                  If None, uses DEFAULT_LANG or settings default.
            selected_tools: List of tool names to enable. If None or empty, all tools are enabled.
        """
        try:
            # Determine language
            self.lang = lang or DEFAULT_LANG

            # Initialize toolkit with language support
            toolkit = FreeTodoToolkit(lang=self.lang, selected_tools=selected_tools)

            # 判断是否使用全部工具（FreeTodoToolkit 有 14 个工具）
            # 如果只选择了部分工具，使用简化的 instructions，避免 LLM 尝试调用不存在的工具
            total_tools_count = 14
            use_all_tools = not selected_tools or len(selected_tools) == total_tools_count

            if use_all_tools:
                # Load full instructions from agno_tools/{lang}/instructions.yaml
                instructions = get_message(self.lang, "instructions")
                instructions_list = (
                    [instructions] if instructions and instructions != "[instructions]" else None
                )
            elif self.lang == "zh":
                # 使用简化的 instructions，只告诉 LLM 使用提供的工具
                instructions_list = ["你是 FreeTodo 智能助手，可以帮助用户管理待办事项。"]
            else:
                instructions_list = [
                    "You are the FreeTodo assistant that helps users manage their todos. "
                ]

            # 复用现有 LLM 配置
            self.agent = Agent(
                model=OpenAILike(
                    id=settings.llm.model,
                    api_key=settings.llm.api_key,
                    base_url=settings.llm.base_url,
                ),
                tools=[toolkit],
                instructions=instructions_list,
                markdown=True,
            )
            logger.info(
                f"Agno Agent 初始化成功，模型: {settings.llm.model}, "
                f"Base URL: {settings.llm.base_url}, lang: {self.lang}",
            )
        except Exception as e:
            logger.error(f"Agno Agent 初始化失败: {e}")
            raise

    def _build_input_data(
        self,
        message: str,
        conversation_history: list[dict[str, str]] | None,
    ):
        """构建 Agent 输入数据"""
        if not conversation_history:
            return message

        from agno.agent import Message

        messages = []
        for msg in conversation_history:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role in ("user", "assistant"):
                messages.append(Message(role=role, content=content))
        messages.append(Message(role="user", content=message))
        return messages

    def _format_tool_event(self, event_data: dict) -> str:
        """格式化工具事件为输出字符串"""
        return f"{TOOL_EVENT_PREFIX}{json.dumps(event_data, ensure_ascii=False)}{TOOL_EVENT_SUFFIX}"

    def _handle_tool_call_started(self, chunk) -> str | None:
        """处理工具调用开始事件"""
        tool_info = getattr(chunk, "tool", None)
        if not tool_info:
            return None
        event_data = {
            "type": "tool_call_start",
            "tool_name": getattr(tool_info, "tool_name", "unknown"),
            "tool_args": getattr(tool_info, "tool_args", {}),
        }
        logger.debug(f"工具调用开始: {event_data['tool_name']}, 参数: {event_data['tool_args']}")
        return self._format_tool_event(event_data)

    def _handle_tool_call_completed(self, chunk) -> str | None:
        """处理工具调用完成事件"""
        tool_info = getattr(chunk, "tool", None)
        if not tool_info:
            return None
        result = getattr(tool_info, "result", "")
        result_str = str(result)
        result_preview = (
            result_str[:RESULT_PREVIEW_MAX_LENGTH] + "..."
            if len(result_str) > RESULT_PREVIEW_MAX_LENGTH
            else result_str
        )
        event_data = {
            "type": "tool_call_end",
            "tool_name": getattr(tool_info, "tool_name", "unknown"),
            "result_preview": result_preview,
        }
        logger.debug(
            f"工具调用完成: {event_data['tool_name']}, 结果预览: {result_preview[:100]}..."
        )
        return self._format_tool_event(event_data)

    def _process_stream_chunk(self, chunk, include_tool_events: bool) -> str | None:
        """处理单个流式输出块，返回需要 yield 的内容"""
        result = None

        if chunk.event == RunEvent.run_content:
            result = chunk.content if chunk.content else None
        elif include_tool_events:
            if chunk.event == RunEvent.tool_call_started:
                result = self._handle_tool_call_started(chunk)
            elif chunk.event == RunEvent.tool_call_completed:
                result = self._handle_tool_call_completed(chunk)
            elif chunk.event == RunEvent.run_started:
                logger.debug("Agent 运行开始")
                result = self._format_tool_event({"type": "run_started"})
            elif chunk.event == RunEvent.run_completed:
                logger.debug("Agent 运行完成")
                result = self._format_tool_event({"type": "run_completed"})

        return result

    def stream_response(
        self,
        message: str,
        conversation_history: list[dict[str, str]] | None = None,
        include_tool_events: bool = True,
        session_id: str | None = None,
    ) -> Generator[str]:
        """
        流式生成 Agent 回复

        Args:
            message: 用户消息
            conversation_history: 对话历史，格式为 [{"role": "user|assistant", "content": "..."}]
            include_tool_events: 是否包含工具调用事件（默认 True）
            session_id: 会话 ID，用于 trace 文件按会话聚合和 Phoenix session 追踪

        Yields:
            回复内容片段（字符串），如果 include_tool_events=True，
            工具调用事件会以特殊格式输出：[TOOL_EVENT:{"type":"...","data":{...}}]
        """
        # 设置本地 ContextVar（用于 file_exporter 按会话聚合）
        current_session_id.set(session_id)

        try:
            input_data = self._build_input_data(message, conversation_history)
            # 直接将 session_id 传递给 agent.run()
            # Agno Instrumentor 会从参数中读取 session_id 并设置为 span 属性
            stream = self.agent.run(
                input_data,
                stream=True,
                stream_events=include_tool_events,
                session_id=session_id,  # 传递给 Agno，用于 Phoenix session 追踪
            )

            for chunk in stream:
                output = self._process_stream_chunk(chunk, include_tool_events)
                if output:
                    yield output

        except Exception as e:
            logger.error(f"Agno Agent 流式生成失败: {e}")
            yield f"Agno Agent 处理失败: {str(e)}"
        finally:
            # 清理 ContextVar
            current_session_id.set(None)

    def is_available(self) -> bool:
        """检查 Agno Agent 是否可用"""
        return hasattr(self, "agent") and self.agent is not None
