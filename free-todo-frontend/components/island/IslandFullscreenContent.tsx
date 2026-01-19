"use client";

/**
 * Island 全屏内容组件
 * 在 FULLSCREEN 模式下显示完整的 FreeTodo 面板布局
 */

import { useRef } from "react";
import { PanelRegion } from "@/components/layout/PanelRegion";
import { GlobalDndProvider } from "@/lib/dnd";

export function IslandFullscreenContent() {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden island-fullscreen-theme"
    >
      <GlobalDndProvider>
        <PanelRegion
          width={typeof window !== "undefined" ? window.innerWidth : 1920}
          height={typeof window !== "undefined" ? window.innerHeight : 1080}
          isMaximizeMode={true}
          isInPanelMode={false}
          isDraggingPanelA={false}
          isDraggingPanelC={false}
          isResizingPanel={false}
          containerRef={containerRef}
        />
      </GlobalDndProvider>
    </div>
  );
}
