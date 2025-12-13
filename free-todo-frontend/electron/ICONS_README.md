# 应用图标生成指南

## 当前状态

- ✅ `icon.png` - Linux 图标（已准备）
- ⚠️ `icon.icns` - macOS 图标（需要生成）
- ⚠️ `icon.ico` - Windows 图标（需要生成）

## 图标要求

### macOS (.icns)
- 格式：ICNS
- 推荐尺寸：512x512, 256x256, 128x128, 64x64, 32x32, 16x16
- 支持 Retina 显示

### Windows (.ico)
- 格式：ICO
- 推荐尺寸：256x256, 128x128, 64x64, 48x48, 32x32, 16x16
- 包含多个尺寸在一个文件中

### Linux (.png)
- 格式：PNG
- 推荐尺寸：512x512 或更高
- 支持透明背景

## 生成图标的方法

### 方法 1：使用在线工具

1. 访问 [CloudConvert](https://cloudconvert.com/) 或 [iConvert Icons](https://iconverticons.com/online/)
2. 上传 `icon.png`
3. 转换为 `.icns` (macOS) 和 `.ico` (Windows)
4. 下载并放置到当前目录

### 方法 2：使用 electron-icon-builder（推荐）

安装工具：
```bash
npm install -g electron-icon-builder
```

生成图标：
```bash
cd free-todo-frontend
electron-icon-builder --input=./public/logo.png --output=./electron --flatten
```

这将自动生成：
- `electron/icons/mac/icon.icns`
- `electron/icons/win/icon.ico`
- `electron/icons/png/` 目录下的各种尺寸

### 方法 3：使用 Photoshop 或 GIMP

#### macOS (.icns)
1. 在 macOS 上创建 iconset 文件夹
2. 导出多个尺寸的 PNG 文件
3. 使用 `iconutil` 命令转换：
   ```bash
   iconutil -c icns icon.iconset -o icon.icns
   ```

#### Windows (.ico)
1. 使用 Photoshop ICO 插件
2. 或使用 GIMP 导出为 ICO 格式
3. 确保包含多个尺寸

### 方法 4：使用 npm 包（自动化）

在项目中添加图标生成脚本：

```bash
npm install --save-dev electron-icon-maker
```

创建脚本 `scripts/generate-icons.js`：
```javascript
const iconMaker = require('electron-icon-maker');

iconMaker({
  input: './public/logo.png',
  output: './electron',
}).then(() => {
  console.log('图标生成完成！');
});
```

运行：
```bash
node scripts/generate-icons.js
```

## 快速开始（临时方案）

如果您只是想快速测试打包，可以：

1. **暂时跳过图标**：在 `electron-builder.json` 中注释掉图标配置
2. **使用默认图标**：Electron 会使用默认图标
3. **稍后添加**：等需要发布时再生成正式图标

## 图标设计建议

- 使用简洁的设计，在小尺寸下也清晰可见
- 使用透明背景（PNG 格式）
- 避免过多细节，保持图标识别度
- 在不同背景（明暗）下测试显示效果
- 符合各平台的设计规范

## 当前项目使用

本项目使用 `public/logo.png` 作为基础图标源文件。
请根据上述方法生成对应平台的图标文件。

生成后的文件应放置在：
- `electron/icon.icns` - macOS
- `electron/icon.ico` - Windows  
- `electron/icon.png` - Linux（已存在）
