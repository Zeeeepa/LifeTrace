"""Agno Agent 服务，基于 Agno 框架的通用 Agent 实现

支持 FreeTodoToolkit 工具集和国际化消息。
支持工具调用事件流，可在前端实时展示 Agent 执行步骤。
"""

import json
from collections.abc import Generator

from agno.agent import Agent, RunEvent
from agno.models.openai.like import OpenAILike

from lifetrace.llm.agno_tools import FreeTodoToolkit
from lifetrace.llm.agno_tools.base import get_message
from lifetrace.util.logging_config import get_logger
from lifetrace.util.settings import settings

logger = get_logger()

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

    def __init__(self, lang: str | None = None):
        """初始化 Agno Agent 服务

        Args:
            lang: Language code for messages ('zh' or 'en').
                  If None, uses DEFAULT_LANG or settings default.
        """
        try:
            # Determine language
            self.lang = lang or DEFAULT_LANG

            # Initialize toolkit with language support
            toolkit = FreeTodoToolkit(lang=self.lang)

            # Load instructions from agno_tools/{lang}/instructions.yaml
            # The key in the YAML file is "instructions", not "instructions_{lang}"
            # get_message already handles fallback to English if key not found
            instructions = get_message(self.lang, "instructions")

            # Build instructions list (skip if not found, which returns "[instructions]")
            instructions_list = (
                [instructions] if instructions and instructions != "[instructions]" else None
            )

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
    ) -> Generator[str]:
        """
        流式生成 Agent 回复

        Args:
            message: 用户消息
            conversation_history: 对话历史，格式为 [{"role": "user|assistant", "content": "..."}]
            include_tool_events: 是否包含工具调用事件（默认 True）

        Yields:
            回复内容片段（字符串），如果 include_tool_events=True，
            工具调用事件会以特殊格式输出：[TOOL_EVENT:{"type":"...","data":{...}}]
        """
        try:
            input_data = self._build_input_data(message, conversation_history)
            stream = self.agent.run(
                input_data,
                stream=True,
                stream_events=include_tool_events,
            )

            for chunk in stream:
                output = self._process_stream_chunk(chunk, include_tool_events)
                if output:
                    yield output

        except Exception as e:
            logger.error(f"Agno Agent 流式生成失败: {e}")
            yield f"Agno Agent 处理失败: {str(e)}"

    def is_available(self) -> bool:
        """检查 Agno Agent 是否可用"""
        return hasattr(self, "agent") and self.agent is not None
