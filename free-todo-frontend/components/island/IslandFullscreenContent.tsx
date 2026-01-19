"use client";

/**
 * Island 全屏内容组件
 * 在 FULLSCREEN 模式下显示完整的 FreeTodo 三栏面板布局
 * 直接使用 FreeTodo 原有的样式，保持一致性
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { IslandHeader } from "@/components/island/IslandHeader";
import { PanelRegion } from "@/components/layout/PanelRegion";
import { GlobalDndProvider } from "@/lib/dnd";
import { usePanelResize } from "@/lib/hooks/usePanelResize";
import { IslandMode } from "@/lib/island/types";
import { useUiStore } from "@/lib/store/ui-store";

interface IslandFullscreenContentProps {
  onModeChange: (mode: IslandMode) => void;
}

export function IslandFullscreenContent({ onModeChange }: IslandFullscreenContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 1920, height: 1080 });
  const [_mounted, setMounted] = useState(false);
  const [isDraggingPanelA, setIsDraggingPanelA] = useState(false);
  const [isDraggingPanelC, setIsDraggingPanelC] = useState(false);

  const {
    isPanelCOpen,
    panelCWidth,
    setPanelAWidth,
    setPanelCWidth,
  } = useUiStore();

  // 确保三栏全部打开
  useEffect(() => {
    const state = useUiStore.getState();
    const updates: Partial<typeof state> = {};
    if (!state.isPanelAOpen) updates.isPanelAOpen = true;
    if (!state.isPanelBOpen) updates.isPanelBOpen = true;
    if (!state.isPanelCOpen) updates.isPanelCOpen = true;
    if (Object.keys(updates).length > 0) {
      useUiStore.setState(updates);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 设置全局调整大小光标
  const setGlobalResizeCursor = useCallback((enabled: boolean) => {
    if (typeof document === "undefined") return;
    document.body.style.cursor = enabled ? "col-resize" : "";
    document.body.style.userSelect = enabled ? "none" : "";
  }, []);

  // 清理光标状态
  useEffect(() => {
    return () => setGlobalResizeCursor(false);
  }, [setGlobalResizeCursor]);

  // 使用 usePanelResize hook 进行面板拖拽调整
  const { handlePanelAResizePointerDown, handlePanelCResizePointerDown } = usePanelResize({
    containerRef,
    isPanelCOpen,
    panelCWidth,
    setPanelAWidth,
    setPanelCWidth,
    setIsDraggingPanelA,
    setIsDraggingPanelC,
    setGlobalResizeCursor,
  });

  // 监听窗口尺寸变化
  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  return (
    <GlobalDndProvider>
      <div
        ref={containerRef}
        className="w-full h-full flex flex-col overflow-hidden bg-background"
      >
        {/* Island 专用 Header */}
        <IslandHeader mode={IslandMode.FULLSCREEN} onModeChange={onModeChange} />

        {/* 面板区域 */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <PanelRegion
            width={dimensions.width}
            isMaximizeMode={true}
            isInPanelMode={false}
            isDraggingPanelA={isDraggingPanelA}
            isDraggingPanelC={isDraggingPanelC}
            isResizingPanel={false}
            onPanelAResizePointerDown={handlePanelAResizePointerDown}
            onPanelCResizePointerDown={handlePanelCResizePointerDown}
            containerRef={containerRef}
          />
        </div>
      </div>
    </GlobalDndProvider>
  );
}
