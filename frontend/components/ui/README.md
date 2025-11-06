# Shadcn UI 组件库

这个目录包含按照 shadcn/ui 标准构建的 UI 组件。

## 侧边栏导航组件

### SidebarNav

一个符合 shadcn 设计规范的侧边栏导航组件，具有以下特性：

#### 功能特性
- ✅ 完全符合 shadcn/ui 设计规范
- ✅ 支持键盘导航（Enter/Space）
- ✅ 完整的无障碍支持（ARIA 标签）
- ✅ 流畅的过渡动画
- ✅ 支持 badge（可选）
- ✅ 支持禁用状态
- ✅ 响应式设计
- ✅ 深色/浅色主题支持

#### 使用示例

```tsx
import { Sidebar, SidebarContent, SidebarNav } from '@/components/ui/sidebar-nav';
import { Calendar, BarChart2, FileText } from 'lucide-react';

const menuItems = [
  { id: 'events', label: '事件管理', icon: Calendar },
  { id: 'analytics', label: '行为分析', icon: BarChart2 },
  { id: 'plan', label: '工作计划', icon: FileText },
];

function MyApp() {
  const [activeMenu, setActiveMenu] = useState('events');

  return (
    <Sidebar className="w-56">
      <SidebarContent>
        <SidebarNav
          items={menuItems}
          activeItem={activeMenu}
          onItemClick={setActiveMenu}
        />
      </SidebarContent>
    </Sidebar>
  );
}
```

#### 带 Badge 的示例

```tsx
const menuItems = [
  { id: 'events', label: '事件管理', icon: Calendar, badge: 5 },
  { id: 'analytics', label: '行为分析', icon: BarChart2, badge: 'NEW' },
  { id: 'plan', label: '工作计划', icon: FileText },
];
```

#### 设计特性

1. **视觉反馈**
   - 激活状态带有左侧指示条
   - 图标颜色变化
   - 悬停和聚焦状态
   - 点击时的缩放效果

2. **无障碍性**
   - 完整的键盘支持
   - ARIA 标签
   - 语义化 HTML

3. **主题集成**
   - 使用 CSS 变量
   - 自动适配深色/浅色主题
   - 与全局主题系统集成

### Sidebar 容器组件

#### Sidebar
主容器组件，提供侧边栏的基础结构。

#### SidebarHeader
侧边栏头部区域，用于放置标题或Logo。

#### SidebarContent
侧边栏内容区域，自动处理滚动。

#### SidebarFooter
侧边栏底部区域，用于放置额外操作或信息。

#### 完整布局示例

```tsx
<Sidebar className="w-64">
  <SidebarHeader>
    <h2>我的应用</h2>
  </SidebarHeader>

  <SidebarContent>
    <SidebarNav
      items={menuItems}
      activeItem={activeMenu}
      onItemClick={setActiveMenu}
    />
  </SidebarContent>

  <SidebarFooter>
    <p>版本 1.0.0</p>
  </SidebarFooter>
</Sidebar>
```

## 导航菜单组件

### NavigationMenu

基于 Radix UI 构建的导航菜单组件，适用于顶部导航栏。

详细文档请参考 [shadcn/ui Navigation Menu](https://ui.shadcn.com/docs/components/navigation-menu)。

## 样式系统

所有组件使用以下 CSS 变量，确保与主题系统完美集成：

- `--sidebar`: 侧边栏背景色
- `--sidebar-foreground`: 侧边栏文字颜色
- `--sidebar-primary`: 侧边栏主色调
- `--sidebar-accent`: 侧边栏强调色
- `--sidebar-border`: 侧边栏边框颜色
- `--ring`: 聚焦环颜色

## TypeScript 支持

所有组件都提供完整的 TypeScript 类型定义：

```tsx
export interface SidebarNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
  badge?: string | number;
}
```
