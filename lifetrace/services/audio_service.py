"""音频服务层

处理音频录制、存储、转录等业务逻辑。
"""

import asyncio
from datetime import datetime
from pathlib import Path
from typing import Any

from sqlmodel import select

from lifetrace.llm.llm_client import LLMClient
from lifetrace.services.audio_extraction_service import AudioExtractionService
from lifetrace.storage import get_session
from lifetrace.storage.models import AudioRecording, Transcription
from lifetrace.util.logging_config import get_logger
from lifetrace.util.path_utils import get_user_data_dir
from lifetrace.util.prompt_loader import get_prompt
from lifetrace.util.settings import settings
from lifetrace.util.time_utils import to_local

logger = get_logger()


class AudioService:
    """音频服务"""

    def __init__(self):
        """初始化音频服务"""
        self.llm_client = LLMClient()
        self.extraction_service = AudioExtractionService(self.llm_client)
        self.audio_base_dir = Path(get_user_data_dir()) / settings.audio.storage.audio_dir
        self.temp_audio_dir = Path(get_user_data_dir()) / settings.audio.storage.temp_audio_dir
        self.audio_base_dir.mkdir(parents=True, exist_ok=True)
        self.temp_audio_dir.mkdir(parents=True, exist_ok=True)

    def get_audio_dir_for_date(self, date: datetime) -> Path:
        """获取指定日期的音频存储目录（按年月日组织）

        Args:
            date: 日期

        Returns:
            音频目录路径（格式：audio/2025/01/17/）
        """
        year = date.strftime("%Y")
        month = date.strftime("%m")
        day = date.strftime("%d")
        audio_dir = self.audio_base_dir / year / month / day
        audio_dir.mkdir(parents=True, exist_ok=True)
        return audio_dir

    def generate_audio_file_path(self, date: datetime, filename: str | None = None) -> Path:
        """生成音频文件路径

        Args:
            date: 日期
            filename: 文件名（可选，如果不提供则自动生成）

        Returns:
            音频文件路径
        """
        audio_dir = self.get_audio_dir_for_date(date)
        if filename:
            return audio_dir / filename
        # 自动生成文件名：HHMMSS.wav
        timestamp = date.strftime("%H%M%S")
        return audio_dir / f"{timestamp}.wav"

    def create_recording(
        self,
        file_path: str,
        file_size: int,
        duration: float,
        is_24x7: bool = False,
    ) -> int:
        """创建录音记录

        Args:
            file_path: 音频文件路径
            file_size: 文件大小（字节）
            duration: 录音时长（秒）
            is_24x7: 是否为7x24小时录制

        Returns:
            创建的AudioRecording对象
        """
        # 注意：不要把 ORM 实例（AudioRecording）跨 session 返回到路由层；
        # SQLAlchemy 默认会在 commit 后过期属性，session 关闭后再访问会触发 refresh，
        # 从而报 “Instance ... is not bound to a Session”。
        # 这里只返回 recording_id，路由层需要对象时再用新的 session 查询。
        with get_session() as session:
            recording = AudioRecording(
                file_path=file_path,
                file_size=file_size,
                duration=duration,
                # 使用本地时间记录，避免前端显示存在时区偏移
                start_time=datetime.now(),
                status="recording",
                is_24x7=is_24x7,
                is_transcribed=False,
                is_extracted=False,
                is_summarized=False,
                is_full_audio=False,
                is_segment_audio=False,
                transcription_status="pending",
            )
            session.add(recording)
            session.commit()
            session.refresh(recording)
            return int(recording.id)

    def complete_recording(self, recording_id: int) -> AudioRecording | None:
        """完成录音

        Args:
            recording_id: 录音ID

        Returns:
            更新后的AudioRecording对象，如果不存在则返回None
        """
        with get_session() as session:
            recording = session.get(AudioRecording, recording_id)
            if recording:
                recording.status = "completed"
                # 使用本地时间记录结束时间
                recording.end_time = datetime.now()
                recording.transcription_status = "processing"
                session.commit()
                session.refresh(recording)
            return recording

    def get_recordings_by_date(self, date: datetime) -> list[dict[str, Any]]:
        """根据日期获取录音列表

        Args:
            date: 日期

        Returns:
            录音列表（序列化后的字典列表，避免 Session 错误）
        """
        with get_session() as session:
            start_of_day = date.replace(hour=0, minute=0, second=0, microsecond=0)
            end_of_day = date.replace(hour=23, minute=59, second=59, microsecond=999999)

            statement = select(AudioRecording).where(
                AudioRecording.start_time >= start_of_day,
                AudioRecording.start_time <= end_of_day,
                AudioRecording.deleted_at.is_(None),
            )
            recordings = session.exec(statement).all()
            # 在 session 内序列化数据，避免 Session 错误
            result = []
            for rec in recordings:
                result.append(
                    {
                        "id": rec.id,
                        "file_path": rec.file_path,
                        "file_size": rec.file_size,
                        "duration": rec.duration,
                        "start_time": to_local(rec.start_time),
                        "end_time": to_local(rec.end_time) if rec.end_time else None,
                        "status": rec.status,
                        "is_24x7": rec.is_24x7,
                        "is_transcribed": rec.is_transcribed,
                        "is_extracted": rec.is_extracted,
                        "is_summarized": rec.is_summarized,
                        "is_full_audio": rec.is_full_audio,
                        "is_segment_audio": rec.is_segment_audio,
                        "transcription_status": rec.transcription_status,
                    }
                )
            return result

    def _check_has_extraction(self, transcription: Transcription) -> bool:
        """检查转录记录是否有提取结果

        Args:
            transcription: 转录记录

        Returns:
            是否有提取结果
        """
        return bool(
            (
                transcription.extracted_todos
                and transcription.extracted_todos.strip()
                and transcription.extracted_todos.strip() != "[]"
            )
            or (
                transcription.extracted_schedules
                and transcription.extracted_schedules.strip()
                and transcription.extracted_schedules.strip() != "[]"
            )
            or (
                transcription.extracted_todos_optimized
                and transcription.extracted_todos_optimized.strip()
                and transcription.extracted_todos_optimized.strip() != "[]"
            )
            or (
                transcription.extracted_schedules_optimized
                and transcription.extracted_schedules_optimized.strip()
                and transcription.extracted_schedules_optimized.strip() != "[]"
            )
        )

    def _check_text_changes(
        self, existing: Transcription, segmented_text: str, optimized_text: str | None
    ) -> tuple[bool, bool]:
        """检查文本是否变化

        Args:
            existing: 现有转录记录
            segmented_text: 新的分段文本
            optimized_text: 新的优化文本

        Returns:
            (original_changed, optimized_changed) 元组
        """
        original_changed = (existing.original_text or "").strip() != (segmented_text or "").strip()
        optimized_changed = (existing.optimized_text or "").strip() != (
            optimized_text or ""
        ).strip()
        return original_changed, optimized_changed

    def _cleanup_duplicate_transcriptions(
        self, session, recording_id: int, existing: Transcription
    ) -> Transcription:
        """清理重复的转录记录

        Args:
            session: 数据库会话
            recording_id: 录音ID
            existing: 现有记录

        Returns:
            保留的记录
        """
        from sqlmodel import select

        all_records = list(
            session.exec(
                select(Transcription)
                .where(Transcription.audio_recording_id == recording_id)
                .order_by(Transcription.id.desc())
            ).all()
        )
        if len(all_records) > 1:
            logger.warning(
                f"[save_transcription] 录音 {recording_id} 发现 {len(all_records)} 条转录记录，"
                f"保留最新的（ID={all_records[0].id}），删除其他 {len(all_records) - 1} 条"
            )
            # 保留第一条（ID最大的），删除其他的
            for old_record in all_records[1:]:
                session.delete(old_record)
            existing = all_records[0]
            session.flush()
        return existing

    def _update_existing_transcription(
        self,
        session,
        existing: Transcription,
        recording_id: int,
        segmented_text: str,
        optimized_text: str | None,
    ) -> tuple[Transcription, bool]:
        """更新现有转录记录

        Args:
            session: 数据库会话
            existing: 现有记录
            recording_id: 录音ID
            segmented_text: 分段文本
            optimized_text: 优化文本

        Returns:
            (transcription, should_auto_extract) 元组
        """
        original_changed, optimized_changed = self._check_text_changes(
            existing, segmented_text, optimized_text
        )
        text_changed = original_changed or optimized_changed

        if not text_changed:
            logger.debug(f"[save_transcription] 录音 {recording_id} 文本未变化，跳过更新")
            return existing, False

        # 文本变化了，更新文本字段（保留提取结果）
        existing.original_text = segmented_text
        existing.optimized_text = optimized_text

        has_extraction = self._check_has_extraction(existing)
        should_auto_extract = False

        if not has_extraction:
            existing.extraction_status = "pending"
            should_auto_extract = True
        else:
            logger.info(
                f"[save_transcription] 录音 {recording_id} 文本变化但已有提取结果，"
                f"保留提取结果，不触发自动提取"
            )

        session.add(existing)
        return existing, should_auto_extract

    async def save_transcription(
        self,
        recording_id: int,
        original_text: str,
        auto_optimize: bool = True,
    ) -> Transcription:
        """保存转录文本（自动优化和提取）

        Args:
            recording_id: 录音ID
            original_text: 原始转录文本（自动分段）
            auto_optimize: 是否自动优化文本

        Returns:
            创建的Transcription对象
        """
        # 自动分段：基于句子结束标记
        segmented_text = self._auto_segment_text(original_text)

        # 自动优化文本
        optimized_text = None
        if auto_optimize and segmented_text:
            try:
                optimized_text = await self.optimize_transcription_text(segmented_text)
            except Exception as e:
                logger.error(f"自动优化文本失败: {e}")

        with get_session() as session:
            from sqlmodel import select

            # 检查是否已存在转录记录
            existing = session.exec(
                select(Transcription)
                .where(Transcription.audio_recording_id == recording_id)
                .order_by(Transcription.id.desc())
            ).first()

            # 清理重复记录
            if existing:
                existing = self._cleanup_duplicate_transcriptions(session, recording_id, existing)

            # 更新或创建记录
            if existing:
                transcription, should_auto_extract = self._update_existing_transcription(
                    session, existing, recording_id, segmented_text, optimized_text
                )
            else:
                logger.info(f"[save_transcription] 录音 {recording_id} 创建新转录记录")
                transcription = Transcription(
                    audio_recording_id=recording_id,
                    original_text=segmented_text,
                    optimized_text=optimized_text,
                    extraction_status="pending",
                )
                session.add(transcription)
                should_auto_extract = True

            session.commit()
            session.refresh(transcription)

            # 更新录音记录的转录状态
            recording = session.get(AudioRecording, recording_id)
            if recording:
                recording.transcription_status = "completed"
                session.commit()

            # 自动提取待办和日程（异步执行，不阻塞）
            if should_auto_extract:
                if segmented_text:
                    asyncio.create_task(
                        self._auto_extract_todos_and_schedules(
                            transcription.id, segmented_text, optimized=False
                        )
                    )
                if optimized_text:
                    asyncio.create_task(
                        self._auto_extract_todos_and_schedules(
                            transcription.id, optimized_text, optimized=True
                        )
                    )

            return transcription

    async def _auto_extract_todos_and_schedules(
        self, transcription_id: int, text: str, optimized: bool = False
    ) -> None:
        """自动提取待办和日程（后台任务）

        Args:
            transcription_id: 转录ID
            text: 要提取的文本
            optimized: 是否为优化文本的提取
        """
        try:
            result = await self.extraction_service.extract_todos_and_schedules(text)
            self.extraction_service.update_extraction(
                transcription_id=transcription_id,
                todos=result.get("todos", []),
                schedules=result.get("schedules", []),
                optimized=optimized,
            )
        except Exception as e:
            logger.error(f"自动提取待办和日程失败 (optimized={optimized}): {e}")

    def _auto_segment_text(self, text: str) -> str:
        """自动分段文本（基于句子结束标记和长度）

        Args:
            text: 原始文本

        Returns:
            分段后的文本（每段一行）
        """
        if not text:
            return ""

        # 句子结束标记
        sentence_endings = ["。", "！", "？", ".", "!", "?", "\n"]
        segments = []
        current_segment = ""
        max_segment_length = 200  # 最大段落长度

        for char in text:
            current_segment += char

            # 如果遇到句子结束标记，或者达到最大长度，则分段
            if char in sentence_endings or len(current_segment) >= max_segment_length:
                if current_segment.strip():
                    segments.append(current_segment.strip())
                current_segment = ""

        # 添加最后一段
        if current_segment.strip():
            segments.append(current_segment.strip())

        # 如果没有任何分段，返回原文本
        if not segments:
            return text

        # 用换行符连接各段
        return "\n".join(segments)

    async def optimize_transcription_text(self, text: str) -> str:
        """使用LLM优化转录文本

        Args:
            text: 原始转录文本

        Returns:
            优化后的文本
        """
        try:
            if not self.llm_client.is_available():
                logger.warning("LLM客户端不可用，跳过文本优化")
                return text

            # 从配置文件加载提示词
            system_prompt = get_prompt("transcription_optimization", "system_assistant")
            user_prompt = get_prompt("transcription_optimization", "user_prompt", text=text)

            if not system_prompt or not user_prompt:
                logger.warning("无法加载优化提示词，使用默认提示词")
                system_prompt = "你是一个专业的文本优化助手，擅长优化语音转录文本。"
                user_prompt = f"请优化以下语音转录文本，使其更加流畅、准确、易读。\n\n转录文本：\n{text}\n\n只返回优化后的文本，不要其他内容。"

            client = self.llm_client
            client._initialize_client()

            response = client.client.chat.completions.create(
                model=client.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.3,
            )

            optimized_text = response.choices[0].message.content.strip()
            # 移除可能的markdown代码块标记
            if optimized_text.startswith("```"):
                lines = optimized_text.split("\n")
                if lines[0].startswith("```"):
                    MIN_LINES_FOR_CODE_BLOCK = 2
                    if len(lines) > MIN_LINES_FOR_CODE_BLOCK:
                        optimized_text = "\n".join(lines[1:-1])
                optimized_text = optimized_text.strip()

            return optimized_text
        except Exception as e:
            logger.error(f"优化转录文本失败: {e}")
            return text

    @property
    def extract_todos_and_schedules(self):
        """委托给 extraction_service"""
        return self.extraction_service.extract_todos_and_schedules

    @property
    def update_extraction(self):
        """委托给 extraction_service"""
        return self.extraction_service.update_extraction

    @property
    def link_extracted_items(self):
        """委托给 extraction_service"""
        return self.extraction_service.link_extracted_items

    def get_transcription(self, recording_id: int) -> dict[str, Any] | None:
        """获取转录文本（已序列化）

        注意：不要将 ORM 实例返回到路由层，避免 Session 关闭后访问属性时报
        “Instance <Transcription ...> is not bound to a Session”。

        Args:
            recording_id: 录音ID

        Returns:
            包含转录字段的字典，如果不存在则返回None
        """
        with get_session() as session:
            # 查询转录记录（一个 recording_id 只应该有一条）
            statement = (
                select(Transcription)
                .where(Transcription.audio_recording_id == recording_id)
                .order_by(Transcription.id.desc())
            )
            transcription = session.exec(statement).first()
            if not transcription:
                return None

            return {
                "id": transcription.id,
                "audio_recording_id": transcription.audio_recording_id,
                "original_text": transcription.original_text,
                "optimized_text": transcription.optimized_text,
                "extracted_todos": transcription.extracted_todos,
                "extracted_schedules": transcription.extracted_schedules,
                "extracted_todos_optimized": transcription.extracted_todos_optimized,
                "extracted_schedules_optimized": transcription.extracted_schedules_optimized,
                "extraction_status": transcription.extraction_status,
                "created_at": transcription.created_at,
                "updated_at": transcription.updated_at,
            }
