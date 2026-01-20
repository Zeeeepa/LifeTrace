"use client";

/**
 * Island 专用 Header 组件
 * 用于形态3/4，提供窗口控制按钮
 * 与原 FreeTodo Header 共享 HeaderIsland 组件
 */

import { Maximize2, Minimize2, X } from "lucide-react";
import Image from "next/image";
import { LayoutSelector } from "@/components/common/layout/LayoutSelector";
import { ThemeToggle } from "@/components/common/theme/ThemeToggle";
import { LanguageToggle } from "@/components/common/ui/LanguageToggle";
import { SettingsToggle } from "@/components/common/ui/SettingsToggle";
import { HeaderIsland } from "@/components/notification/HeaderIsland";
import { IslandMode } from "@/lib/island/types";

interface IslandHeaderProps {
  /** 当前模式 */
  mode: IslandMode;
  /** 模式切换回调 */
  onModeChange: (mode: IslandMode) => void;
  /** SIDEBAR 模式下是否已展开到 2+ 栏（可选） */
  isExpanded?: boolean;
}

export function IslandHeader({ mode, onModeChange, isExpanded = false }: IslandHeaderProps) {
  const isSidebar = mode === IslandMode.SIDEBAR;
  const isFullscreen = mode === IslandMode.FULLSCREEN;

  // 显示工具按钮的条件：全屏模式 或 侧边栏已展开到 2+ 栏（宽度足够）
  const shouldShowTools = isFullscreen || (isSidebar && isExpanded);

  return (
    <header className="relative flex h-15 shrink-0 items-center bg-primary-foreground dark:bg-accent px-4 text-foreground overflow-visible app-region-drag">
      {/* 左侧：Logo + 应用名称 */}
      <div className="flex items-center gap-2 shrink-0 app-region-no-drag">
        <div className="relative h-8 w-8 shrink-0">
          {/* 浅色模式图标 */}
          <Image
            src="/free-todo-logos/free_todo_icon_4_dark_with_grid.png"
            alt="Free Todo Logo"
            width={32}
            height={32}
            className="object-contain block dark:hidden"
          />
          {/* 深色模式图标 */}
          <Image
            src="/free-todo-logos/free_todo_icon_4_with_grid.png"
            alt="Free Todo Logo"
            width={32}
            height={32}
            className="object-contain hidden dark:block"
          />
        </div>
        <h1 className={`text-lg font-semibold tracking-tight text-foreground ${isSidebar ? "hidden md:block" : ""}`}>
          Free Todo: Your AI Secretary
        </h1>
      </div>

      {/* 中间：HeaderIsland 通知区域（与原 FreeTodo 共享） */}
      <div className="flex-1 flex items-center justify-center relative min-w-0 overflow-visible app-region-no-drag">
        <HeaderIsland />
      </div>

      {/* 右侧：工具按钮 + 窗口控制 */}
      <div className="flex items-center gap-2 app-region-no-drag">
        {/* 工具按钮 - 全屏模式或 SIDEBAR 已展开时显示 */}
        {shouldShowTools && (
          <>
            <LayoutSelector showChevron={false} />
            <ThemeToggle />
            <LanguageToggle />
            <SettingsToggle />
            <div className="w-px h-4 bg-border mx-1" />
          </>
        )}

        {/* 窗口控制按钮 */}
        {/* 缩小/展开按钮 */}
        {isSidebar ? (
          <button
            type="button"
            onClick={() => onModeChange(IslandMode.FULLSCREEN)}
            className="w-7 h-7 flex items-center justify-center rounded-md
                       hover:bg-accent active:bg-accent/80
                       text-muted-foreground hover:text-foreground
                       transition-colors"
            title="全屏"
          >
            <Maximize2 size={14} />
          </button>
        ) : isFullscreen ? (
          <button
            type="button"
            onClick={() => onModeChange(IslandMode.SIDEBAR)}
            className="w-7 h-7 flex items-center justify-center rounded-md
                       hover:bg-accent active:bg-accent/80
                       text-muted-foreground hover:text-foreground
                       transition-colors"
            title="缩小"
          >
            <Minimize2 size={14} />
          </button>
        ) : null}

        {/* 关闭按钮 - 回到形态1 */}
        <button
          type="button"
          onClick={() => onModeChange(IslandMode.FLOAT)}
          className="w-7 h-7 flex items-center justify-center rounded-md
                     hover:bg-destructive/10 active:bg-destructive/20
                     text-muted-foreground hover:text-destructive
                     transition-colors"
          title="收起"
        >
          <X size={14} />
        </button>
      </div>
    </header>
  );
}
