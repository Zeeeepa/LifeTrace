# LifeTrace 桌面版打包指引（本地 DMG）

> 目标：从本地代码生成可安装的 macOS DMG，包含内置后端与前端。
## 目录结构（打包前）
- 根目录核心：
  - `lifetrace/`：FastAPI 源码、配置（`config/` 下有 `config.yaml`、`prompt.yaml` 等）。
  - `frontend/`：Next.js 源码（打包前不会有 `.next`）。
  - `desktop/`：Electron 壳及资源占位。
- Electron 壳：
  - `desktop/app/main.js`、`desktop/app/package.json`（已配置 icon 路径、extraResources 等）。
  - `desktop/app/build/lifetrace_mac_icon.icns`：应用图标。
  - `desktop/app/dist/`：历史打包输出（可清理后重打）。
- 资源目标目录（打包前通常为空或旧产物，可清理后再复制）：
  - `desktop/resources/backend/`：PyInstaller onedir 输出目标目录，预期生成 `lifetrace-api/`。
  - `desktop/resources/frontend/`：Next.js standalone 输出目标目录，预期生成 `standalone/`。

## 目录结构（打包后）
- `desktop/resources/backend/lifetrace-api/`：后端 onedir 可执行及依赖、配置、模型
- `desktop/resources/frontend/standalone/`：前端 Next.js standalone 产物（含 `.next`、`node_modules`、`public`、`server.js`）
- `desktop/app/`：Electron 壳，`package.json`、`main.js`
- 打包输出：`desktop/app/dist/LifeTrace-<version>-arm64.dmg`（和展开的 `dist/mac-arm64/LifeTrace.app`）

## 前置要求
- macOS，安装了 uv（Python）、pnpm/node、npm。
- 运行前清理旧产物（可选）：`rm -rf desktop/resources/backend/lifetrace-api desktop/resources/frontend/standalone/.next desktop/resources/frontend/standalone/node_modules desktop/app/dist`

## 后端打包（PyInstaller onedir）
在项目根执行：
```bash
uv run --group dev pyinstaller lifetrace/server.py \
      --name lifetrace-api \
      --onedir \
      --paths . \
      --collect-all lifetrace \
      --collect-all chromadb \
      --collect-all posthog \
      --collect-all rapidocr_onnxruntime \
      --hidden-import chromadb.telemetry.product.posthog \
      --noupx \
      --distpath desktop/resources/backend

# 拷贝配置与模型到可执行同级，提供默认 rapidocr/配置
mkdir -p desktop/resources/backend/lifetrace-api/config desktop/resources/backend/lifetrace-api/models
cp lifetrace/config/*.yaml desktop/resources/backend/lifetrace-api/config/
cp lifetrace/models/*.onnx desktop/resources/backend/lifetrace-api/models/
```
完成后检查：`desktop/resources/backend/lifetrace-api/lifetrace-api` 存在且 `config/`、`models/` 也在。

## 前端打包（Next.js standalone）
```bash
cd frontend
pnpm install
pnpm build
NEXT_TELEMETRY_DISABLED=1 pnpm build

# 同步产物到 desktop/resources/frontend
rm -rf ../desktop/resources/frontend/standalone
mkdir -p ../desktop/resources/frontend
cp -R .next/standalone ../desktop/resources/frontend/standalone
cp -R .next/static ../desktop/resources/frontend/standalone/.next/static
cp -R public ../desktop/resources/frontend/standalone/public
```
确保 `desktop/resources/frontend/standalone/` 下有 `server.js`、`.next`、`node_modules`、`public`。

## Electron 打包为 DMG
```bash
cd desktop/app
npm install
npm run dist -- --mac dmg
```
输出位于 `desktop/app/dist/`，主要文件：
- `LifeTrace-<version>-arm64.dmg`（安装镜像）
- `mac-arm64/LifeTrace.app`（展开的 .app，可忽略，使用 DMG 安装）

## 安装与运行（本机或其他 Mac）
1) 双击 DMG，将 `LifeTrace.app` 拖到 `/Applications`。
2) 首次运行如被 Gatekeeper 拦截，可执行：
   ```bash
   sudo xattr -dr com.apple.quarantine /Applications/LifeTrace.app
   ```
   ```
   chmod +x /Applications/LifeTrace.app/Contents/MacOS/LifeTrace
   ```
3) 终端运行可查看启动日志：
   ```bash
   /Applications/LifeTrace.app/Contents/MacOS/LifeTrace
   ```
   正常情况下会启动后端（`lifetrace-api`）和前端，然后弹出主窗口。

## 备注
- Electron 前端启动使用 Electron 自带 Node（`process.execPath`），避免目标机缺少 `/usr/local/bin/node` 导致 ENOENT。
- 启动顺序：后端 → 等后端就绪 → 前端 → 等前端就绪 → 创建窗口，减少 Network Error。
- 默认未签名/未公证，分发给他人可能需要右键打开或移除 quarantine。签名/公证需另行配置 Apple 证书。
