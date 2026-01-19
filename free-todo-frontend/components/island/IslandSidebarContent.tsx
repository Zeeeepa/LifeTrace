"use client";

/**
 * Island 侧边栏内容组件
 * 在 SIDEBAR 模式下显示单栏面板 + 底部 Dock 切换
 * 直接使用 FreeTodo 原有的样式，保持一致性
 */

import { useEffect, useRef, useState } from "react";
import { IslandHeader } from "@/components/island/IslandHeader";
import { BottomDock } from "@/components/layout/BottomDock";
import { PanelContent } from "@/components/layout/PanelContent";
import { GlobalDndProvider } from "@/lib/dnd";
import { IslandMode } from "@/lib/island/types";

interface IslandSidebarContentProps {
  onModeChange: (mode: IslandMode) => void;
}

export function IslandSidebarContent({ onModeChange }: IslandSidebarContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-full h-full flex flex-col overflow-hidden bg-background">
        <div className="h-12 shrink-0 bg-primary-foreground dark:bg-accent" />
        <div className="flex-1" />
      </div>
    );
  }

  return (
    <GlobalDndProvider>
      <div
        ref={containerRef}
        className="w-full h-full flex flex-col overflow-hidden bg-background"
      >
        {/* Island 专用 Header */}
        <IslandHeader mode={IslandMode.SIDEBAR} onModeChange={onModeChange} />

        {/* 单栏面板内容 - 使用 Panel A 的位置 */}
        <div className="flex-1 min-h-0 overflow-hidden p-2">
          <PanelContent position="panelA" />
        </div>

        {/* 底部 Dock - 用于切换面板 */}
        <div className="shrink-0 flex justify-center px-2 pb-2">
          <BottomDock
            isInPanelMode={true}
            panelContainerRef={containerRef}
            visiblePanelCount={1}
          />
        </div>
      </div>
    </GlobalDndProvider>
  );
}
