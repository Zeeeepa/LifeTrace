"""音频录制和转录相关路由"""

import asyncio
import json
from datetime import datetime

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse

from lifetrace.services.asr_client import ASRClient
from lifetrace.services.audio_service import AudioService
from lifetrace.util.logging_config import get_logger

logger = get_logger()

router = APIRouter(prefix="/api/audio", tags=["audio"])

# 全局服务实例
asr_client = ASRClient()
audio_service = AudioService()


def _create_result_callback(websocket: WebSocket, transcription_text_ref: list[str]):
    """创建识别结果回调函数"""

    def on_result(text: str, is_final: bool):
        """处理识别结果"""
        if text:
            transcription_text_ref[0] += text
            # 发送给前端
            asyncio.create_task(
                websocket.send_json(
                    {
                        "header": {"name": "TranscriptionResultChanged"},
                        "payload": {"result": text, "is_final": is_final},
                    }
                )
            )

    return on_result


def _create_error_callback(websocket: WebSocket):
    """创建错误回调函数"""

    def on_error(error: Exception):
        """处理错误"""
        logger.error(f"ASR转录错误: {error}")
        asyncio.create_task(
            websocket.send_json(
                {
                    "header": {"name": "TaskFailed"},
                    "payload": {"error": str(error)},
                }
            )
        )

    return on_error


async def _audio_stream_generator(websocket: WebSocket, audio_chunks: list[bytes]):
    """生成音频流"""
    while True:
        try:
            data = await websocket.receive()
            if "bytes" in data:
                # 接收音频二进制数据
                chunk = data["bytes"]
                audio_chunks.append(chunk)
                yield chunk
            elif "text" in data:
                # 处理文本消息（如停止信号）
                try:
                    message = json.loads(data["text"])
                    if message.get("type") == "stop":
                        break
                except json.JSONDecodeError:
                    # 如果不是JSON，忽略（可能是其他文本消息）
                    pass
        except WebSocketDisconnect:
            break


@router.websocket("/transcribe")
async def websocket_transcribe(websocket: WebSocket):
    """WebSocket接口，用于实时语音转录"""
    await websocket.accept()
    logger.info("WebSocket client connected")

    recording_id: int | None = None
    transcription_text_ref: list[str] = [""]
    audio_chunks: list[bytes] = []

    try:
        # 接收初始化消息（支持两种格式）
        init_message = await websocket.receive_json()
        logger.info(f"Received init message: {init_message}")
        # 支持 { type: "start", is_24x7: ... } 或 { is_24x7: ... }
        _is_24x7 = init_message.get("is_24x7", False)  # 保留用于未来扩展

        # 创建录音记录
        # TODO: 实际应该从上传的音频文件创建记录
        # 这里暂时跳过，实际实现时需要先上传音频文件

        # 创建回调函数
        on_result = _create_result_callback(websocket, transcription_text_ref)
        on_error = _create_error_callback(websocket)

        # 启动ASR转录
        await asr_client.transcribe_stream(
            _audio_stream_generator(websocket, audio_chunks),
            on_result=on_result,
            on_error=on_error,
        )

        # 转录完成后保存（自动优化和提取）
        if transcription_text_ref[0] and recording_id:
            await audio_service.save_transcription(
                recording_id=recording_id,
                original_text=transcription_text_ref[0],
                auto_optimize=True,
            )

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse WebSocket message: {e}")
        try:
            await websocket.close(code=1003, reason="Invalid message format")
        except Exception:
            pass
    except Exception as e:
        logger.error(f"WebSocket error: {e}", exc_info=True)
        try:
            await websocket.close(code=1011, reason=str(e))
        except Exception:
            pass


@router.get("/recordings")
async def get_recordings(date: str | None = Query(None)):
    """获取录音列表"""
    try:
        if date:
            target_date = datetime.fromisoformat(date.replace("Z", "+00:00"))
        else:
            target_date = datetime.utcnow()

        recordings = audio_service.get_recordings_by_date(target_date)

        result = []
        for rec in recordings:
            start_time = rec.start_time
            result.append(
                {
                    "id": rec.id,
                    "date": start_time.strftime("%m月%d日 录音"),
                    "time": start_time.strftime("%H:%M"),
                    "duration": f"{int(rec.duration // 60)}:{int(rec.duration % 60):02d}",
                    "size": f"{rec.file_size / 1024:.1f} KB",
                    "isCurrent": rec.status == "recording",
                }
            )

        return JSONResponse({"recordings": result})
    except Exception as e:
        logger.error(f"获取录音列表失败: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)


@router.get("/transcription/{recording_id}")
async def get_transcription(recording_id: int, optimized: bool = Query(False)):
    """获取转录文本"""
    try:
        transcription = audio_service.get_transcription(recording_id)
        if not transcription:
            return JSONResponse({"error": "转录不存在"}, status_code=404)

        text = transcription.optimized_text if optimized else transcription.original_text
        if not text:
            text = ""

        # 解析提取的待办和日程
        todos = []
        schedules = []
        if transcription.extracted_todos:
            try:
                todos = json.loads(transcription.extracted_todos)
            except Exception:
                pass
        if transcription.extracted_schedules:
            try:
                schedules = json.loads(transcription.extracted_schedules)
            except Exception:
                pass

        return JSONResponse(
            {
                "text": text,
                "recording_id": recording_id,
                "todos": todos,
                "schedules": schedules,
            }
        )
    except Exception as e:
        logger.error(f"获取转录文本失败: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)


@router.post("/optimize")
async def optimize_transcription(recording_id: int):
    """优化转录文本（使用LLM）"""
    try:
        transcription = audio_service.get_transcription(recording_id)
        if not transcription:
            return JSONResponse({"error": "转录不存在"}, status_code=404)

        text = transcription.original_text or ""
        if not text:
            return JSONResponse({"error": "转录文本为空"}, status_code=400)

        # 使用LLM优化
        optimized_text = await audio_service.optimize_transcription_text(text)

        # 更新转录记录
        from lifetrace.storage import get_session

        with get_session() as session:
            transcription.optimized_text = optimized_text
            session.add(transcription)
            session.commit()
            session.refresh(transcription)

        return JSONResponse({"optimized_text": optimized_text})
    except Exception as e:
        logger.error(f"优化转录文本失败: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)


@router.post("/extract")
async def extract_todos_and_schedules(recording_id: int):
    """提取待办事项和日程安排"""
    try:
        transcription = audio_service.get_transcription(recording_id)
        if not transcription:
            return JSONResponse({"error": "转录不存在"}, status_code=404)

        text = transcription.original_text or ""
        if not text:
            return JSONResponse({"error": "转录文本为空"}, status_code=400)

        # 使用LLM提取
        result = await audio_service.extract_todos_and_schedules(text)

        # 更新提取结果
        audio_service.update_extraction(
            transcription_id=transcription.id,
            todos=result.get("todos", []),
            schedules=result.get("schedules", []),
        )

        return JSONResponse(result)
    except Exception as e:
        logger.error(f"提取待办和日程失败: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)
