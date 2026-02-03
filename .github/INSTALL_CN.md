# 一键安装（完整选项）

本文件包含主 README 中提到的一键安装完整说明。

## 环境要求
- Python 3.12+
- Node.js 20+
- Git
- Rust（仅 Tauri 构建需要）

## 基础用法

macOS/Linux：

```bash
curl -fsSL https://raw.githubusercontent.com/FreeU-group/FreeTodo/main/scripts/install.sh | bash
```

Windows（PowerShell）：

```powershell
iwr -useb https://raw.githubusercontent.com/FreeU-group/FreeTodo/main/scripts/install.ps1 | iex
```

## 默认值

`mode=tauri`、`variant=web`、`frontend=build`、`backend=script`。

## 可选环境变量

- `LIFETRACE_DIR`：安装目录（默认使用仓库名）
- `LIFETRACE_REPO`：仓库地址（默认 `https://github.com/FreeU-group/FreeTodo.git`）
- `LIFETRACE_REF`：分支或标签（默认 `main`，不稳定开发版使用 `dev`）
- `LIFETRACE_MODE`：`web`、`tauri`、`electron` 或 `island`
- `LIFETRACE_VARIANT`：`web` 或 `island`
- `LIFETRACE_FRONTEND`：`build` 或 `dev`（`web` 默认 `dev`）
- `LIFETRACE_BACKEND`：`script` 或 `pyinstaller`
- `LIFETRACE_RUN`：`1`（默认）安装后自动运行，`0` 仅安装

## 示例

```bash
# Web 开发
curl -fsSL https://raw.githubusercontent.com/FreeU-group/FreeTodo/main/scripts/install.sh | bash -s -- --mode web --frontend dev

# Tauri 开发（启动后端 + 前端 dev，再运行 tauri dev）
curl -fsSL https://raw.githubusercontent.com/FreeU-group/FreeTodo/main/scripts/install.sh | bash -s -- --mode tauri --frontend dev

# Electron Island 开发
curl -fsSL https://raw.githubusercontent.com/FreeU-group/FreeTodo/main/scripts/install.sh | bash -s -- --mode electron --variant island --frontend dev

# Tauri 构建（后端 PyInstaller）
curl -fsSL https://raw.githubusercontent.com/FreeU-group/FreeTodo/main/scripts/install.sh | bash -s -- --mode tauri --frontend build --backend pyinstaller

# 切换分支
curl -fsSL https://raw.githubusercontent.com/FreeU-group/FreeTodo/main/scripts/install.sh | bash -s -- --ref dev
```
