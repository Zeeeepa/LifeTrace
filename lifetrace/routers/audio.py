"""音频录制和转录相关路由"""

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Query
from fastapi.responses import FileResponse, JSONResponse

from lifetrace.routers.audio_ws import register_audio_ws_routes
from lifetrace.services.asr_client import ASRClient
from lifetrace.services.audio_service import AudioService
from lifetrace.util.logging_config import get_logger

logger = get_logger()

router = APIRouter(prefix="/api/audio", tags=["audio"])

# 全局服务实例
asr_client = ASRClient()
audio_service = AudioService()
register_audio_ws_routes(
    router=router, logger=logger, asr_client=asr_client, audio_service=audio_service
)


def _to_local(dt: datetime | None) -> datetime | None:
    """将时间转换为本地时区（带偏移），并返回 timezone-aware datetime。"""
    if dt is None:
        return None
    if dt.tzinfo is None:
        import time

        offset = -time.timezone if time.daylight == 0 else -time.altzone
        local_tz = timezone(timedelta(seconds=offset))
        return dt.replace(tzinfo=local_tz)
    return dt.astimezone()


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
            start_time = rec["start_time"]
            result.append(
                {
                    "id": rec["id"],
                    "date": start_time.strftime("%m月%d日 录音"),
                    "time": start_time.strftime("%H:%M"),
                    "duration": f"{int(rec['duration'] // 60)}:{int(rec['duration'] % 60):02d}",
                    "durationSeconds": float(rec["duration"]),
                    "size": f"{rec['file_size'] / 1024:.1f} KB",
                    "isCurrent": rec["status"] == "recording",
                }
            )

        return JSONResponse({"recordings": result})
    except Exception as e:
        logger.error(f"获取录音列表失败: {e}", exc_info=True)
        return JSONResponse({"error": str(e)}, status_code=500)


@router.get("/timeline")
async def get_timeline(date: str | None = Query(None), optimized: bool = Query(False)):
    """按日期返回录音时间线（含转录文本）"""
    try:
        if date:
            try:
                if "T" in date or "Z" in date:
                    target_date = datetime.fromisoformat(date.replace("Z", "+00:00"))
                else:
                    from datetime import date as date_type

                    date_obj = date_type.fromisoformat(date)
                    target_date = datetime.combine(date_obj, datetime.min.time())
            except ValueError as e:
                logger.error(f"日期格式错误: {date}, {e}")
                return JSONResponse({"error": f"无效的日期格式: {date}"}, status_code=400)
        else:
            target_date = datetime.now()

        recordings = audio_service.get_recordings_by_date(target_date)
        timeline: list[dict[str, Any]] = []
        for rec in recordings:
            if not rec:
                continue
            transcription = audio_service.get_transcription(int(rec["id"]))
            text = ""
            if transcription:
                if optimized and transcription.get("optimized_text"):
                    text = transcription.get("optimized_text") or ""
                else:
                    text = transcription.get("original_text") or ""
            start_local = _to_local(rec["start_time"])
            timeline.append(
                {
                    "id": rec["id"],
                    "start_time": (start_local or rec["start_time"]).isoformat(),
                    "duration": float(rec["duration"]),
                    "text": text,
                }
            )

        return JSONResponse({"timeline": timeline})
    except Exception as e:
        logger.error(f"获取时间线失败: {e}", exc_info=True)
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
            file_path = Path(rec.file_path)
            if not file_path.exists():
                logger.error(f"录音文件不存在: {file_path}")
                return JSONResponse({"error": "录音文件不存在或已被删除"}, status_code=404)
            return FileResponse(
                path=str(file_path),
                media_type="audio/wav",
                filename=file_path.name,
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

        text = transcription["optimized_text"] if optimized else transcription["original_text"]
        if not text:
            text = ""

        # 解析提取的待办和日程
        todos: list[dict[str, Any]] = []
        schedules: list[dict[str, Any]] = []
        if transcription.get("extracted_todos"):
            try:
                todos = json.loads(transcription["extracted_todos"])
            except Exception:
                pass
        if transcription.get("extracted_schedules"):
            try:
                schedules = json.loads(transcription["extracted_schedules"])
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

        text = transcription.get("original_text") or ""
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
