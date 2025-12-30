"""联网搜索服务模块 - 整合 Tavily 和 LLM"""

from collections.abc import Generator

from lifetrace.llm.llm_client import LLMClient
from lifetrace.llm.tavily_client import TavilyClientWrapper
from lifetrace.util.logging_config import get_logger
from lifetrace.util.prompt_loader import get_prompt

logger = get_logger()


class WebSearchService:
    """联网搜索服务，整合 Tavily 搜索结果和 LLM 生成"""

    def __init__(self):
        """初始化联网搜索服务"""
        self.tavily_client = TavilyClientWrapper()
        self.llm_client = LLMClient()
        logger.info("联网搜索服务初始化完成")

    def build_search_prompt(self, query: str, tavily_result: dict) -> list[dict[str, str]]:
        """
        构建用于 LLM 的搜索提示词

        Args:
            query: 用户查询
            tavily_result: Tavily 搜索结果

        Returns:
            LLM messages 列表
        """
        # 获取 system prompt
        system_prompt = get_prompt("web_search", "system")

        # 格式化搜索结果
        results = tavily_result.get("results", [])
        if not results:
            sources_context = "未找到相关搜索结果。"
        else:
            sources_list = []
            for idx, item in enumerate(results, start=1):
                url = item.get("url", "")
                title = item.get("title", "无标题")
                content = item.get("content", "")
                sources_list.append(f"[{idx}] {title}\nURL: {url}\n摘要: {content}")

            sources_context = "\n\n".join(sources_list)

        # 获取 user prompt 模板并格式化
        user_prompt = get_prompt(
            "web_search", "user_template", query=query, sources_context=sources_context
        )

        return [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

    def stream_answer_with_sources(self, query: str) -> Generator[str]:
        """
        流式生成带来源的回答

        Args:
            query: 用户查询

        Yields:
            文本块（逐 token）
        """
        try:
            # 检查 Tavily 是否可用
            if not self.tavily_client.is_available():
                error_msg = "当前未配置联网搜索服务，请在设置中填写 Tavily API Key。"
                yield error_msg
                return

            # 执行 Tavily 搜索
            logger.info(f"开始执行 Tavily 搜索: {query}")
            tavily_result = self.tavily_client.search(query)
            logger.info(f"Tavily 搜索完成，找到 {len(tavily_result.get('results', []))} 个结果")

            # 检查 LLM 是否可用
            if not self.llm_client.is_available():
                # LLM 不可用时，返回格式化后的搜索结果
                fallback_text = self._format_fallback_response(query, tavily_result)
                yield fallback_text
                return

            # 构建 prompt
            messages = self.build_search_prompt(query, tavily_result)

            # 流式调用 LLM
            logger.info("开始流式生成回答")
            output_chunks: list[str] = []
            for text in self.llm_client.stream_chat(messages=messages, temperature=0.7):
                if text:
                    output_chunks.append(text)
                    yield text

            logger.info("流式生成完成")

        except RuntimeError as e:
            # Tavily 配置错误
            error_msg = str(e)
            logger.error(f"联网搜索失败: {error_msg}")
            yield error_msg
        except Exception as e:
            # 其他错误
            logger.error(f"联网搜索处理失败: {e}", exc_info=True)
            yield f"联网搜索处理时出现错误: {str(e)}"

    def _format_fallback_response(self, query: str, tavily_result: dict) -> str:
        """
        当 LLM 不可用时的备用响应格式

        Args:
            query: 用户查询
            tavily_result: Tavily 搜索结果

        Returns:
            格式化的响应文本
        """
        results = tavily_result.get("results", [])
        if not results:
            return f"抱歉，未找到与 '{query}' 相关的搜索结果。"

        response_parts = [
            f"根据您的查询 '{query}'，我找到了以下信息：",
            "",
        ]

        # 列出搜索结果
        for idx, item in enumerate(results, start=1):
            title = item.get("title", "无标题")
            url = item.get("url", "")
            content = item.get("content", "")
            response_parts.append(f"{idx}. {title}")
            response_parts.append(f"   URL: {url}")
            if content:
                response_parts.append(f"   摘要: {content[:200]}...")
            response_parts.append("")

        response_parts.append("\nSources:")
        for idx, item in enumerate(results, start=1):
            title = item.get("title", "无标题")
            url = item.get("url", "")
            response_parts.append(f"{idx}. {title} ({url})")

        return "\n".join(response_parts)
