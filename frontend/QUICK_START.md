# LifeTrace Frontend 快速开始

## 🚀 快速启动（2 分钟）

### 步骤 1: 安装依赖（已完成）

```bash
cd frontend
pnpm install  # 或 npm install
```

✅ 依赖已安装完成！

### 步骤 2: 启动后端服务

在另一个终端窗口中：

```bash
cd /Users/ailln/Workspace/github/lifetrace-app
python start_all_services.py
```

确保后端在 `http://localhost:8000` 运行。

### 步骤 3: 启动前端开发服务器

```bash
cd frontend
pnpm dev  # 或 npm run dev
```

### 步骤 4: 打开浏览器

访问 [http://localhost:3000](http://localhost:3000)

## 🎉 完成！

你现在应该可以看到 LifeTrace 的新 Next.js 前端界面了。

## 📱 功能预览

### 主页 (/)
- 搜索截图（4 种模式：传统/语义/多模态/事件）
- 查看统计信息
- 管理向量数据库

### 事件管理 (/events)
- 时间轴方式查看事件
- 浏览事件截图
- 筛选事件

### 聊天 (/chat)
- 与 AI 助手对话
- 基于截图上下文的问答（RAG）
- 管理会话历史

### 应用使用 (/app-usage)
- 查看应用使用时长
- 可视化统计图表

### 行为分析 (/analytics)
- 生产力评分
- 每日活动统计
- 热门应用排行

### 设置 (/settings)
- 配置系统参数
- AI 模型设置
- 存储管理

## 🔧 配置

环境变量文件 `.env.local`（已配置）：

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## 📚 更多信息

- 详细文档：查看 `README.md`
- 迁移指南：查看 `../MIGRATION_GUIDE.md`
- Next.js 文档：https://nextjs.org/docs

## 🐛 遇到问题？

### 前端无法启动

```bash
# 清除缓存并重新安装
rm -rf .next node_modules
pnpm install
pnpm dev
```

### API 请求失败

检查：
1. ✅ 后端服务是否运行在 `http://localhost:8000`
2. ✅ 浏览器控制台是否有 CORS 错误
3. ✅ `.env.local` 文件是否存在

### 端口被占用

```bash
# 使用其他端口
PORT=3001 pnpm dev
```

## 💡 开发提示

### 热重载

保存文件后，页面会自动刷新，无需手动刷新浏览器。

### TypeScript

项目使用 TypeScript，IDE 会提供完整的类型提示和自动补全。

### 组件结构

```
components/
├── common/       # 通用组件
├── layout/       # 布局组件
├── screenshot/   # 截图相关
└── search/       # 搜索相关
```

### 添加新页面

只需在 `app/` 目录下创建文件夹和 `page.tsx` 文件即可。

例如：
```bash
mkdir app/my-page
touch app/my-page/page.tsx
```

访问 `http://localhost:3000/my-page`

## 🎨 自定义

### 修改主题色

编辑 `app/globals.css` 中的 CSS 变量。

### 修改导航

编辑 `components/layout/Header.tsx` 中的 `navItems` 数组。

---

祝你使用愉快！🎉
