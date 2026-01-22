"""Agno Agent 服务，基于 Agno 框架的通用 Agent 实现

支持 FreeTodoToolkit 工具集和国际化消息。
"""

from collections.abc import Generator

from agno.agent import Agent, RunEvent
from agno.models.openai.like import OpenAILike

from lifetrace.llm.agno_tools import FreeTodoToolkit
from lifetrace.util.logging_config import get_logger
from lifetrace.util.prompt_loader import get_prompt
from lifetrace.util.settings import settings

logger = get_logger()

# Default language, can be overridden from settings
DEFAULT_LANG = "en"


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

            # Load instructions from config
            instructions = get_prompt("freetodo_toolkit", f"instructions_{self.lang}")
            if not instructions:
                # Fallback to English
                instructions = get_prompt("freetodo_toolkit", "instructions_en")

            # Build instructions list
            instructions_list = [instructions] if instructions else None

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

    def stream_response(
        self,
        message: str,
        conversation_history: list[dict[str, str]] | None = None,
    ) -> Generator[str]:
        """
        流式生成 Agent 回复

        Args:
            message: 用户消息
            conversation_history: 对话历史，格式为 [{"role": "user|assistant", "content": "..."}]

        Yields:
            回复内容片段（字符串）
        """
        try:
            # 构建输入：如果有对话历史，使用消息列表；否则使用单个消息字符串
            if conversation_history:
                # 将对话历史转换为 Agno 的 Message 格式
                from agno.agent import Message

                messages = []
                for msg in conversation_history:
                    role = msg.get("role", "user")
                    content = msg.get("content", "")
                    if role in ("user", "assistant"):
                        messages.append(Message(role=role, content=content))
                # 添加当前用户消息
                messages.append(Message(role="user", content=message))
                input_data = messages
            else:
                input_data = message

            # 运行 Agent 并流式返回
            stream = self.agent.run(input_data, stream=True)
            for chunk in stream:
                if chunk.event == RunEvent.run_content:
                    if chunk.content:
                        yield chunk.content
        except Exception as e:
            logger.error(f"Agno Agent 流式生成失败: {e}")
            yield f"Agno Agent 处理失败: {str(e)}"

    def is_available(self) -> bool:
        """检查 Agno Agent 是否可用"""
        return hasattr(self, "agent") and self.agent is not None
