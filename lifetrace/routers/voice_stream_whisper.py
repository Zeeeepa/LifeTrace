"""实时语音识别 WebSocket 路由 - 使用 Faster-Whisper 进行流式识别（优化版）"""

import asyncio
import io
import numpy as np
from typing import Any, Optional
from collections import deque
import time

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import av

from lifetrace.util.logging_config import get_logger
from lifetrace.util.settings import settings

logger = get_logger()


def convert_traditional_to_simplified(text: str) -> str:
    """
    将繁体中文转换为简体中文
    
    优先使用 opencc-python-reimplemented，如果没有安装则使用简单映射
    """
    # 尝试使用 opencc（如果已安装）
    try:
        import opencc
        converter = opencc.OpenCC('t2s')  # 繁体转简体
        return converter.convert(text)
    except ImportError:
        # 如果没有安装 opencc，使用简单映射（常用字）
        traditional_to_simplified = {
            '學': '学', '會': '会', '從': '从', '感': '感', '全': '全', '在': '在',
            '心': '心', '頭': '头', '的': '的', '悲': '悲', '鳴': '鸣', '人': '人',
            '需': '需', '要': '要', '愛': '爱', '和': '和', '關': '关', '心': '心',
            '結': '结', '果': '果', '城': '城', '市': '市', '哪': '哪', '有': '有',
            '阻': '阻', '礙': '碍', '圍': '围', '都': '都', '看': '看', '自': '自',
            '己': '己', '想': '想', '像': '像', '走': '走', '過': '过', '當': '当',
            '你': '你', '做': '做', '了': '了', '些': '些', '什': '什', '麼': '么',
            '事': '事', '情': '情', '也': '也', '許': '许', '是': '是', '傷': '伤',
            '給': '给', '我': '我', '一': '一', '個': '个', '失': '失', '誤': '误',
            '真': '真', '實': '实', '像': '像', '口': '口', '徑': '径', '要': '要',
            '花': '花', '點': '点', '時': '时', '間': '间', '那': '那', '些': '些',
            '不': '不', '在': '在', '意': '意', '原': '原', '曲': '曲', '而': '而',
            '能': '能', '重': '重', '唱': '唱', '們': '们', '終': '终', '究': '究',
            '回': '回', '不': '不', '去': '去', '別': '别', '再': '再', '憶': '忆',
            '當': '当', '年': '年',
        }
        result = []
        for char in text:
            result.append(traditional_to_simplified.get(char, char))
        return ''.join(result)

router = APIRouter(prefix="/api/voice", tags=["voice-stream"])

# 全局 Faster-Whisper 模型（延迟加载）
_whisper_model: Any = None


def get_whisper_model():
    """获取 Faster-Whisper 模型（延迟加载）"""
    global _whisper_model
    if _whisper_model is None:
        try:
            from faster_whisper import WhisperModel
        except ImportError:
            error_msg = (
                "Faster-Whisper 未安装。系统音频实时识别需要 Faster-Whisper。\n"
                "安装方法：\n"
                "uv pip install faster-whisper\n"
                "注意：首次运行会自动下载模型（约 1.5GB）"
            )
            logger.error(error_msg)
            raise ImportError(error_msg)
        
        try:
            # 从配置读取模型大小（默认使用 base 模型，平衡速度和准确率）
            model_size = getattr(settings.speech_recognition, 'whisper_model_size', 'base')
            device = getattr(settings.speech_recognition, 'whisper_device', 'cpu')
            compute_type = 'int8' if device == 'cpu' else 'float16'  # CPU 使用 int8，GPU 使用 float16
            
            logger.info(f"初始化 Faster-Whisper 模型: size={model_size}, device={device}, compute_type={compute_type}")
            
            _whisper_model = WhisperModel(
                model_size,
                device=device,
                compute_type=compute_type,
            )
            logger.info("Faster-Whisper 模型初始化成功")
        except Exception as e:
            logger.error(f"Faster-Whisper 模型初始化失败: {e}", exc_info=True)
            raise
    return _whisper_model


class PCMAudioProcessor:
    """PCM 音频数据处理器 - 直接处理原始 PCM 数据（Int16）"""
    
    def __init__(
        self,
        sample_rate: int = 16000,
        chunk_duration: float = 3.0,  # 3秒处理一次（增加转录文本长度）
        overlap: float = 0.5,  # 0.5秒重叠（确保不丢失内容）
        min_samples: int = 32000,  # 最小样本数（约 2 秒 @ 16kHz，确保有足够内容）
    ):
        self.sample_rate = sample_rate
        self.chunk_duration = chunk_duration
        self.overlap = overlap
        self.min_samples = min_samples
        
        # 使用 deque 作为 PCM 数据缓冲区（Int16，2 bytes per sample）
        # 限制最大长度，防止无限积压（约 6 秒的音频，支持更长的转录）
        max_buffer_samples = int(sample_rate * 6.0)  # 最多 6 秒
        max_buffer_size = max_buffer_samples * 2  # Int16 = 2 bytes
        self.pcm_buffer = deque(maxlen=max_buffer_size)
        
        # 处理状态
        self.is_processing = False
        self.last_process_time = time.time()
        
        logger.info(f"PCM 音频处理器初始化: chunk={chunk_duration}s, overlap={overlap}s, min_samples={min_samples} (约 {min_samples/sample_rate:.2f}s)")
    
    def add_pcm_data(self, data: bytes):
        """接收 PCM 数据（Int16）并添加到缓冲区"""
        self.pcm_buffer.extend(data)
        current_samples = len(self.pcm_buffer) // 2  # Int16 = 2 bytes per sample
        logger.debug(f"接收 PCM 数据: {len(data)} bytes ({len(data)//2} samples), 缓冲区: {current_samples} samples (需要: {self.min_samples} samples)")
    
    async def try_process(self) -> Optional[str]:
        """尝试处理音频数据 - 核心优化逻辑（支持并发处理）"""
        current_samples = len(self.pcm_buffer) // 2  # Int16 = 2 bytes per sample
        current_time = time.time()
        
        # 检查是否满足处理条件
        time_since_last = current_time - self.last_process_time
        should_process = (
            current_samples >= self.min_samples
            and time_since_last >= self.chunk_duration
        )
        
        if not should_process:
            logger.debug(f"不满足处理条件: samples={current_samples}/{self.min_samples}, time={time_since_last:.2f}/{self.chunk_duration}s")
            return None
        
        # 如果正在处理，但已经过了足够的时间，允许新的处理（实现真正的实时）
        if self.is_processing:
            # 如果上次处理已经超过 3 秒，允许新的处理（可能是上次处理卡住了）
            if time_since_last > 3.0:
                logger.warning(f"上次处理可能卡住，允许新处理: time={time_since_last:.2f}s")
            else:
                logger.debug(f"已有处理任务在运行，跳过（time={time_since_last:.2f}s）")
                return None
        
        logger.info(f"✅ 满足处理条件，开始处理: samples={current_samples} (约 {current_samples/self.sample_rate:.2f}s), time={time_since_last:.2f}s")
        
        self.is_processing = True
        
        try:
            # 1. 提取处理数据（转换为 bytes）
            pcm_bytes = bytes(self.pcm_buffer)
            
            # 检查字节对齐（Int16 需要 2 字节对齐）
            if len(pcm_bytes) % 2 != 0:
                logger.warning(f"PCM 数据未对齐，截断最后 1 字节: {len(pcm_bytes)} -> {len(pcm_bytes) - 1}")
                pcm_bytes = pcm_bytes[:-1]
            
            current_samples = len(pcm_bytes) // 2
            if current_samples < self.min_samples:
                logger.debug(f"缓冲区数据不足: {current_samples} samples, 跳过处理")
                return None
            
            # 2. 转换为 numpy array（直接处理 PCM Int16）
            logger.info(f"🔍 开始转换 PCM 到 numpy，样本数: {current_samples} (约 {current_samples/self.sample_rate:.2f}s)")
            audio_array = self._convert_pcm_to_numpy(pcm_bytes)
            
            if audio_array is None or len(audio_array) == 0:
                logger.warning(f"⚠️ PCM 转换失败或为空，样本数: {current_samples}")
                return None
            
            # 3. 执行语音识别（在线程池中运行，避免阻塞）
            # 记录处理开始时间
            process_start_time = time.time()
            audio_duration = len(audio_array) / self.sample_rate
            logger.info(f"✅ PCM 转换成功，开始识别，音频长度: {audio_duration:.2f}s, 样本数: {len(audio_array)}")
            
            # 添加超时机制（根据音频长度动态调整，最多等待 10 秒）
            timeout_seconds = min(10.0, audio_duration * 2.0 + 2.0)  # 至少是音频长度的2倍+2秒，最多10秒
            try:
                result = await asyncio.wait_for(
                    self._transcribe(audio_array),
                    timeout=timeout_seconds
                )
            except asyncio.TimeoutError:
                logger.error(f"识别超时（>{timeout_seconds:.1f}秒），音频长度: {audio_duration:.2f}s")
                result = ""
            
            process_duration = time.time() - process_start_time
            
            # 4. 清理已处理的缓冲区（保留部分数据用于重叠）
            if result:  # 只有成功识别才清理
                # 保留重叠部分的样本（用于重叠，确保不丢失内容）
                keep_samples = max(int(current_samples * self.overlap), int(self.sample_rate * 0.5))  # 至少保留 0.5 秒
                keep_bytes = keep_samples * 2  # Int16 = 2 bytes
                remove_count = len(self.pcm_buffer) - keep_bytes
                for _ in range(max(0, remove_count)):
                    if len(self.pcm_buffer) > 0:
                        self.pcm_buffer.popleft()
                
                remaining_samples = len(self.pcm_buffer) // 2
                logger.info(f"✅ 处理完成（耗时 {process_duration:.2f}s），识别结果: {result}, 剩余缓冲: {remaining_samples} samples (约 {remaining_samples/self.sample_rate:.2f}s)")
            else:
                remaining_samples = len(self.pcm_buffer) // 2
                logger.debug(f"识别结果为空（耗时 {process_duration:.2f}s），保留所有数据，缓冲区: {remaining_samples} samples")
            
            return result
            
        except Exception as e:
            logger.error(f"音频处理异常: {e}", exc_info=True)
            return None
        finally:
            self.is_processing = False
            self.last_process_time = time.time()
    
    def _convert_pcm_to_numpy(self, pcm_bytes: bytes) -> Optional[np.ndarray]:
        """
        将 PCM Int16 数据转换为 numpy array（Faster-Whisper 需要）
        关键点：
        1. 直接使用 np.frombuffer 解析 Int16
        2. 转换为 float32 并归一化到 [-1, 1]
        3. 数据验证
        """
        try:
            # 检查数据大小
            if len(pcm_bytes) < 2:  # 至少 1 个样本（2 bytes）
                return None
            
            # 检查字节对齐（Int16 需要 2 字节对齐）
            if len(pcm_bytes) % 2 != 0:
                logger.warning(f"PCM 数据未对齐，截断最后 1 字节: {len(pcm_bytes)} -> {len(pcm_bytes) - 1}")
                pcm_bytes = pcm_bytes[:-1]
            
            # 转换为 Int16 数组
            audio_int16 = np.frombuffer(pcm_bytes, dtype=np.int16)
            
            if len(audio_int16) == 0:
                logger.error("转换后数组为空")
                return None
            
            # 转换为 float32 并归一化到 [-1.0, 1.0]
            # 这是 Whisper 要求的格式
            audio_float32 = audio_int16.astype(np.float32) / 32768.0
            
            # 数据验证
            if not np.isfinite(audio_float32).all():
                logger.error("音频数据包含无效值(inf/nan)")
                return None
            
            logger.info(f"✅ PCM 转换成功: {len(audio_int16)} samples (约 {len(audio_int16)/self.sample_rate:.2f}s), range=[{audio_float32.min():.3f}, {audio_float32.max():.3f}]")
            
            return audio_float32
            
        except Exception as e:
            logger.error(f"PCM 转换异常: {e}", exc_info=True)
            return None
    
    
    async def _transcribe(self, audio_array: np.ndarray) -> str:
        """执行语音识别（在线程池中运行，避免阻塞事件循环）"""
        try:
            model = get_whisper_model()
            audio_duration = len(audio_array) / self.sample_rate
            
            logger.debug(f"准备识别，音频长度: {audio_duration:.2f}s, 样本数: {len(audio_array)}")
            
            # 在线程池中运行（避免阻塞事件循环）
            loop = asyncio.get_event_loop()
            
            # 使用更快的参数配置，提高实时性
            def transcribe_task():
                logger.debug(f"线程池中开始识别，音频长度: {audio_duration:.2f}s")
                start_time = time.time()
                
                try:
                    segments, info = model.transcribe(
                        audio_array,
                        beam_size=1,  # 降低 beam_size 从 5 到 1，提高速度
                        language="zh",  # 中文
                        task="transcribe",
                        vad_filter=False,  # 暂时禁用 VAD，避免过滤掉有效语音
                        condition_on_previous_text=False,  # 不依赖前文，提高速度
                        # 添加更多优化参数
                        best_of=1,  # 只尝试一次，提高速度
                        temperature=0.0,  # 使用贪婪解码，最快
                    )
                    
                    # 立即转换为列表（避免生成器延迟）
                    segments_list = list(segments)
                    transcribe_duration = time.time() - start_time
                    logger.debug(f"识别完成，耗时: {transcribe_duration:.2f}s, 片段数: {len(segments_list)}")
                    
                    return segments_list, info
                except Exception as e:
                    logger.error(f"线程池中识别异常: {e}", exc_info=True)
                    raise
            
            segments_list, info = await loop.run_in_executor(None, transcribe_task)
            
            # 收集所有片段文本
            texts = []
            for segment in segments_list:
                text = segment.text.strip()
                if text:
                    texts.append(text)
            
            result = " ".join(texts)
            if result:
                # 繁简转换（将繁体转为简体）
                result = convert_traditional_to_simplified(result)
                logger.info(f"✅ 识别结果: {result} (音频长度: {audio_duration:.2f}s)")
            else:
                logger.debug(f"识别结果为空 (音频长度: {audio_duration:.2f}s)")
            
            return result
            
        except Exception as e:
            logger.error(f"语音识别异常: {e}", exc_info=True)
            return ""
    
    async def flush(self) -> Optional[str]:
        """强制处理剩余数据"""
        if len(self.pcm_buffer) > 0:
            pcm_bytes = bytes(self.pcm_buffer)
            current_samples = len(pcm_bytes) // 2
            logger.info(f"强制处理剩余数据: {current_samples} samples (约 {current_samples/self.sample_rate:.2f}s)")
            audio_array = self._convert_pcm_to_numpy(pcm_bytes)
            if audio_array is not None and len(audio_array) > 0:
                return await self._transcribe(audio_array)
        return None


@router.websocket("/stream")
async def stream_transcription(websocket: WebSocket):
    """
    实时语音识别 WebSocket 端点（使用 Faster-Whisper）
    
    接收音频流（PCM Int16 格式），使用 Faster-Whisper 进行实时识别
    返回识别结果（JSON 格式）
    """
    await websocket.accept()
    logger.info("WebSocket 连接已建立（Faster-Whisper 优化版）")
    
    # 获取 Faster-Whisper 模型
    try:
        model = get_whisper_model()
    except ImportError as e:
        error_msg = str(e)
        logger.error(f"Faster-Whisper 未安装: {error_msg}")
        await websocket.send_json({
            "error": "Faster-Whisper 未安装，无法进行实时识别。请安装 Faster-Whisper 依赖。",
            "details": error_msg,
        })
        await websocket.close()
        return
    
    # 创建音频处理器（现在处理 PCM Int16 数据）
    processor = PCMAudioProcessor(
        sample_rate=16000,
        chunk_duration=3.0,  # 每 3 秒处理一次（增加转录文本长度）
        overlap=0.5,  # 0.5 秒重叠（确保不丢失内容）
        min_samples=32000,  # 至少 32000 样本（约 2 秒 @ 16kHz，确保有足够内容）
    )
    
    try:
        while True:
            try:
                # 接收音频数据
                message = await websocket.receive()
                
                if "bytes" in message:
                    # 二进制音频数据（PCM Int16）
                    audio_data = message["bytes"]
                    processor.add_pcm_data(audio_data)
                    
                    # 尝试处理（如果满足条件）
                    result = await processor.try_process()
                    
                    if result:
                        # 发送识别结果
                        # 注意：由于是流式处理，每次结果都可能是最终结果（因为已经处理了完整的音频块）
                        # 但为了支持连续识别，我们标记为 isFinal: True，让前端创建新片段
                        await websocket.send_json({
                            "text": result,
                            "isFinal": True,  # 标记为最终结果，让前端创建新片段并保留历史
                        })
                
                elif "text" in message:
                    # 文本消息（控制消息）
                    text_msg = message["text"]
                    if text_msg == "EOS":  # End of Stream
                        # 处理剩余的音频
                        final_result = await processor.flush()
                        if final_result:
                            await websocket.send_json({
                                "text": final_result,
                                "isFinal": True,  # 最终结果
                            })
                        break
                
            except WebSocketDisconnect:
                logger.info("WebSocket 连接已断开")
                break
            except Exception as e:
                logger.error(f"WebSocket 处理错误: {e}", exc_info=True)
                await websocket.send_json({
                    "error": f"处理错误: {str(e)}",
                })
                break
        
    except asyncio.CancelledError:
        logger.info("WebSocket 任务被取消")
    except Exception as e:
        logger.error(f"WebSocket 连接错误: {e}", exc_info=True)
    finally:
        try:
            # 清理资源
            if websocket.client_state.name != 'DISCONNECTED':
                await websocket.close()
        except Exception:
            pass
        logger.info("WebSocket 连接已关闭")
