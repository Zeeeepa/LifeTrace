# 视觉多模态API接口文档

## 概述

视觉多模态API接口允许用户通过截图ID和文本提示词，调用通义千问视觉大模型进行图片分析。该接口支持同时处理多张截图，实现复杂的多模态交互。

## 接口信息

- **接口路径**: `/api/vision/chat`
- **请求方法**: `POST`
- **Content-Type**: `application/json`

## 请求参数

### VisionChatRequest

| 字段名           | 类型        | 必填 | 说明                                                             |
| ---------------- | ----------- | ---- | ---------------------------------------------------------------- |
| `screenshot_ids` | `list[int]` | 是   | 截图ID列表，至少包含一个截图ID，最多20个                         |
| `prompt`         | `string`    | 是   | 文本提示词，用于指导模型分析图片内容                             |
| `model`          | `string`    | 否   | 视觉模型名称，如果不提供则使用配置中的默认模型（`qwen-vl-plus`） |
| `temperature`    | `float`     | 否   | 温度参数，控制输出的随机性，范围0.0-2.0，默认0.7                 |
| `max_tokens`     | `int`       | 否   | 最大生成token数，默认2048                                        |

### 请求示例

```json
{
  "screenshot_ids": [123, 456, 789],
  "prompt": "请分析这些截图中的内容，描述用户正在做什么",
  "model": "qwen-vl-plus",
  "temperature": 0.7,
  "max_tokens": 2048
}
```

## 响应格式

### VisionChatResponse

| 字段名             | 类型       | 说明                       |
| ------------------ | ---------- | -------------------------- |
| `response`         | `string`   | 模型生成的响应文本         |
| `timestamp`        | `datetime` | 响应时间戳（ISO 8601格式） |
| `usage_info`       | `object`   | Token使用信息（可选）      |
| `model`            | `string`   | 实际使用的模型名称         |
| `screenshot_count` | `int`      | 实际处理的截图数量         |

### usage_info 结构

| 字段名              | 类型  | 说明        |
| ------------------- | ----- | ----------- |
| `prompt_tokens`     | `int` | 输入token数 |
| `completion_tokens` | `int` | 输出token数 |
| `total_tokens`      | `int` | 总token数   |

### 响应示例

```json
{
  "response": "根据截图分析，用户正在使用微信进行聊天。第一张截图显示了一个聊天窗口，第二张截图显示了用户发送的消息内容。",
  "timestamp": "2024-01-15T10:30:00",
  "usage_info": {
    "prompt_tokens": 1500,
    "completion_tokens": 200,
    "total_tokens": 1700
  },
  "model": "qwen-vl-plus",
  "screenshot_count": 3
}
```

## 错误码

| HTTP状态码 | 错误说明                                     |
| ---------- | -------------------------------------------- |
| 400        | 请求参数错误（如截图ID列表为空、超过20张等） |
| 404        | 截图不存在                                   |
| 500        | 服务器内部错误                               |
| 503        | LLM服务不可用（配置错误或服务异常）          |

### 错误响应格式

```json
{
  "detail": "错误信息描述"
}
```

## 使用示例

### cURL 示例

```bash
curl -X POST "http://localhost:8000/api/vision/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "screenshot_ids": [123, 456],
    "prompt": "请描述这些截图中的内容"
  }'
```

### Python 示例

```python
import requests

url = "http://localhost:8000/api/vision/chat"
payload = {
    "screenshot_ids": [123, 456, 789],
    "prompt": "请分析这些截图，总结用户的主要活动",
    "temperature": 0.7
}

response = requests.post(url, json=payload)
result = response.json()

print(f"响应: {result['response']}")
print(f"使用的模型: {result['model']}")
print(f"处理的截图数: {result['screenshot_count']}")
if result.get('usage_info'):
    print(f"Token使用: {result['usage_info']['total_tokens']}")
```

### JavaScript/TypeScript 示例

```typescript
const response = await fetch('http://localhost:8000/api/vision/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    screenshot_ids: [123, 456],
    prompt: '请分析这些截图中的内容',
    temperature: 0.7,
  }),
});

const result = await response.json();
console.log('响应:', result.response);
console.log('使用的模型:', result.model);
console.log('处理的截图数:', result.screenshot_count);
```

## 配置说明

### 默认配置

在 `lifetrace/config/default_config.yaml` 中可以配置视觉模型：

```yaml
llm:
  vision_model: qwen-vl-plus  # 视觉多模态模型名称
  temperature: 0.7             # 默认温度参数
  max_tokens: 2048             # 默认最大token数
```

### 支持的视觉模型

- `qwen-vl-plus`: 通义千问视觉增强版（推荐）
- `qwen-vl-max`: 通义千问视觉最大版
- 其他通义千问兼容的视觉模型

## 注意事项

1. **截图ID有效性**: 确保提供的截图ID在数据库中存在，且对应的截图文件可访问
2. **图片格式支持**: 支持 PNG、JPEG、GIF、WebP 格式
3. **数量限制**: 一次请求最多处理20张截图，超过限制将返回400错误
4. **Token消耗**: 视觉模型的token消耗通常比文本模型更高，请关注使用量
5. **响应时间**: 处理多张截图时，响应时间可能较长，建议设置合适的超时时间
6. **图片大小**: 建议单张图片不超过10MB，过大的图片可能影响处理速度

## 使用场景

1. **截图内容分析**: 分析用户屏幕截图，理解用户正在进行的操作
2. **多图对比**: 对比多张截图，找出差异或变化
3. **界面识别**: 识别应用界面元素，提取关键信息
4. **内容总结**: 基于截图内容生成摘要或总结
5. **问题诊断**: 分析错误截图，帮助诊断问题

## 技术实现

### 图片处理流程

1. 根据 `screenshot_ids` 从数据库查询截图记录
2. 读取截图文件
3. 将图片转换为 base64 编码（格式：`data:image/png;base64,{base64_str}`）
4. 构建多模态消息格式（OpenAI兼容格式）
5. 调用通义千问视觉模型API
6. 返回分析结果

### 多模态消息格式

```python
messages = [{
    "role": "user",
    "content": [
        {"type": "image_url", "image_url": {"url": "data:image/png;base64,{base64_str}"}},
        {"type": "text", "text": "prompt文本"}
    ]
}]
```

## 相关接口

- `/api/screenshots` - 获取截图列表
- `/api/screenshots/{id}` - 获取单个截图详情
- `/api/chat` - 文本聊天接口
- `/api/chat/stream` - 流式聊天接口

## 更新日志

- **2024-01-15**: 初始版本发布，支持多张截图分析和通义千问视觉模型
