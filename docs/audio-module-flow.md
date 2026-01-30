# 音频模块流程总结

本文档总结了音频录制与提取的端到端流程。

## 概览

音频模块在前端采集麦克风输入，通过 WebSocket 把 PCM16 流发送到后端；后端进行实时 ASR，可选实时优化与提取，并在停止录制时持久化录音与转录。提取出的待办/日程会写入转录记录，并可与实际待办项进行关联。

## 端到端流程图

```mermaid
flowchart TD
    %% 前端录制与流式传输
    FE_UI[前端界面]
    FE_STORE[录音状态管理]
    FE_MEDIA[浏览器媒体设备与音频处理]
    FE_WS[录音 WebSocket 通道 /api/audio/transcribe]

    %% 后端 WS 与语音识别
    BE_WS[后端 WS 处理器]
    BE_ASR[语音识别客户端]
    BE_RTNLP[实时文本处理：优化与提取]

    %% 持久化
    BE_WAV[保存音频文件并写入录音记录]
    BE_TXT[保存转录文本]
    BE_AUTOX[自动提取待办与日程]

    %% 接口调用
    API_REC[录音列表与时间线接口]
    API_TXT[获取转录接口]
    API_EXT[手动提取接口]
    API_LINK[提取项关联接口]

    %% 提示词
    PROMPT_OPT[提示词：transcription_optimization]
    PROMPT_EXT[提示词：transcription_extraction]

    %% 前端展示
    FE_UI_LIVE[实时文本与实时待办/日程]
    FE_UI_TIMELINE[时间线与播放]

    FE_UI --> FE_STORE
    FE_STORE --> FE_MEDIA
    FE_MEDIA --> FE_WS

    FE_WS --> BE_WS
    BE_WS --> BE_ASR
    BE_ASR -->|部分结果 + 最终结果| BE_WS

    BE_WS -->|最终句子| BE_RTNLP
    BE_RTNLP --> PROMPT_OPT
    BE_RTNLP --> PROMPT_EXT
    BE_RTNLP -->|优化文本变更 / 提取结果变更| FE_UI_LIVE

    BE_WS -->|停止录音| BE_WAV
    BE_WAV --> BE_TXT
    BE_TXT --> PROMPT_OPT
    BE_TXT --> BE_AUTOX
    BE_AUTOX --> PROMPT_EXT

    BE_TXT --> API_TXT
    BE_WAV --> API_REC
    BE_AUTOX --> API_TXT
    API_EXT --> BE_AUTOX
    API_LINK --> BE_AUTOX

    API_REC --> FE_UI_TIMELINE
    API_TXT --> FE_UI_TIMELINE
```

## 备注

- 前端将原始 PCM16（16 kHz、单声道）流发送到后端 WebSocket。
- 后端把 PCM 封装为 WAV，保存文件并写入录音数据库记录。
- 停止录音时保存转录文本；文本变化后会异步触发自动提取。
- 实时文本处理只在最终句子上运行，并有节流以降低负载。
- 提取结果存储在转录记录的 JSON 字段中，可通过接口关联到实际待办。
