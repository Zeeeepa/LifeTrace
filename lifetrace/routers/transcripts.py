"""转录文本管理路由"""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from lifetrace.util.logging_config import get_logger

logger = get_logger()

router = APIRouter(prefix="/api/transcripts", tags=["transcripts"])


class TranscriptItem(BaseModel):
    """转录项"""
    id: str
    timestamp: str  # ISO 格式时间字符串
    rawText: str
    optimizedText: Optional[str] = None
    audioStart: int  # 相对录音开始时间（ms）
    audioEnd: int
    audioFileId: Optional[str] = None


class BatchSaveRequest(BaseModel):
    """批量保存请求"""
    transcripts: List[TranscriptItem]


class BatchSaveResponse(BaseModel):
    """批量保存响应"""
    saved: int
    message: str


@router.post("/batch", response_model=BatchSaveResponse)
async def batch_save_transcripts(request: BatchSaveRequest):
    """
    批量保存转录文本
    
    注意：当前版本仅记录日志，不持久化到数据库
    后续可以集成到数据库或文件系统
    """
    try:
        saved_count = 0
        
        for transcript in request.transcripts:
            try:
                # 解析时间戳
                timestamp = datetime.fromisoformat(transcript.timestamp.replace('Z', '+00:00'))
                
                # 记录日志（后续可以改为保存到数据库）
                logger.info(
                    f"保存转录文本: id={transcript.id}, "
                    f"timestamp={timestamp}, "
                    f"rawText={transcript.rawText[:50]}..., "
                    f"optimizedText={transcript.optimizedText[:50] if transcript.optimizedText else None}..."
                )
                
                # TODO: 保存到数据库
                # 例如：
                # db.save_transcript(
                #     id=transcript.id,
                #     timestamp=timestamp,
                #     raw_text=transcript.rawText,
                #     optimized_text=transcript.optimizedText,
                #     audio_start=transcript.audioStart,
                #     audio_end=transcript.audioEnd,
                #     audio_file_id=transcript.audioFileId,
                # )
                
                saved_count += 1
            except Exception as e:
                logger.error(f"保存转录文本失败: id={transcript.id}, error={e}")
        
        return BatchSaveResponse(
            saved=saved_count,
            message=f"成功保存 {saved_count}/{len(request.transcripts)} 条转录文本"
        )
    except Exception as e:
        logger.error(f"批量保存转录文本失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"保存失败: {str(e)}")


@router.get("")
async def query_transcripts(
    startTime: str = Query(..., description="开始时间（ISO 格式）"),
    endTime: str = Query(..., description="结束时间（ISO 格式）"),
):
    """
    查询历史转录文本
    
    注意：当前版本返回空列表，后续可以从数据库查询
    """
    try:
        # 解析时间范围
        start = datetime.fromisoformat(startTime.replace('Z', '+00:00'))
        end = datetime.fromisoformat(endTime.replace('Z', '+00:00'))
        
        logger.debug(f"查询转录文本: startTime={start}, endTime={end}")
        
        # TODO: 从数据库查询
        # 例如：
        # transcripts = db.query_transcripts(start, end)
        # return {"transcripts": transcripts}
        
        # 当前返回空列表
        return {"transcripts": []}
    except Exception as e:
        logger.error(f"查询转录文本失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"查询失败: {str(e)}")

