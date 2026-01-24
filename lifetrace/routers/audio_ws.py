"""Audio websocket routes (recording + realtime ASR + realtime NLP).

Split from `lifetrace.routers.audio` to keep router files small and readable.
"""

from __future__ import annotations

import asyncio
import json
import struct
from collections.abc import Callable
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

# ---- constants (avoid magic numbers) ----
SAMPLE_RATE = 16000
NUM_CHANNELS = 1
BITS_PER_SAMPLE = 16

PCM_SILENCE_MAX_ABS = 50
PCM_SILENCE_RMS = 20

MAX_AGC_GAIN = 4.0
AGC_APPLY_THRESHOLD_GAIN = 1.05
INT16_MAX = 32767
INT16_MIN = -32768
AGC_TARGET_PEAK_RATIO = 0.85


def _to_local(dt: datetime | None) -> datetime | None:
    """Convert datetime to local timezone (timezone-aware)."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        import time

        offset = -time.timezone if time.daylight == 0 else -time.altzone
        local_tz = timezone(timedelta(seconds=offset))
        return dt.replace(tzinfo=local_tz)
    return dt.astimezone()


def _pcm16le_to_wav(
    pcm_data: bytes,
    sample_rate: int = SAMPLE_RATE,
    num_channels: int = NUM_CHANNELS,
    bits_per_sample: int = BITS_PER_SAMPLE,
) -> bytes:
    """Wrap raw PCM16LE bytes into WAV container bytes."""
    byte_rate = sample_rate * num_channels * bits_per_sample // 8
    block_align = num_channels * bits_per_sample // 8
    data_size = len(pcm_data)

    fmt_chunk_size = 16
    riff_chunk_size = 4 + (8 + fmt_chunk_size) + (8 + data_size)

    header = b"RIFF"
    header += struct.pack("<I", riff_chunk_size)
    header += b"WAVE"

    header += b"fmt "
    header += struct.pack(
        "<IHHIIHH",
        fmt_chunk_size,
        1,  # PCM
        num_channels,
        sample_rate,
        byte_rate,
        block_align,
        bits_per_sample,
    )

    header += b"data"
    header += struct.pack("<I", data_size)
    return header + pcm_data


def _create_result_callback(
    *,
    websocket: WebSocket,
    logger,
    transcription_text_ref: list[str],
    is_connected_ref: list[bool],
) -> Callable[[str, bool], None]:
    """Create ASR result callback.

    NOTE: Only commit final sentences to `transcription_text_ref` to avoid duplicates.
    """

    async def _send_result(text: str, is_final: bool) -> None:
        try:
            if (
                is_connected_ref[0]
                and websocket.application_state == WebSocketState.CONNECTED
                and websocket.client_state == WebSocketState.CONNECTED
            ):
                await websocket.send_json(
                    {
                        "header": {"name": "TranscriptionResultChanged"},
                        "payload": {"result": text, "is_final": is_final},
                    }
                )
        except Exception as e:
            is_connected_ref[0] = False
            logger.warning(f"Failed to send TranscriptionResultChanged to client: {e}")

    def on_result(text: str, is_final: bool) -> None:
        if not text or not is_connected_ref[0]:
            return

        if is_final:
            committed = transcription_text_ref[0]
            needs_gap = committed and not committed.endswith("\n")
            committed += ("\n" if needs_gap else "") + text
            transcription_text_ref[0] = committed

        try:
            if (
                is_connected_ref[0]
                and websocket.application_state == WebSocketState.CONNECTED
                and websocket.client_state == WebSocketState.CONNECTED
            ):
                asyncio.create_task(_send_result(text, is_final))
        except Exception as e:
            logger.warning(f"Failed to schedule sending TranscriptionResultChanged: {e}")

    return on_result


def _create_error_callback(*, websocket: WebSocket, logger, is_connected_ref: list[bool]):
    async def _send_error(error: Exception) -> None:
        try:
            if (
                is_connected_ref[0]
                and websocket.application_state == WebSocketState.CONNECTED
                and websocket.client_state == WebSocketState.CONNECTED
            ):
                await websocket.send_json(
                    {"header": {"name": "TaskFailed"}, "payload": {"error": str(error)}}
                )
        except Exception as e:
            is_connected_ref[0] = False
            logger.warning(f"Failed to send TaskFailed to client: {e}")

    def on_error(error: Exception) -> None:
        logger.error(f"ASR转录错误: {error}")
        if is_connected_ref[0]:
            try:
                if (
                    websocket.application_state == WebSocketState.CONNECTED
                    and websocket.client_state == WebSocketState.CONNECTED
                ):
                    asyncio.create_task(_send_error(error))
            except Exception as e:
                logger.warning(f"Failed to schedule sending TaskFailed: {e}")

    return on_error


def _create_realtime_nlp_handler(  # noqa: C901
    *,
    websocket: WebSocket,
    logger,
    audio_service,
    is_connected_ref: list[bool],
    throttle_seconds: float = 8.0,
):
    """Realtime optimize/extract during recording (only on final sentences)."""

    class _RealtimeNlpThrottler:
        def __init__(self):
            self._buffer = ""
            self._last_emit = 0.0
            self._pending: asyncio.Task | None = None

        async def _send(self, name: str, payload: dict[str, Any]) -> None:
            try:
                if not is_connected_ref[0]:
                    logger.info(f"Skip sending {name}: is_connected_ref=False")
                    return
                if not (
                    websocket.application_state == WebSocketState.CONNECTED
                    and websocket.client_state == WebSocketState.CONNECTED
                ):
                    logger.info(
                        f"Skip sending {name}: websocket state not CONNECTED "
                        f"(application_state={websocket.application_state}, client_state={websocket.client_state})"
                    )
                    return
                await websocket.send_json({"header": {"name": name}, "payload": payload})
                logger.debug(f"Sent {name} to client")
            except Exception as e:
                is_connected_ref[0] = False
                logger.warning(f"Failed to send {name} to client: {e}")

        async def _compute(self, text_snapshot: str) -> tuple[str, dict[str, Any]]:
            optimized = text_snapshot
            extracted: dict[str, Any] = {"todos": [], "schedules": []}
            try:
                optimized = await audio_service.optimize_transcription_text(text_snapshot)
            except Exception as e:
                logger.error(f"实时优化失败: {e}")
            try:
                extracted = await audio_service.extraction_service.extract_todos_and_schedules(
                    text_snapshot
                )
            except Exception as e:
                logger.error(f"实时提取失败: {e}")
            return optimized, extracted

        async def _run_once(self) -> None:
            text_snapshot = self._buffer.strip()
            if not text_snapshot:
                return
            optimized, extracted = await self._compute(text_snapshot)

            preview = optimized.replace("\n", " ")[:200]
            todos_preview = extracted.get("todos", [])
            schedules_preview = extracted.get("schedules", [])
            logger.info("实时优化/提取完成，准备推送给前端")
            logger.info(f"优化预览: {preview}")
            logger.info(f"提取结果: todos={todos_preview}, schedules={schedules_preview}")

            await self._send("OptimizedTextChanged", {"text": optimized})
            await self._send(
                "ExtractionChanged",
                {"todos": extracted.get("todos", []), "schedules": extracted.get("schedules", [])},
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


async def _audio_stream_generator(
    websocket: WebSocket,
    logger,
    audio_chunks: list[bytes],
    segment_timestamps_ref: list[list[float] | None],
):
    """Yield audio bytes from websocket until stop signal.

    Args:
        segment_timestamps_ref: 用于存储从客户端接收的时间戳数组的引用
    """
    while True:
        try:
            data = await websocket.receive()
            if "bytes" in data:
                chunk = data["bytes"]
                if chunk:
                    audio_chunks.append(chunk)
                    yield chunk
                continue
            if "text" in data:
                try:
                    message = json.loads(data["text"])
                    if message.get("type") == "stop":
                        segment_timestamps_from_frontend = message.get("segment_timestamps", [])
                        if isinstance(segment_timestamps_from_frontend, list):
                            segment_timestamps_ref[0] = segment_timestamps_from_frontend
                            logger.info(
                                f"Received stop signal from client with {len(segment_timestamps_from_frontend)} segment timestamps"
                            )
                        else:
                            logger.info("Received stop signal from client")
                        break
                except json.JSONDecodeError:
                    logger.debug(f"Ignoring non-JSON text message: {data.get('text', '')[:50]}")
                continue
        except WebSocketDisconnect:
            logger.info("WebSocket disconnected in audio stream generator")
            break
        except Exception as e:
            logger.error(f"Error in audio stream generator: {e}")
            break


def _parse_init_message(logger, init_message: dict[str, Any]) -> bool:
    logger.info(f"Received init message: {init_message}")
    return bool(init_message.get("is_24x7", False))


def _apply_agc_to_pcm(logger, pcm_bytes: bytes) -> bytes:
    try:
        import array

        samples = array.array("h")
        samples.frombytes(pcm_bytes)
        if not samples:
            return pcm_bytes

        max_abs = max(abs(s) for s in samples)
        rms = (sum(s * s for s in samples) / len(samples)) ** 0.5
        logger.info(f"录音原始PCM: samples={len(samples)}, max_abs={max_abs}, rms={rms:.2f}")

        if max_abs < PCM_SILENCE_MAX_ABS and rms < PCM_SILENCE_RMS:
            logger.warning("录音PCM振幅极低，可能无声；请检查麦克风/权限/设备输入。")
            return pcm_bytes

        target_peak = AGC_TARGET_PEAK_RATIO * INT16_MAX
        gain = target_peak / max_abs if max_abs > 0 else 1.0
        gain = min(gain, MAX_AGC_GAIN)
        if gain <= AGC_APPLY_THRESHOLD_GAIN:
            return pcm_bytes

        logger.info(f"应用自动增益: x{gain:.2f}")
        for i in range(len(samples)):
            v = int(samples[i] * gain)
            if v > INT16_MAX:
                v = INT16_MAX
            elif v < INT16_MIN:
                v = INT16_MIN
            samples[i] = v
        return samples.tobytes()
    except Exception as e:
        logger.debug(f"音量检测失败: {e}")
        return pcm_bytes


def _persist_recording(
    *,
    logger,
    audio_service,
    audio_chunks: list[bytes],
    recording_started_at: datetime,
    is_24x7: bool,
) -> tuple[int | None, float | None]:
    if not audio_chunks:
        return None, None

    pcm_bytes = b"".join(audio_chunks)
    duration = (datetime.now() - recording_started_at).total_seconds()

    pcm_bytes = _apply_agc_to_pcm(logger, pcm_bytes)
    wav_bytes = _pcm16le_to_wav(pcm_bytes)

    file_path = audio_service.generate_audio_file_path(recording_started_at)
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_bytes(wav_bytes)

    recording_id = audio_service.create_recording(
        file_path=str(file_path),
        file_size=len(wav_bytes),
        duration=duration,
        is_24x7=is_24x7,
    )
    audio_service.complete_recording(recording_id)
    return recording_id, duration


async def _save_transcription_if_any(
    *,
    audio_service,
    recording_id: int | None,
    text: str,
    segment_timestamps: list[float] | None = None,
) -> None:
    if not recording_id or not text:
        return
    await audio_service.save_transcription(
        recording_id=recording_id,
        original_text=text,
        auto_optimize=True,
        segment_timestamps=segment_timestamps,
    )


async def _handle_transcribe_ws(*, websocket: WebSocket, logger, asr_client, audio_service) -> None:
    await websocket.accept()
    logger.info(
        f"WebSocket client connected: application_state={websocket.application_state}, client_state={websocket.client_state}"
    )

    recording_started_at = datetime.now()
    transcription_text_ref: list[str] = [""]
    audio_chunks: list[bytes] = []
    is_connected_ref: list[bool] = [True]
    segment_timestamps_ref: list[list[float] | None] = [None]  # 存储从客户端接收的时间戳

    on_final_sentence, cancel_realtime_nlp = _create_realtime_nlp_handler(
        websocket=websocket,
        logger=logger,
        audio_service=audio_service,
        is_connected_ref=is_connected_ref,
        throttle_seconds=8.0,
    )

    try:
        init_message = await websocket.receive_json()
        is_24x7 = _parse_init_message(logger, init_message)

        on_result_base = _create_result_callback(
            websocket=websocket,
            logger=logger,
            transcription_text_ref=transcription_text_ref,
            is_connected_ref=is_connected_ref,
        )

        def on_result(text: str, is_final: bool) -> None:
            on_result_base(text, is_final)
            if is_final:
                on_final_sentence(text)

        on_error = _create_error_callback(
            websocket=websocket, logger=logger, is_connected_ref=is_connected_ref
        )

        await asr_client.transcribe_stream(
            _audio_stream_generator(websocket, logger, audio_chunks, segment_timestamps_ref),
            on_result=on_result,
            on_error=on_error,
        )

        recording_id, _duration = _persist_recording(
            logger=logger,
            audio_service=audio_service,
            audio_chunks=audio_chunks,
            recording_started_at=recording_started_at,
            is_24x7=is_24x7,
        )
        await _save_transcription_if_any(
            audio_service=audio_service,
            recording_id=recording_id,
            text=transcription_text_ref[0],
            segment_timestamps=segment_timestamps_ref[0],
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
    finally:
        is_connected_ref[0] = False
        cancel_realtime_nlp()
        logger.info(
            f"WebSocket handler finished: application_state={websocket.application_state}, client_state={websocket.client_state}"
        )


def register_audio_ws_routes(*, router: APIRouter, logger, asr_client, audio_service) -> None:
    """Register websocket endpoints onto the given router."""

    @router.websocket("/transcribe")
    async def websocket_transcribe(websocket: WebSocket) -> None:
        await _handle_transcribe_ws(
            websocket=websocket, logger=logger, asr_client=asr_client, audio_service=audio_service
        )
