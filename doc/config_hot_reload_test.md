# 配置热重载功能测试指南

## 功能概述

LifeTrace现在支持配置文件热重载功能。当您修改`config/config.yaml`文件后，各进程（Server、Recorder、OCR）会自动检测配置变更并立即应用新配置，无需重启进程。

## 实现特性

### 1. 自动监听
- 使用`watchdog`库监听`config/config.yaml`文件变化
- 支持防抖机制（0.5秒延迟），避免频繁重载
- 线程安全，支持并发访问

### 2. 即时生效
- 配置变更后立即生效（不重新初始化已有服务）
- 各进程独立监听和响应配置变更

### 3. 支持的配置项

#### Server进程
- LLM配置（api_key、base_url、model等）
- 服务器配置（host、port）
- 其他配置项

#### Recorder进程
- 截图间隔（`record.interval`）
- 监控屏幕列表（`record.screens`）
- 去重配置（`storage.deduplicate`、`storage.hash_threshold`）
- 黑名单配置（`record.blacklist.*`）
- 超时配置（`record.file_io_timeout`等）

#### OCR进程
- OCR检查间隔（`ocr.check_interval`）
- OCR启用状态（`ocr.enabled`）
- OCR置信度阈值（`ocr.confidence_threshold`）

## 测试步骤

### 前提条件

1. 确保已安装`watchdog`库：
```bash
conda activate laptop_showcase
pip install watchdog>=3.0.0
```

2. 确保`config/config.yaml`文件存在且可读写

### 测试1：Server进程 - LLM配置热重载

1. 启动Server进程：
```bash
conda activate laptop_showcase
python -m lifetrace_backend.server
```

2. 观察启动日志，确认看到：
```
已启动配置文件监听
```

3. 打开`config/config.yaml`，修改LLM配置：
```yaml
llm:
  api_key: "your-new-api-key"
  base_url: "https://new-url.com"
  model: "new-model"
```

4. 保存文件，观察Server日志，应该看到：
```
检测到配置文件变更: config/config.yaml
配置文件已重新加载
检测到LLM配置变更
LLM配置状态已更新
```

5. 访问`http://localhost:8000/api/get-config`，确认配置已更新

### 测试2：Recorder进程 - 截图间隔热重载

1. 启动Recorder进程：
```bash
conda activate laptop_showcase
python -m lifetrace_backend.recorder
```

2. 观察启动日志，确认看到：
```
已启动配置文件监听
```

3. 打开`config/config.yaml`，修改截图间隔：
```yaml
record:
  interval: 5  # 从1秒改为5秒
```

4. 保存文件，观察Recorder日志，应该看到：
```
检测到配置文件变更: config/config.yaml
配置文件已重新加载
截图间隔已更新: 1s -> 5s
```

5. 观察截图行为，确认间隔已变为5秒

### 测试3：Recorder进程 - 黑名单配置热重载

1. 在Recorder运行时，修改黑名单配置：
```yaml
record:
  blacklist:
    enabled: true
    apps:
      - "WeChat"
      - "QQ"
```

2. 保存文件，观察日志：
```
黑名单配置已更新
黑名单功能已启用
```

3. 切换到黑名单中的应用，确认不再截图

### 测试4：OCR进程 - 检查间隔热重载

1. 启动OCR进程：
```bash
conda activate laptop_showcase
python -m lifetrace_backend.simple_ocr
```

2. 观察启动日志，确认看到：
```
已启动配置文件监听
```

3. 修改OCR检查间隔：
```yaml
ocr:
  check_interval: 10  # 从5秒改为10秒
```

4. 保存文件，观察OCR日志：
```
检测到配置文件变更: config/config.yaml
配置文件已重新加载
OCR检查间隔已更新: 5s -> 10s
```

### 测试5：去重配置热重载

1. 在Recorder运行时，修改去重配置：
```yaml
storage:
  deduplicate: false  # 禁用去重
  hash_threshold: 10  # 修改阈值
```

2. 保存文件，观察日志：
```
去重功能已禁用
去重阈值已更新: 5 -> 10
```

### 测试6：配置文件错误处理

1. 故意在配置文件中引入语法错误：
```yaml
record:
  interval: [invalid yaml syntax
```

2. 保存文件，观察日志：
```
配置重载失败: [错误信息]
```

3. 确认进程仍在运行，使用旧配置

4. 修复配置文件，确认配置正确重载

### 测试7：多进程同时监听

1. 同时启动Server、Recorder、OCR三个进程

2. 修改`config/config.yaml`：
```yaml
record:
  interval: 3
ocr:
  check_interval: 8
llm:
  model: "qwen-plus"
```

3. 保存文件，确认三个进程都检测到变更并各自更新相关配置

## 预期行为

### 正常情况
- 配置文件修改后0.5-1秒内检测到变更
- 配置正确重载，日志中显示变更信息
- 新配置立即生效
- 进程继续正常运行

### 异常情况
- 配置文件语法错误时，保留旧配置，记录错误日志
- 配置文件被删除时，继续使用内存中的配置
- watchdog库不可用时，优雅降级（不支持热重载但进程正常运行）

## 日志检查点

### Server进程日志
```
已启动配置文件监听
检测到配置文件变更: config/config.yaml
配置文件已重新加载
检测到LLM配置变更
LLM配置状态已更新: 已配置
```

### Recorder进程日志
```
已启动配置文件监听
检测到配置文件变更: config/config.yaml
配置文件已重新加载
截图间隔已更新: 1s -> 3s
```

### OCR进程日志
```
已启动配置文件监听
检测到配置文件变更: config/config.yaml
配置文件已重新加载
OCR检查间隔已更新: 5s -> 8s
```

## 故障排查

### 1. 配置未生效
- 检查日志中是否有"检测到配置文件变更"消息
- 确认配置文件路径正确
- 检查配置文件语法是否正确
- 确认watchdog库已安装

### 2. 频繁重载
- 检查是否有其他程序频繁修改配置文件
- 查看防抖延迟是否合适（默认0.5秒）

### 3. 进程异常
- 检查回调函数中是否有异常
- 查看完整的错误日志
- 确认配置文件权限正确

## 性能影响

配置热重载功能对系统性能影响极小：
- watchdog库使用操作系统原生的文件监听机制，CPU占用几乎为零
- 防抖机制避免频繁重载
- 配置重载过程使用线程锁保护，不影响正常业务

## 注意事项

1. **不重新初始化服务**：配置更新只修改配置值，不会重新创建OCR引擎、向量数据库等重量级对象

2. **线程安全**：配置读写使用线程锁保护，可以安全地在多线程环境中使用

3. **向后兼容**：如果watchdog库不可用，系统仍能正常运行，只是不支持热重载

4. **立即生效**：大部分配置变更立即生效，但某些配置可能在下一个处理周期才体现出来

## 总结

配置热重载功能大大提升了LifeTrace的易用性，您可以：
- 无需重启进程即可调整配置
- 实时测试不同的配置参数
- 快速响应配置需求变化
- 减少服务中断时间

所有修改都会自动检测并应用，让配置管理更加便捷！
