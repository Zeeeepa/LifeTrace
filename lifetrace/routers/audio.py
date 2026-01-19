"""音频录制和转录相关路由"""

import asyncio
import json
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse

from lifetrace.services.asr_client import ASRClient
from lifetrace.services.audio_service import AudioService
from lifetrace.util.logging_config import get_logger

logger = get_logger()

router = APIRouter(prefix="/api/audio", tags=["audio"])

# 全局服务实例
asr_client = ASRClient()
audio_service = AudioService()


def _create_result_callback(
    websocket: WebSocket, transcription_text_ref: list[str], is_connected_ref: list[bool]
):
    """创建识别结果回调函数"""

    async def _send_result(text: str, is_final: bool):
        """异步发送结果"""
        try:
            # 检查连接状态标志和WebSocket状态
            if is_connected_ref[0] and websocket.client_state.name == "CONNECTED":
                await websocket.send_json(
                    {
                        "header": {"name": "TranscriptionResultChanged"},
                        "payload": {"result": text, "is_final": is_final},
                    }
                )
        except (RuntimeError, Exception) as e:
            # RuntimeError 可能表示连接已关闭
            is_connected_ref[0] = False
            logger.debug(f"Failed to send result to client (connection may be closed): {e}")

    def on_result(text: str, is_final: bool):
        """处理识别结果"""
        if text and is_connected_ref[0]:
            transcription_text_ref[0] += text
            # 发送给前端（检查连接状态）
            # 使用 create_task 但捕获异常，避免在连接关闭后发送
            try:
                if is_connected_ref[0] and websocket.client_state.name == "CONNECTED":
                    asyncio.create_task(_send_result(text, is_final))
            except Exception as e:
                logger.debug(f"Failed to send result to client (connection may be closed): {e}")

    return on_result


def _create_realtime_nlp_handler(  # noqa: C901, PLR0915
    websocket: WebSocket,
    is_connected_ref: list[bool],
    *,
    throttle_seconds: float = 8.0,
):
    """
    录制中实时优化/提取（仅对 final=true 的新句子累加，节流触发）。

    推送事件：
    - OptimizedTextChanged: payload { text }
    - ExtractionChanged: payload { todos, schedules }
    """

    class _RealtimeNlpThrottler:
        def __init__(self):
            self._buffer = ""
            self._last_emit = 0.0
            self._pending: asyncio.Task | None = None

        async def _send(self, name: str, payload: dict[str, Any]) -> None:
            try:
                if is_connected_ref[0] and websocket.client_state.name == "CONNECTED":
                    await websocket.send_json({"header": {"name": name}, "payload": payload})
            except Exception as e:
                is_connected_ref[0] = False
                logger.debug(f"Failed to send {name} (connection may be closed): {e}")

        async def _compute(self, text_snapshot: str) -> tuple[str, dict[str, Any]]:
            optimized = text_snapshot
            extracted: dict[str, Any] = {"todos": [], "schedules": []}
            try:
                optimized = await audio_service.optimize_transcription_text(text_snapshot)
            except Exception as e:
                logger.error(f"实时优化失败: {e}")
            try:
                extracted = await audio_service.extract_todos_and_schedules(text_snapshot)
            except Exception as e:
                logger.error(f"实时提取失败: {e}")
            return optimized, extracted

        async def _run_once(self) -> None:
            text_snapshot = self._buffer.strip()
            if not text_snapshot:
                return
            optimized, extracted = await self._compute(text_snapshot)
            await self._send("OptimizedTextChanged", {"text": optimized})
            await self._send(
                "ExtractionChanged",
                {
                    "todos": extracted.get("todos", []),
                    "schedules": extracted.get("schedules", []),
                },
            )

        async def _debounced_run(self, delay: float) -> None:
            try:
                await asyncio.sleep(delay)
                await self._run_once()
            finally:
                self._pending = None

        def on_final_sentence(self, text: str) -> None:
            if not text:
                return
            if self._buffer:
                self._buffer += "\n"
            self._buffer += text.strip()

            now = asyncio.get_event_loop().time()
            elapsed = now - self._last_emit
            if elapsed >= throttle_seconds:
                self._last_emit = now
                asyncio.create_task(self._run_once())
                return

            if self._pending is None:
                delay = max(0.0, throttle_seconds - elapsed)
                self._pending = asyncio.create_task(self._debounced_run(delay))

        def cancel(self) -> None:
            if self._pending and not self._pending.done():
                self._pending.cancel()
            self._pending = None

    throttler = _RealtimeNlpThrottler()
    return throttler.on_final_sentence, throttler.cancel


def _create_error_callback(websocket: WebSocket, is_connected_ref: list[bool]):
    """创建错误回调函数"""

    async def _send_error(error: Exception):
        """异步发送错误"""
        try:
            # 检查连接状态标志和WebSocket状态
            if is_connected_ref[0] and websocket.client_state.name == "CONNECTED":
                await websocket.send_json(
                    {
                        "header": {"name": "TaskFailed"},
                        "payload": {"error": str(error)},
                    }
                )
        except (RuntimeError, Exception) as e:
            # RuntimeError 可能表示连接已关闭
            is_connected_ref[0] = False
            logger.debug(f"Failed to send error to client (connection may be closed): {e}")

    def on_error(error: Exception):
        """处理错误"""
        logger.error(f"ASR转录错误: {error}")
        # 使用 create_task 但捕获异常，避免在连接关闭后发送
        if is_connected_ref[0]:
            try:
                if websocket.client_state.name == "CONNECTED":
                    asyncio.create_task(_send_error(error))
            except Exception as e:
                logger.debug(f"Failed to send error to client (connection may be closed): {e}")

    return on_error


async def _audio_stream_generator(websocket: WebSocket, audio_chunks: list[bytes]):
    """生成音频流（初始化消息已在外部处理）"""
    while True:
        try:
            data = await websocket.receive()
            if "bytes" in data:
                # 接收音频二进制数据
                chunk = data["bytes"]
                if chunk:
                    audio_chunks.append(chunk)
                    yield chunk
            elif "text" in data:
                # 处理文本消息（如停止信号）
                try:
                    message = json.loads(data["text"])
                    if message.get("type") == "stop":
                        logger.info("Received stop signal from client")
                        break
                except json.JSONDecodeError:
                    # 如果不是JSON，忽略（可能是其他文本消息）
                    logger.debug(f"Ignoring non-JSON text message: {data.get('text', '')[:50]}")
        except WebSocketDisconnect:
            logger.info("WebSocket disconnected in audio stream generator")
            break
        except Exception as e:
            logger.error(f"Error in audio stream generator: {e}")
            break


@router.websocket("/transcribe")
async def websocket_transcribe(websocket: WebSocket):  # noqa: C901, PLR0915
    """WebSocket接口，用于实时语音转录"""
    await websocket.accept()
    logger.info("WebSocket client connected")

    recording_id: int | None = None
    recording_started_at: datetime | None = None
    transcription_text_ref: list[str] = [""]
    audio_chunks: list[bytes] = []
    is_connected_ref: list[bool] = [True]  # 连接状态标志
    on_final_sentence, cancel_realtime_nlp = _create_realtime_nlp_handler(
        websocket, is_connected_ref, throttle_seconds=8.0
    )

    try:
        # 接收初始化消息（支持两种格式）
        init_message = await websocket.receive_json()
        logger.info(f"Received init message: {init_message}")
        # 支持 { type: "start", is_24x7: ... } 或 { is_24x7: ... }
        _is_24x7 = init_message.get("is_24x7", False)  # 保留用于未来扩展

        # 记录开始时间用于计算时长
        recording_started_at = datetime.utcnow()

        # 创建录音记录
        # TODO: 实际应该从上传的音频文件创建记录
        # 这里暂时跳过，实际实现时需要先上传音频文件

        # 创建回调函数
        on_result_base = _create_result_callback(
            websocket, transcription_text_ref, is_connected_ref
        )

        def on_result(text: str, is_final: bool):
            on_result_base(text, is_final)
            # 录制中：只在 final=true 时触发实时优化/提取
            if is_final:
                on_final_sentence(text)

        on_error = _create_error_callback(websocket, is_connected_ref)

        # 启动ASR转录
        await asr_client.transcribe_stream(
            _audio_stream_generator(websocket, audio_chunks),
            on_result=on_result,
            on_error=on_error,
        )

        # 在流结束后持久化录音文件，并创建/更新录音记录
        if audio_chunks and recording_started_at:
            try:
                file_bytes = b"".join(audio_chunks)
                duration = (datetime.utcnow() - recording_started_at).total_seconds()
                file_path = audio_service.generate_audio_file_path(
                    recording_started_at, filename=f"{recording_started_at.strftime('%H%M%S')}.webm"
                )
                file_path.parent.mkdir(parents=True, exist_ok=True)
                file_path.write_bytes(file_bytes)

                # 如果尚未有记录，则创建
                if not recording_id:
                    recording_id = audio_service.create_recording(
                        file_path=str(file_path),
                        file_size=len(file_bytes),
                        duration=duration,
                        is_24x7=_is_24x7,
                    )
                # 标记录音完成
                if recording_id:
                    audio_service.complete_recording(recording_id)
            except Exception as e:
                logger.error(f"Failed to save recording file: {e}")

        # 转录完成后保存（自动优化和提取）
        if transcription_text_ref[0] and recording_id:
            await audio_service.save_transcription(
                recording_id=recording_id,
                original_text=transcription_text_ref[0],
                auto_optimize=True,
            )

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
        is_connected_ref[0] = False
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse WebSocket message: {e}")
        is_connected_ref[0] = False
        try:
            await websocket.close(code=1003, reason="Invalid message format")
        except Exception:
            pass
    except Exception as e:
        logger.error(f"WebSocket error: {e}", exc_info=True)
        is_connected_ref[0] = False
        try:
            await websocket.close(code=1011, reason=str(e))
        except Exception:
            pass
    finally:
        # 确保连接状态标志被设置为False
        is_connected_ref[0] = False
        cancel_realtime_nlp()


@router.get("/recordings")
async def get_recordings(date: str | None = Query(None)):
    """获取录音列表"""
    try:
        if date:
            # 处理日期字符串，支持多种格式
            try:
                # 尝试解析ISO格式
                if "T" in date or "Z" in date:
                    target_date = datetime.fromisoformat(date.replace("Z", "+00:00"))
                else:
                    # 处理 YYYY-MM-DD 格式
                    from datetime import date as date_type

                    date_obj = date_type.fromisoformat(date)
                    target_date = datetime.combine(date_obj, datetime.min.time())
            except ValueError as e:
                logger.error(f"日期格式错误: {date}, {e}")
                return JSONResponse({"error": f"无效的日期格式: {date}"}, status_code=400)
        else:
            target_date = datetime.utcnow()

        recordings = audio_service.get_recordings_by_date(target_date)

        result = []
        for rec in recordings:
            if not rec:
                continue
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
        logger.error(f"获取录音列表失败: {e}", exc_info=True)
        return JSONResponse({"error": str(e)}, status_code=500)


@router.get("/recording/{recording_id}/file")
async def get_recording_file(recording_id: int):
    """获取录音文件（用于前端播放）"""
    try:
        from lifetrace.storage import get_session
        from lifetrace.storage.models import AudioRecording

        with get_session() as session:
            rec = session.get(AudioRecording, recording_id)
            if not rec or not rec.file_path:
                return JSONResponse({"error": "录音不存在"}, status_code=404)
            return FileResponse(
                path=rec.file_path,
                media_type="audio/webm",
                filename=Path(rec.file_path).name,
            )
    except Exception as e:
        logger.error(f"获取录音文件失败: {e}", exc_info=True)
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
