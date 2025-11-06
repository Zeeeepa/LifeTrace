# LifeTrace 初始配置引导功能说明

## 功能概述

当 LifeTrace 首次启动或 LLM API 配置为默认的 'xxx' 时，系统会自动引导用户进入配置页面，要求配置必要的 API 信息后才能使用聊天功能。

## 工作流程

### 1. 启动检测
- 服务启动时检查 `config.yaml` 中的 `llm.api_key` 和 `llm.base_url`
- 如果这两个值为 'xxx' 或空，则标记为"未配置"状态
- 未配置时，访问任何页面（除引导页）都会被重定向到 `/setup`

### 2. 引导配置
用户在引导页面需要填写：
- **API Key**（必填）：LLM 服务的 API 密钥
- **Base URL**（必填）：API 服务的基础地址
- **模型名称**：可选择预设模型或自定义

### 3. 验证流程
1. 用户点击"测试并保存配置"按钮
2. 前端发送请求到 `/api/test-llm-config` 进行验证
3. 后端创建临时 OpenAI 客户端，发送最小化测试请求（max_tokens=5）
4. 验证成功后，调用 `/api/save-and-init-llm` 保存配置

### 4. 初始化
配置验证成功后：
1. 保存配置到 `config/config.yaml`
2. 重新加载配置文件
3. 重新初始化 RAG 服务
4. 更新全局配置状态标志
5. 自动跳转到聊天页面

## 技术实现

### 配置文件修改
```yaml
# config/config.yaml 和 config/default_config.yaml
llm:
  api_key: "xxx"  # 默认未配置标识
  base_url: "xxx"  # 默认未配置标识
  model: "qwen3-max"  # 保持默认值
```

### 核心组件

#### 1. 配置检测（config.py）
```python
def is_configured(self) -> bool:
    """检查LLM配置是否已完成"""
    api_key = self.llm_api_key
    base_url = self.llm_base_url
    return (api_key not in ['', 'xxx'] and
            base_url not in ['', 'xxx'])
```

#### 2. 中间件拦截（server.py）
```python
@app.middleware("http")
async def check_configuration_middleware(request: Request, call_next):
    """检查LLM配置状态，未配置时重定向到setup页面"""
    global is_llm_configured

    # 允许访问的路径（不需要LLM配置）
    allowed_paths = ['/setup', '/api/test-llm-config', '/api/save-and-init-llm',
                    '/static', '/assets', '/api/get-config', '/api/save-config']

    if not is_llm_configured:
        path = request.url.path
        if not any(path.startswith(allowed) for allowed in allowed_paths):
            return RedirectResponse(url='/setup', status_code=302)

    response = await call_next(request)
    return response
```

#### 3. API 接口

**测试配置接口**：
```
POST /api/test-llm-config
Body: {
  "apiKey": "your-api-key",
  "baseUrl": "https://api.example.com/v1",
  "model": "model-name"
}
```

**保存并初始化接口**：
```
POST /api/save-and-init-llm
Body: {
  "apiKey": "your-api-key",
  "baseUrl": "https://api.example.com/v1",
  "model": "model-name"
}
```

## 使用说明

### 首次使用
1. 安装依赖并激活环境：
   ```bash
   # 使用 uv 安装依赖（推荐）
   uv sync

   # 激活虚拟环境
   source .venv/bin/activate  # macOS/Linux
   # 或
   .venv\Scripts\activate     # Windows
   ```

2. 启动 LifeTrace 服务：
   ```bash
   python -m lifetrace.server
   ```

2. 访问任意页面，将自动重定向到 `/setup`

3. 填写配置信息：
   - API Key：从 LLM 服务商获取
   - Base URL：服务商提供的 API 地址
   - 模型：选择或输入模型名称

4. 点击"测试并保存配置"

5. 等待验证和初始化完成

6. 自动跳转到聊天页面

### 支持的服务商

- **阿里云通义千问**（推荐）
  - Base URL: `https://dashscope.aliyuncs.com/compatible-mode/v1`
  - 模型：qwen3-max, qwen-plus, qwen-turbo

- **OpenAI**
  - Base URL: `https://api.openai.com/v1`
  - 模型：gpt-4, gpt-3.5-turbo

- **其他兼容 OpenAI API 的服务**

## 错误处理

### 验证失败
如果配置验证失败，页面会显示错误信息：
- API Key 无效
- Base URL 不可达
- 模型不存在
- 网络连接问题

用户可以修改配置后重新尝试。

### 保存失败
如果保存配置失败，系统会：
- 显示具体错误信息
- 保持在配置页面
- 允许用户重新尝试

## 重新配置

如果需要修改 API 配置：
1. 访问设置页面：`http://localhost:8000/chat/settings`
2. 找到"API 配置"卡片
3. 修改配置并保存
4. 重启服务使配置生效

或者直接编辑 `config/config.yaml` 文件并重启服务。

## 安全提示

1. **保护 API Key**：不要将包含真实 API Key 的配置文件提交到版本控制系统
2. **定期更换**：建议定期更换 API Key
3. **监控使用**：注意监控 API 调用次数和费用
4. **最小权限**：为 API Key 分配最小必要权限

## 故障排查

### 问题：无法访问引导页面
- 检查服务是否正常启动
- 查看控制台日志输出
- 确认端口 8000 未被占用

### 问题：配置验证一直失败
- 检查网络连接
- 确认 API Key 是否有效
- 验证 Base URL 是否正确
- 查看控制台错误日志

### 问题：配置后仍然重定向到引导页
- 检查配置文件是否成功保存
- 重启服务
- 查看日志确认配置加载状态

## 相关文件

- `config/config.yaml` - 主配置文件
- `config/default_config.yaml` - 默认配置模板
- `lifetrace_backend/config.py` - 配置管理类
- `lifetrace_backend/server.py` - 服务器和 API 接口
- `lifetrace_backend/templates/setup.html` - 引导配置页面

## 更新日志

### v1.0.0 (2024-10-17)
- ✅ 实现初始配置引导功能
- ✅ 添加配置状态检测
- ✅ 添加中间件自动重定向
- ✅ 添加配置验证和初始化接口
- ✅ 创建美观的引导配置页面
