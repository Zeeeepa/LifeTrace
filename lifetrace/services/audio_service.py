"""音频服务层

处理音频录制、存储、转录等业务逻辑。
"""

import asyncio
import json
from datetime import datetime
from pathlib import Path
from typing import Any

from sqlmodel import select

from lifetrace.llm.llm_client import LLMClient
from lifetrace.storage import get_session
from lifetrace.storage.models import AudioRecording, Transcription
from lifetrace.util.logging_config import get_logger
from lifetrace.util.path_utils import get_user_data_dir
from lifetrace.util.prompt_loader import get_prompt
from lifetrace.util.settings import settings

logger = get_logger()


class AudioService:
    """音频服务"""

    def __init__(self):
        """初始化音频服务"""
        self.llm_client = LLMClient()
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
                start_time=datetime.utcnow(),
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
                recording.end_time = datetime.utcnow()
                recording.transcription_status = "processing"
                session.commit()
                session.refresh(recording)
            return recording

    def get_recordings_by_date(self, date: datetime) -> list[AudioRecording]:
        """根据日期获取录音列表

        Args:
            date: 日期

        Returns:
            录音列表
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
            return list(recordings)

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
            transcription = Transcription(
                audio_recording_id=recording_id,
                original_text=segmented_text,
                optimized_text=optimized_text,
                extraction_status="pending",
            )
            session.add(transcription)
            session.commit()
            session.refresh(transcription)

            # 更新录音记录的转录状态
            recording = session.get(AudioRecording, recording_id)
            if recording:
                recording.transcription_status = "completed"
                session.commit()

            # 自动提取待办和日程（异步执行，不阻塞）
            if segmented_text:
                asyncio.create_task(
                    self._auto_extract_todos_and_schedules(transcription.id, segmented_text)
                )

            return transcription

    async def _auto_extract_todos_and_schedules(self, transcription_id: int, text: str) -> None:
        """自动提取待办和日程（后台任务）"""
        try:
            result = await self.extract_todos_and_schedules(text)
            self.update_extraction(
                transcription_id=transcription_id,
                todos=result.get("todos", []),
                schedules=result.get("schedules", []),
            )
        except Exception as e:
            logger.error(f"自动提取待办和日程失败: {e}")

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

    async def extract_todos_and_schedules(self, text: str) -> dict[str, Any]:
        """使用LLM提取待办事项和日程安排

        Args:
            text: 转录文本

        Returns:
            包含todos和schedules的字典
        """
        try:
            if not self.llm_client.is_available():
                logger.warning("LLM客户端不可用，跳过提取")
                return {"todos": [], "schedules": []}

            # 从配置文件加载提示词
            system_prompt = get_prompt("transcription_extraction", "system_assistant")
            user_prompt = get_prompt("transcription_extraction", "user_prompt", text=text)

            if not system_prompt or not user_prompt:
                logger.warning("无法加载提取提示词，使用默认提示词")
                system_prompt = "你是一个专业的任务和日程提取助手。"
                user_prompt = f"请从以下转录文本中提取待办事项和日程安排。\n\n转录文本：\n{text}\n\n只返回JSON，不要其他内容。"

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

            result_text = response.choices[0].message.content.strip()
            # 移除可能的markdown代码块标记
            if result_text.startswith("```json"):
                result_text = result_text[7:]
            if result_text.startswith("```"):
                result_text = result_text[3:]
            if result_text.endswith("```"):
                result_text = result_text[:-3]
            result_text = result_text.strip()

            result = json.loads(result_text)
            return result
        except Exception as e:
            logger.error(f"提取待办和日程失败: {e}")
            return {"todos": [], "schedules": []}

    def update_extraction(
        self,
        transcription_id: int,
        todos: list[dict] | None = None,
        schedules: list[dict] | None = None,
    ) -> Transcription | None:
        """更新提取结果

        Args:
            transcription_id: 转录ID
            todos: 待办事项列表
            schedules: 日程安排列表

        Returns:
            更新后的Transcription对象
        """
        with get_session() as session:
            transcription = session.get(Transcription, transcription_id)
            if transcription:
                if todos:
                    transcription.extracted_todos = json.dumps(todos, ensure_ascii=False)
                if schedules:
                    transcription.extracted_schedules = json.dumps(schedules, ensure_ascii=False)
                transcription.extraction_status = "completed"
                session.commit()
                session.refresh(transcription)
            return transcription

    def get_transcription(self, recording_id: int) -> Transcription | None:
        """获取转录文本

        Args:
            recording_id: 录音ID

        Returns:
            Transcription对象，如果不存在则返回None
        """
        with get_session() as session:
            statement = select(Transcription).where(
                Transcription.audio_recording_id == recording_id
            )
            transcription = session.exec(statement).first()
            return transcription
