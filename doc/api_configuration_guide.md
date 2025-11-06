# API 配置指南

## 概述

LifeTrace 现在支持通过配置文件和 Web UI 来配置 LLM API 密钥和服务器设置。

## 配置方式

### 方式1：通过配置文件

编辑 `config/config.yaml` 文件：

```yaml
# LLM配置
llm:
  api_key: "your-api-key-here"              # LLM API密钥
  base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1"  # API基础URL
  model: "qwen3-max"                        # 模型名称
  temperature: 0.7                          # 温度参数（0-1）
  max_tokens: 2048                          # 最大输出token数

# 服务器配置
server:
  host: 127.0.0.1                           # 服务器监听地址
  port: 8000                                # 服务器监听端口

# 聊天配置
chat:
  local_history: true                       # 是否启用本地历史记录
  history_limit: 6                          # 历史记录条数限制
```

### 方式2：通过 Web 设置页面

1. 启动 LifeTrace 服务：
   ```bash
   python -m lifetrace_backend.server
   ```

2. 在浏览器中打开聊天页面：
   ```
   http://localhost:8000/chat
   ```

3. 点击右上角的 **设置** 图标（齿轮图标）

4. 在设置页面中找到以下配置区域：

#### API 配置卡片
- **API Key**: 输入您的 LLM API 密钥
- **API Base URL**: API 服务的基础地址
- **模型名称**: 使用的 LLM 模型名称

#### 服务器配置卡片
- **服务器地址**: 服务器监听地址（默认 127.0.0.1）
- **服务器端口**: 服务器监听端口（默认 8000）

5. 修改后会自动保存到配置文件

6. **重要**: 修改配置后需要重启服务才能生效

## 支持的 LLM 服务商

### 1. 阿里云通义千问（默认）
```yaml
llm:
  api_key: "sk-your-dashscope-key"
  base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1"
  model: "qwen3-max"  # 或 qwen-plus, qwen-turbo
```

### 2. OpenAI
```yaml
llm:
  api_key: "sk-your-openai-key"
  base_url: "https://api.openai.com/v1"
  model: "gpt-4"  # 或 gpt-3.5-turbo
```

### 3. Claude (通过代理)
```yaml
llm:
  api_key: "sk-your-claude-key"
  base_url: "https://api.anthropic.com/v1"
  model: "claude-3-sonnet-20240229"
```

### 4. 其他兼容 OpenAI API 的服务
任何兼容 OpenAI API 格式的服务都可以使用，只需配置正确的 `base_url` 和 `api_key`。

## 配置文件位置

- **开发环境**: `config/config.yaml`
- **打包后**: `dist/config/config.yaml`

## API 接口说明

### 获取当前配置
```http
GET /api/get-config
```

响应示例：
```json
{
  "success": true,
  "config": {
    "apiKey": "sk-xxx",
    "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
    "llmModel": "qwen3-max",
    "serverHost": "127.0.0.1",
    "serverPort": 8000,
    "temperature": 0.7,
    "maxTokens": 2048
  }
}
```

### 保存配置
```http
POST /api/save-config
Content-Type: application/json

{
  "apiKey": "your-new-key",
  "baseUrl": "https://api.example.com/v1",
  "llmModel": "model-name",
  "serverHost": "127.0.0.1",
  "serverPort": 8000,
  "temperature": 0.7,
  "maxTokens": 2048
}
```

## 安全建议

1. **不要提交 API Key 到版本控制系统**
   - 将 `config/config.yaml` 添加到 `.gitignore`
   - 或使用环境变量方式（未来版本支持）

2. **定期更换 API Key**

3. **使用最小权限原则**
   - 只授予必要的 API 权限

4. **监控 API 使用量**
   - 定期检查 API 调用次数和费用

## 故障排查

### 1. API Key 无效
**症状**: 聊天时返回认证错误

**解决**:
- 检查 API Key 是否正确
- 确认 API Key 是否已激活
- 查看 API Key 是否有足够的配额

### 2. 连接超时
**症状**: 请求一直等待，最后超时

**解决**:
- 检查网络连接
- 确认 Base URL 是否正确
- 检查是否需要代理

### 3. 配置未生效
**症状**: 修改配置后仍使用旧配置

**解决**:
- 确保配置已保存到文件
- 重启 LifeTrace 服务
- 检查配置文件路径是否正确

### 4. 端口冲突
**症状**: 服务启动失败，提示端口被占用

**解决**:
- 修改 `server.port` 为其他端口
- 或关闭占用该端口的其他程序

## 更新日志

### v1.0.0 (2024-10-17)
- ✅ 支持通过配置文件设置 API Key
- ✅ 支持通过 Web UI 配置 API 设置
- ✅ 支持配置服务器端口和地址
- ✅ 配置自动保存到 config.yaml
- ✅ 从配置文件读取 API 配置初始化服务

## 相关文档

- [部署指南](../README.md#deployment-and-configuration)
- [RAG 服务说明](overview.md)
- [事件机制说明](event_mechanism.md)
