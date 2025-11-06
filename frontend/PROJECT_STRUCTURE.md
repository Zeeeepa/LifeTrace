# LifeTrace Frontend 项目结构

## 📁 目录结构

```
frontend/
│
├── app/                          # Next.js App Router 目录
│   ├── layout.tsx               # 根布局（包含 MainLayout）
│   ├── page.tsx                 # 主页 - 截图搜索和展示
│   ├── globals.css              # 全局样式（Tailwind CSS）
│   │
│   ├── analytics/               # 行为分析页面
│   │   └── page.tsx
│   │
│   ├── app-usage/               # 应用使用分析页面
│   │   └── page.tsx
│   │
│   ├── chat/                    # 聊天页面
│   │   └── page.tsx
│   │
│   ├── events/                  # 事件管理页面
│   │   └── page.tsx
│   │
│   └── settings/                # 设置页面
│       └── page.tsx
│
├── components/                   # React 组件
│   │
│   ├── common/                  # 通用 UI 组件
│   │   ├── Button.tsx           # 按钮组件
│   │   ├── Card.tsx             # 卡片组件（Card, CardHeader, CardTitle, CardContent）
│   │   ├── Input.tsx            # 输入框组件
│   │   ├── Loading.tsx          # 加载状态组件
│   │   └── Pagination.tsx       # 分页组件
│   │
│   ├── layout/                  # 布局组件
│   │   ├── Header.tsx           # 顶部导航栏
│   │   └── MainLayout.tsx       # 主布局容器
│   │
│   ├── screenshot/              # 截图相关组件
│   │   ├── ScreenshotCard.tsx   # 截图卡片
│   │   └── ScreenshotModal.tsx  # 截图详情模态框
│   │
│   └── search/                  # 搜索相关组件
│       └── SearchBar.tsx        # 搜索栏（支持多种搜索模式）
│
├── lib/                         # 工具库和配置
│   ├── api.ts                  # API 客户端（axios + 所有 API 函数）
│   ├── types.ts                # TypeScript 类型定义
│   └── utils.ts                # 工具函数（日期格式化、文本截断等）
│
├── public/                      # 静态资源
│   ├── file.svg
│   ├── globe.svg
│   ├── next.svg
│   ├── vercel.svg
│   └── window.svg
│
├── .env.local                   # 环境变量（本地）
├── next.config.ts               # Next.js 配置（包含 API 代理）
├── package.json                 # 项目依赖
├── pnpm-lock.yaml              # pnpm 锁文件
├── postcss.config.mjs          # PostCSS 配置
├── tailwind.config.ts          # Tailwind CSS 配置
├── tsconfig.json               # TypeScript 配置
│
├── README.md                    # 项目文档
├── QUICK_START.md              # 快速开始指南
└── PROJECT_STRUCTURE.md        # 本文件
```

## 📄 核心文件说明

### 配置文件

#### `next.config.ts`
```typescript
// 配置 API 代理和图片优化
- rewrites: 代理 /api/* 到后端
- images: 配置远程图片源
```

#### `.env.local`
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

#### `tsconfig.json`
```json
// TypeScript 配置
- paths: 配置 @ 别名指向根目录
- jsx: 使用 react-jsx
```

### 页面文件

#### `app/page.tsx` - 主页
- **功能**：
  - 截图搜索（4 种模式）
  - 统计信息展示
  - 向量数据库管理
  - 截图网格展示
  - 分页功能
- **组件使用**：
  - SearchBar
  - ScreenshotCard
  - ScreenshotModal
  - Pagination
  - Card

#### `app/events/page.tsx` - 事件管理
- **功能**：
  - 时间轴展示
  - 事件截图轮播
  - 日期和应用筛选
- **特色**：
  - 可视化时间轴
  - 截图导航（上一张/下一张）
  - OCR 文本预览

#### `app/chat/page.tsx` - 聊天助手
- **功能**：
  - AI 对话
  - RAG 支持（基于截图上下文）
  - 会话管理
  - Markdown 渲染
- **组件使用**：
  - marked（Markdown 解析）
  - 自定义消息气泡

#### `app/app-usage/page.tsx` - 应用使用分析
- **功能**：
  - 应用使用时长统计
  - 百分比可视化
  - 日期范围筛选

#### `app/analytics/page.tsx` - 行为分析
- **功能**：
  - 生产力评分
  - 热门应用排行
  - 每日活动统计

#### `app/settings/page.tsx` - 设置
- **功能**：
  - 基本设置（截图间隔、OCR 语言）
  - AI 设置（API Key、模型选择）
  - 存储设置（自动清理）

### 组件库

#### `components/common/` - 通用组件

##### `Button.tsx`
```tsx
// Props
variant: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
size: 'sm' | 'md' | 'lg'

// 使用
<Button variant="primary" onClick={handleClick}>
  点击我
</Button>
```

##### `Card.tsx`
```tsx
// 导出多个组件
Card, CardHeader, CardTitle, CardContent

// 使用
<Card>
  <CardHeader>
    <CardTitle>标题</CardTitle>
  </CardHeader>
  <CardContent>内容</CardContent>
</Card>
```

##### `Input.tsx`
```tsx
// Props
label?: string
error?: string
type?: string

// 使用
<Input
  label="用户名"
  placeholder="请输入..."
  error={errors.username}
/>
```

##### `Loading.tsx`
```tsx
// Props
text?: string
size?: 'sm' | 'md' | 'lg'

// 使用
<Loading text="加载中..." size="md" />
```

##### `Pagination.tsx`
```tsx
// Props
currentPage: number
totalPages: number
onPageChange: (page: number) => void

// 使用
<Pagination
  currentPage={1}
  totalPages={10}
  onPageChange={setPage}
/>
```

#### `components/layout/` - 布局组件

##### `Header.tsx`
- 顶部导航栏
- 包含所有主要页面链接
- 响应式设计
- 高亮当前页面

##### `MainLayout.tsx`
- 主布局容器
- 包含 Header
- 提供一致的页面结构

#### `components/screenshot/` - 截图组件

##### `ScreenshotCard.tsx`
- 截图卡片展示
- 显示评分（语义/多模态）
- 悬停动画
- 点击查看详情

##### `ScreenshotModal.tsx`
- 截图详情弹窗
- 显示完整信息
- ESC 键关闭
- 点击背景关闭

#### `components/search/` - 搜索组件

##### `SearchBar.tsx`
- 多种搜索模式切换
- 关键词、日期、应用筛选
- 表单验证
- 响应式布局

### 工具库

#### `lib/api.ts`
```typescript
// API 客户端实例
const apiClient = axios.create({...})

// API 函数集合
export const api = {
  getStatistics: () => {...},
  getScreenshots: (params) => {...},
  search: (params) => {...},
  semanticSearch: (params) => {...},
  // ... 更多 API
}

// 使用
import { api } from '@/lib/api';
const response = await api.getScreenshots({ limit: 10 });
```

#### `lib/types.ts`
```typescript
// 类型定义
export interface Screenshot {...}
export interface Event {...}
export interface Statistics {...}
export type SearchType = 'traditional' | 'semantic' | 'multimodal' | 'event';

// 使用
import { Screenshot } from '@/lib/types';
const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
```

#### `lib/utils.ts`
```typescript
// 工具函数
export function cn(...inputs) {...}          // 类名合并
export function formatDateTime(date) {...}   // 日期格式化
export function formatRelativeTime(date) {...} // 相对时间
export function calculateDuration(start, end) {...} // 计算时长
export function formatDuration(minutes) {...} // 格式化时长
export function truncateText(text, max) {...} // 文本截断
export function debounce(func, wait) {...}   // 防抖
export function throttle(func, limit) {...}  // 节流

// 使用
import { formatDateTime } from '@/lib/utils';
const formatted = formatDateTime(screenshot.created_at);
```

## 🎨 样式系统

### Tailwind CSS

项目使用 Tailwind CSS 4，所有样式通过实用类实现：

```tsx
<div className="flex items-center justify-between rounded-lg bg-white p-4 shadow-md">
  {/* 内容 */}
</div>
```

### CSS 变量

定义在 `app/globals.css` 中：

```css
:root {
  --background: #ffffff;
  --foreground: oklch(0.145 0 0);
  --primary: #030213;
  /* ... 更多变量 */
}
```

## 🔌 API 集成

### API 代理

Next.js 配置了自动代理：

```
/api/* → http://localhost:8000/api/*
/assets/* → http://localhost:8000/assets/* (后端应用图标 API)
```

### API 调用流程

```
组件 → lib/api.ts → axios → Next.js 代理 → 后端服务
```

### 错误处理

```typescript
try {
  const response = await api.getScreenshots();
  setData(response.data);
} catch (error) {
  console.error('加载失败:', error);
  // 显示错误提示
}
```

## 🎯 路由系统

Next.js App Router 基于文件系统：

```
app/page.tsx          → /
app/events/page.tsx   → /events
app/chat/page.tsx     → /chat
```

### 导航

```tsx
import Link from 'next/link';

<Link href="/events">
  <button>查看事件</button>
</Link>
```

## 💾 状态管理

### 本地状态

使用 React Hooks：

```tsx
const [data, setData] = useState([]);
const [loading, setLoading] = useState(false);
```

### 全局状态

可选使用 Zustand（已安装但未使用）：

```typescript
// 创建 store
import { create } from 'zustand';

const useStore = create((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}));

// 使用
const { count, increment } = useStore();
```

## 🔐 TypeScript

### 类型导入

```typescript
import { Screenshot, Event } from '@/lib/types';
```

### Props 类型

```typescript
interface MyComponentProps {
  data: Screenshot[];
  onSelect: (item: Screenshot) => void;
}

export default function MyComponent({ data, onSelect }: MyComponentProps) {
  // ...
}
```

## 📱 响应式设计

使用 Tailwind 响应式前缀：

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* 手机1列，平板2列，桌面3列 */}
</div>
```

## ⚡ 性能优化

### 图片优化

```tsx
import Image from 'next/image';

<Image
  src="/screenshot.jpg"
  alt="截图"
  width={300}
  height={200}
  loading="lazy"
/>
```

### 懒加载

```tsx
const HeavyComponent = lazy(() => import('./HeavyComponent'));

<Suspense fallback={<Loading />}>
  <HeavyComponent />
</Suspense>
```

## 🧪 开发工具

### ESLint

```bash
npm run lint
```

### TypeScript 检查

```bash
npx tsc --noEmit
```

### 开发服务器

```bash
npm run dev
```

## 📦 构建部署

### 构建

```bash
npm run build
```

### 启动

```bash
npm run start
```

### 分析

```bash
# 安装 @next/bundle-analyzer
ANALYZE=true npm run build
```

## 🎓 学习资源

- **Next.js 文档**: https://nextjs.org/docs
- **React 文档**: https://react.dev
- **Tailwind CSS**: https://tailwindcss.com/docs
- **TypeScript**: https://www.typescriptlang.org/docs

---

最后更新：2025-11-04
