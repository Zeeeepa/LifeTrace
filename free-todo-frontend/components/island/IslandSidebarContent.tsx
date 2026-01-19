"use client";

/**
 * Island 侧边栏内容组件
 * 在 SIDEBAR 模式下支持单栏/双栏/三栏展开
 * 直接使用 FreeTodo 原有的样式，保持一致性
 */

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { IslandHeader } from "@/components/island/IslandHeader";
import { BottomDock } from "@/components/layout/BottomDock";
import { PanelContainer } from "@/components/layout/PanelContainer";
import { PanelContent } from "@/components/layout/PanelContent";
import { ResizeHandle } from "@/components/layout/ResizeHandle";
import { GlobalDndProvider } from "@/lib/dnd";
import { usePanelResize } from "@/lib/hooks/usePanelResize";
import { IslandMode } from "@/lib/island/types";
import { type DockDisplayMode, useUiStore } from "@/lib/store/ui-store";

interface IslandSidebarContentProps {
  onModeChange: (mode: IslandMode) => void;
}

export function IslandSidebarContent({ onModeChange }: IslandSidebarContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [columnCount, setColumnCount] = useState<1 | 2 | 3>(1);
  const [isDraggingPanelA, setIsDraggingPanelA] = useState(false);
  const [isDraggingPanelC, setIsDraggingPanelC] = useState(false);

  const {
    isPanelAOpen,
    isPanelBOpen,
    isPanelCOpen,
    panelAWidth,
    panelCWidth,
    setPanelAWidth,
    setPanelCWidth,
    dockDisplayMode,
    setDockDisplayMode,
  } = useUiStore();

  const previousDockModeRef = useRef<DockDisplayMode | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // SIDEBAR 默认是单栏，并在进入时同步窗口尺寸
  useEffect(() => {
    if (!mounted) return;
    setColumnCount(1);
    if (typeof window !== "undefined" && window.electronAPI?.islandResizeSidebar) {
      window.electronAPI.islandResizeSidebar(1);
    }
  }, [mounted]);

  useEffect(() => {
    // Save current dock mode only on first mount (when ref is null)
    if (previousDockModeRef.current === null) {
      previousDockModeRef.current = dockDisplayMode;
    }
    // Force dock to be always visible in Island sidebar mode
    setDockDisplayMode("fixed");

    // Restore previous dock mode on unmount
    return () => {
      if (previousDockModeRef.current !== null) {
        setDockDisplayMode(previousDockModeRef.current);
      }
    };
  }, [dockDisplayMode, setDockDisplayMode]);

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
    isPanelCOpen: columnCount === 3 && isPanelCOpen,
    panelCWidth,
    setPanelAWidth,
    setPanelCWidth,
    setIsDraggingPanelA,
    setIsDraggingPanelC,
    setGlobalResizeCursor,
  });

  const resizeSidebarWindow = useCallback((count: 1 | 2 | 3) => {
    if (typeof window !== "undefined" && window.electronAPI?.islandResizeSidebar) {
      window.electronAPI.islandResizeSidebar(count);
    }
  }, []);

  // 展开栏数处理
  const handleExpand = useCallback(() => {
    if (columnCount < 3) {
      const newCount = (columnCount + 1) as 2 | 3;
      setColumnCount(newCount);

      // 打开新增的 panel（保证“展开”后一定能看到新栏）
      if (newCount === 2) {
        useUiStore.setState({ isPanelBOpen: true });
      } else if (newCount === 3) {
        useUiStore.setState({ isPanelBOpen: true, isPanelCOpen: true });
      }

      // 通知 Electron 调整窗口尺寸
      resizeSidebarWindow(newCount);
    }
  }, [columnCount, resizeSidebarWindow]);

  // 收起栏数处理
  const handleCollapse = useCallback(() => {
    if (columnCount > 1) {
      const newCount = (columnCount - 1) as 1 | 2;
      setColumnCount(newCount);

      // 收起时关闭被移除的 panel，避免“栏数减少但开关状态还在”造成困惑
      if (newCount === 1) {
        useUiStore.setState({ isPanelBOpen: false, isPanelCOpen: false });
      } else if (newCount === 2) {
        useUiStore.setState({ isPanelCOpen: false });
      }

      // 通知 Electron 调整窗口尺寸
      resizeSidebarWindow(newCount);
    }
  }, [columnCount, resizeSidebarWindow]);

  // 计算面板宽度布局
  const layoutState = useCallback(() => {
    const clampedPanelA = Math.min(Math.max(panelAWidth, 0.1), 0.9);

    if (columnCount === 3) {
      // 三栏布局
      const baseWidth = 1 - panelCWidth;
      const safeBase = baseWidth > 0 ? baseWidth : 1;
      const a = safeBase * clampedPanelA;
      const c = panelCWidth;
      const b = Math.max(0, 1 - a - c);

      return {
        panelAWidth: a,
        panelBWidth: b,
        panelCWidth: c,
      };
    }

    if (columnCount === 2) {
      // 双栏布局 (A + B)
      return {
        panelAWidth: clampedPanelA,
        panelBWidth: 1 - clampedPanelA,
        panelCWidth: 0,
      };
    }

    // 单栏布局 (只有 A)
    return {
      panelAWidth: 1,
      panelBWidth: 0,
      panelCWidth: 0,
    };
  }, [columnCount, panelAWidth, panelCWidth]);

  const layout = layoutState();

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
      <div className="w-full h-full flex flex-col overflow-hidden bg-background">
        {/* Island 专用 Header */}
        <IslandHeader mode={IslandMode.SIDEBAR} onModeChange={onModeChange} />

        {/* 面板区域 */}
        <div
          ref={containerRef}
          className="flex-1 min-h-0 overflow-hidden relative bg-primary-foreground dark:bg-accent flex px-3"
        >
          {/* 左侧收起按钮（点击区域在面板两侧，避免 dock 内部塞按钮） */}
          {columnCount > 1 && (
            <button
              type="button"
              onClick={handleCollapse}
              className="absolute left-1 top-1/2 -translate-y-1/2 z-50 pointer-events-auto
                         h-20 w-8 rounded-xl
                         bg-[oklch(var(--card))]/70 dark:bg-background/70
                         backdrop-blur-md border border-[oklch(var(--border))]
                         shadow-lg
                         text-[oklch(var(--muted-foreground))] hover:text-[oklch(var(--foreground))]
                         hover:bg-[oklch(var(--card))]/90
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[oklch(var(--ring))] focus-visible:ring-offset-2"
              aria-label="收起栏"
              title="收起"
            >
              <ChevronLeft className="mx-auto h-5 w-5" />
            </button>
          )}

          {/* Panel A - 始终显示 */}
          <PanelContainer
            position="panelA"
            isVisible={isPanelAOpen}
            width={layout.panelAWidth}
            isDragging={isDraggingPanelA || isDraggingPanelC}
            className="mx-1"
          >
            <PanelContent position="panelA" />
          </PanelContainer>

          {/* Panel B - 双栏和三栏时显示 */}
          {columnCount >= 2 && (
            <>
              <ResizeHandle
                onPointerDown={handlePanelAResizePointerDown}
                isDragging={isDraggingPanelA}
                isVisible={isPanelBOpen}
              />

              <PanelContainer
                position="panelB"
                isVisible={isPanelBOpen}
                width={layout.panelBWidth}
                isDragging={isDraggingPanelA || isDraggingPanelC}
                className="mx-1"
              >
                <PanelContent position="panelB" />
              </PanelContainer>
            </>
          )}

          {/* Panel C - 三栏时显示 */}
          {columnCount === 3 && (
            <>
              <ResizeHandle
                onPointerDown={handlePanelCResizePointerDown}
                isDragging={isDraggingPanelC}
                isVisible={isPanelCOpen}
              />

              <PanelContainer
                position="panelC"
                isVisible={isPanelCOpen}
                width={layout.panelCWidth}
                isDragging={isDraggingPanelA || isDraggingPanelC}
                className="mx-1"
              >
                <PanelContent position="panelC" />
              </PanelContainer>
            </>
          )}

          {/* 右侧展开按钮（点击区域在面板两侧，避免 dock 内部塞按钮） */}
          {columnCount < 3 && (
            <button
              type="button"
              onClick={handleExpand}
              className="absolute right-1 top-1/2 -translate-y-1/2 z-50 pointer-events-auto
                         h-20 w-8 rounded-xl
                         bg-[oklch(var(--card))]/70 dark:bg-background/70
                         backdrop-blur-md border border-[oklch(var(--border))]
                         shadow-lg
                         text-[oklch(var(--muted-foreground))] hover:text-[oklch(var(--foreground))]
                         hover:bg-[oklch(var(--card))]/90
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[oklch(var(--ring))] focus-visible:ring-offset-2"
              aria-label="展开栏"
              title="展开"
            >
              <ChevronRight className="mx-auto h-5 w-5" />
            </button>
          )}
        </div>

        {/* 底部 Dock - 用于切换面板和展开/收起栏数 */}
        <div className="shrink-0 flex justify-center px-2 pb-2">
          <BottomDock
            isInPanelMode={true}
            panelContainerRef={containerRef}
            visiblePanelCount={columnCount}
          />
        </div>
      </div>
    </GlobalDndProvider>
  );
}
