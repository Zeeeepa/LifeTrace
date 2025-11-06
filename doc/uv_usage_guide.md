# LifeTrace 使用 uv 进行依赖管理指南

## 什么是 uv？

[uv](https://github.com/astral-sh/uv) 是一个极快的 Python 包管理器和环境管理工具，由 Astral 团队（Ruff 的创建者）开发。它可以替代 pip、pip-tools、pipx、poetry、pyenv 等工具。

### uv 的优势

- ⚡ **极快速度**: 比 pip 快 10-100 倍
- 🔒 **可靠的依赖解析**: 生成可重现的 lock 文件
- 🎯 **统一工具**: 包安装、虚拟环境、项目管理一体化
- 🌍 **跨平台**: 支持 Windows、macOS、Linux
- 📦 **兼容性**: 完全兼容 PyPI 和现有的 pip 工作流

## 安装 uv

### macOS/Linux

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### Windows

```powershell
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
```

### 使用 pip 安装

```bash
pip install uv
```

### 验证安装

```bash
uv --version
```

## 在 LifeTrace 项目中使用 uv

### 1. 初始化项目

克隆仓库后，使用 uv 同步依赖：

```bash
cd lifetrace-app

# 同步依赖（根据 pyproject.toml 和 uv.lock）
uv sync
```

这会：
- 自动创建 `.venv` 虚拟环境
- 安装所有依赖项
- 确保与 `uv.lock` 文件一致的版本

### 2. 激活虚拟环境

**macOS/Linux:**
```bash
source .venv/bin/activate
```

**Windows:**
```powershell
.venv\Scripts\activate
```

### 3. 运行项目

激活环境后，可以正常运行项目：

```bash
# 初始化数据库
python init_database.py

# 启动服务
python -m lifetrace.server
```

### 4. 使用 uv 运行命令（无需激活环境）

uv 支持在不激活虚拟环境的情况下运行命令：

```bash
# 直接运行 Python 脚本
uv run python -m lifetrace.server

# 运行初始化
uv run python init_database.py
```

## 常用 uv 命令

### 依赖管理

```bash
# 添加新依赖
uv add package-name

# 添加开发依赖
uv add --dev package-name

# 删除依赖
uv remove package-name

# 更新所有依赖到最新版本
uv lock --upgrade

# 同步依赖（安装/更新到 lock 文件的版本）
uv sync
```

### 虚拟环境管理

```bash
# 创建虚拟环境
uv venv

# 指定 Python 版本创建环境
uv venv --python 3.13

# 删除虚拟环境
rm -rf .venv
```

### 运行命令

```bash
# 在虚拟环境中运行命令
uv run python script.py

# 运行 pip 命令
uv pip install package-name

# 列出已安装的包
uv pip list

# 显示包信息
uv pip show package-name
```

### 项目管理

```bash
# 查看项目信息
uv tree

# 检查依赖冲突
uv pip check

# 导出 requirements.txt
uv pip freeze > requirements.txt
```

## 与传统 pip 的对比

### 使用 pip

```bash
# 创建虚拟环境
python -m venv .venv
source .venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 添加新包
pip install new-package
pip freeze > requirements.txt
```

### 使用 uv

```bash
# 一步完成环境创建和依赖安装
uv sync

# 添加新包（自动更新 lock 文件）
uv add new-package

# 无需手动管理 requirements.txt
```

## 迁移到 uv

如果你之前使用 pip + requirements.txt：

### 1. 生成 pyproject.toml

```bash
# uv 会自动识别现有的 requirements.txt
uv init
```

### 2. 导入现有依赖

```bash
# 从 requirements.txt 导入
uv add -r requirements.txt
```

### 3. 生成 lock 文件

```bash
uv lock
```

## 项目文件说明

### pyproject.toml

定义项目元数据和依赖项：

```toml
[project]
name = "lifetrace"
version = "0.1.0"
requires-python = ">=3.13"
dependencies = [
    "fastapi>=0.100.0",
    "uvicorn[standard]>=0.20.0",
    # ... 其他依赖
]
```

### uv.lock

锁定文件，记录所有依赖的精确版本：
- 🔒 **版本锁定**: 确保团队成员使用相同版本
- 🔄 **可重现构建**: 在任何环境都能重现相同的依赖树
- 📝 **自动生成**: 由 uv 自动维护，不要手动编辑

### .venv/

虚拟环境目录：
- 由 `uv sync` 或 `uv venv` 创建
- 包含所有已安装的包
- 应该添加到 `.gitignore`

## 常见问题

### Q: uv 和 pip 可以混用吗？

A: 可以，但不推荐。建议统一使用 uv 进行依赖管理，以保持一致性。

### Q: 如何更新单个包？

```bash
# 更新特定包到最新版本
uv add package-name --upgrade

# 或编辑 pyproject.toml 后重新 lock
uv lock --upgrade-package package-name
```

### Q: uv.lock 文件需要提交到 Git 吗？

A: 是的！`uv.lock` 应该提交到版本控制，以确保所有开发者使用相同的依赖版本。

### Q: 如何处理平台特定的依赖？

```bash
# uv 会自动处理平台差异
# 在 pyproject.toml 中可以指定平台特定依赖
```

### Q: CI/CD 中如何使用 uv？

```yaml
# GitHub Actions 示例
- name: Install uv
  run: curl -LsSf https://astral.sh/uv/install.sh | sh

- name: Install dependencies
  run: uv sync

- name: Run tests
  run: uv run pytest
```

### Q: 遇到依赖冲突怎么办？

```bash
# 查看冲突详情
uv pip check

# 强制重新解析依赖
uv lock --refresh
```

## 性能对比

典型的 LifeTrace 项目依赖安装时间对比：

| 工具 | 时间 | 说明 |
|------|------|------|
| pip | ~120s | 首次安装 |
| pip | ~45s | 使用缓存 |
| uv | ~15s | 首次安装 |
| uv | ~3s | 使用 lock 文件 |

## 推荐工作流

### 日常开发

```bash
# 1. 拉取最新代码
git pull

# 2. 同步依赖（如果 lock 文件有更新）
uv sync

# 3. 运行服务
uv run python -m lifetrace.server
```

### 添加新功能

```bash
# 1. 添加需要的包
uv add new-package

# 2. 开发和测试
uv run python script.py

# 3. 提交更改（包括 pyproject.toml 和 uv.lock）
git add pyproject.toml uv.lock
git commit -m "Add new-package dependency"
```

### 更新依赖

```bash
# 1. 更新所有依赖到最新兼容版本
uv lock --upgrade

# 2. 测试
uv run pytest

# 3. 如果测试通过，提交 uv.lock
git add uv.lock
git commit -m "Update dependencies"
```

## 其他资源

- 📖 [uv 官方文档](https://docs.astral.sh/uv/)
- 🐙 [uv GitHub 仓库](https://github.com/astral-sh/uv)
- 💬 [uv Discord 社区](https://discord.gg/astral)

## 小贴士

1. ✅ **使用 `uv sync`** 而不是 `uv pip install`，以利用 lock 文件
2. ✅ **定期运行 `uv lock --upgrade`** 来更新依赖
3. ✅ **提交 `uv.lock`** 到版本控制
4. ✅ **使用 `uv run`** 来运行脚本，无需手动激活环境
5. ✅ **在 CI/CD 中使用 uv** 以加速构建时间

## 总结

使用 uv 可以显著提升 LifeTrace 项目的开发体验：

- 🚀 更快的依赖安装
- 🔒 更可靠的依赖管理
- 🎯 更简单的工作流
- 🌍 更好的跨平台支持

开始使用 uv，享受更高效的 Python 开发！
