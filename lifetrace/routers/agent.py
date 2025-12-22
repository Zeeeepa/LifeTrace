"""Agent 路由 - Todo Agent API 端点"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from lifetrace.core.dependencies import get_chat_service
from lifetrace.llm.todo_agent import confirm_decompose, confirm_edit, run_agent_stream
from lifetrace.services.chat_service import ChatService
from lifetrace.util.logging_config import get_logger

logger = get_logger()

router = APIRouter(prefix="/api/agent", tags=["agent"])


# ============================================================================
# 请求/响应模型
# ============================================================================


class AgentChatRequest(BaseModel):
    """Agent 聊天请求"""

    message: str
    todo_id: int | None = None
    conversation_id: str | None = None
    conversation_history: list[dict[str, str]] | None = None


class ConfirmEditRequest(BaseModel):
    """确认编辑请求"""

    todo_id: int
    field: str
    new_value: str


class ConfirmDecomposeRequest(BaseModel):
    """确认拆解请求"""

    todo_id: int
    subtasks: list[dict[str, Any]]


# ============================================================================
# API 端点
# ============================================================================


@router.post("/chat/stream")
async def agent_chat_stream(
    request: AgentChatRequest,
    chat_service: ChatService = Depends(get_chat_service),
):
    """Agent 流式对话端点

    Args:
        request: 聊天请求，包含消息、todo_id 和对话历史

    Returns:
        StreamingResponse: 流式响应
    """
    try:
        logger.info(
            f"[agent/chat/stream] 收到请求: message={request.message[:100]}..., "
            f"todo_id={request.todo_id}"
        )

        # 确保有 session_id
        session_id = request.conversation_id
        if not session_id:
            session_id = chat_service.generate_session_id()
            logger.info(f"[agent/chat/stream] 创建新会话: {session_id}")

        # 检查/创建会话
        chat = chat_service.get_chat_by_session_id(session_id)
        if not chat:
            chat_service.create_chat(
                session_id=session_id,
                chat_type="agent",
                title=request.message[:50] if len(request.message) > 50 else request.message,  # noqa: PLR2004
                context_id=request.todo_id,
            )
            logger.info(f"[agent/chat/stream] 在数据库中创建会话: {session_id}, 类型: agent")

        # 保存用户消息
        chat_service.add_message(
            session_id=session_id,
            role="user",
            content=request.message,
        )

        async def generate():
            """异步生成器：流式返回 Agent 响应"""
            total_content = ""
            try:
                async for chunk in run_agent_stream(
                    message=request.message,
                    todo_id=request.todo_id,
                    conversation_history=request.conversation_history,
                ):
                    total_content += chunk
                    yield chunk

                # 保存助手回复
                if total_content:
                    chat_service.add_message(
                        session_id=session_id,
                        role="assistant",
                        content=total_content,
                    )
                    logger.info("[agent/chat/stream] 消息已保存到数据库")

            except Exception as e:
                logger.error(f"[agent/chat/stream] 生成失败: {e}")
                error_msg = f'{{"response_type": "message", "content": "抱歉，处理请求时出错了: {e!s}"}}'
                yield error_msg

        headers = {
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "X-Session-Id": session_id,
        }

        return StreamingResponse(
            generate(),
            media_type="text/plain; charset=utf-8",
            headers=headers,
        )

    except Exception as e:
        logger.error(f"[agent/chat/stream] 处理失败: {e}")
        raise HTTPException(status_code=500, detail="Agent 聊天处理失败") from e


@router.post("/confirm-edit")
async def agent_confirm_edit(request: ConfirmEditRequest):
    """确认编辑操作

    Args:
        request: 编辑确认请求

    Returns:
        操作结果
    """
    try:
        logger.info(
            f"[agent/confirm-edit] todo_id={request.todo_id}, "
            f"field={request.field}"
        )

        result = await confirm_edit(
            todo_id=request.todo_id,
            field=request.field,
            new_value=request.new_value,
        )

        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error", "编辑失败"))

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[agent/confirm-edit] 处理失败: {e}")
        raise HTTPException(status_code=500, detail="确认编辑失败") from e


@router.post("/confirm-decompose")
async def agent_confirm_decompose(request: ConfirmDecomposeRequest):
    """确认拆解操作

    Args:
        request: 拆解确认请求

    Returns:
        操作结果
    """
    try:
        logger.info(
            f"[agent/confirm-decompose] todo_id={request.todo_id}, "
            f"subtasks_count={len(request.subtasks)}"
        )

        result = await confirm_decompose(
            todo_id=request.todo_id,
            subtasks=request.subtasks,
        )

        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error", "拆解失败"))

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[agent/confirm-decompose] 处理失败: {e}")
        raise HTTPException(status_code=500, detail="确认拆解失败") from e

