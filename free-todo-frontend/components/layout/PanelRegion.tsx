"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useWindowAdaptivePanels } from "@/lib/hooks/useWindowAdaptivePanels";
import { useUiStore } from "@/lib/store/ui-store";
import { cn } from "@/lib/utils";
import { BottomDock } from "./BottomDock";
import { PanelContainer } from "./PanelContainer";
import { PanelContent } from "./PanelContent";
import { ResizeHandle } from "./ResizeHandle";

interface PanelRegionProps {
	/** Panel 区域的宽度（用于计算显示多少个 Panel） */
	width: number;
	/** PanelRegion 的总高度（包括 Panels 容器 + BottomDock 60px），用于计算 Panels 容器固定高度 */
	height?: number;
	/** 是否在 FULLSCREEN 模式下（FULLSCREEN 模式下始终显示 3 个 panel，PANEL 模式下根据宽度显示） */
	isFullscreenMode?: boolean;
	/** 是否在 PANEL 模式下（用于 BottomDock 的显示逻辑） */
	isInPanelMode?: boolean;
	/** 是否正在拖拽 Panel A */
	isDraggingPanelA?: boolean;
	/** 是否正在拖拽 Panel C */
	isDraggingPanelC?: boolean;
	/** 是否正在调整 Panel 窗口大小 */
	isResizingPanel?: boolean;
	/** Panel A 调整宽度的回调 */
	onPanelAResizePointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
	/** Panel C 调整宽度的回调 */
	onPanelCResizePointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
	/** 容器引用（用于拖动计算） */
	containerRef?: React.RefObject<HTMLDivElement | null>;
}

/**
 * PanelRegion 组件：可复用的 Panel 区域
 * 包含 Panels 容器和 BottomDock
 * 用于 Panel 窗口和完整页面
 */
export function PanelRegion({
	width,
	height, // PanelRegion 总高度（包括 Panels 容器 + BottomDock 60px）
	isFullscreenMode = false, // FULLSCREEN 模式下始终显示 3 个 panel
	isInPanelMode = true, // PANEL 模式下 BottomDock 仅显示 panelA；FULLSCREEN 模式下显示 3 个
	isDraggingPanelA = false,
	isDraggingPanelC = false,
	isResizingPanel = false,
	onPanelAResizePointerDown,
	onPanelCResizePointerDown,
	containerRef: externalContainerRef,
}: PanelRegionProps) {
	const internalContainerRef = useRef<HTMLDivElement>(null);
	const containerRef = externalContainerRef || internalContainerRef;
	// BottomDock 容器 ref（用于鼠标位置检测）
	const bottomDockContainerRef = useRef<HTMLDivElement>(null);

	// 获取 panel 的打开状态和当前宽度配置
	const { isPanelAOpen, isPanelBOpen, isPanelCOpen, panelAWidth, panelCWidth } =
		useUiStore();

	// 使用 useWindowAdaptivePanels 进行自适应管理
	useWindowAdaptivePanels(containerRef);

	// 根据模式决定显示哪些 Panel
	// FULLSCREEN 模式下：始终显示 3 个 panel
	// PANEL 模式下：根据宽度动态显示，但底部高度固定
	const PANEL_DUAL_THRESHOLD = 800;
	const PANEL_TRIPLE_THRESHOLD = 1200;
	const shouldShowPanelB = isFullscreenMode || width >= PANEL_DUAL_THRESHOLD;
	const shouldShowPanelC = isFullscreenMode || width >= PANEL_TRIPLE_THRESHOLD;

	// 计算实际显示的 panel 数量（用于 BottomDock）
	const visiblePanelCount = useMemo(() => {
		if (isFullscreenMode) return 3; // FULLSCREEN 模式下始终显示 3 个
		if (shouldShowPanelC) return 3;
		if (shouldShowPanelB) return 2;
		return 1;
	}, [isFullscreenMode, shouldShowPanelB, shouldShowPanelC]);

	// 计算 layoutState：根据显示的 Panel 数量 + 当前 store 中的宽度配置分配宽度
	const layoutState = useMemo(() => {
		// 三栏：左(A) / 中(B) / 右(C)
		if (shouldShowPanelC) {
			// panelCWidth 是右侧占比，panelAWidth 是左侧在剩余宽度中的比例
			const baseWidth = 1 - panelCWidth;
			const safeBase = baseWidth > 0 ? baseWidth : 1;
			const clampedPanelA = Math.min(Math.max(panelAWidth, 0.1), 0.9);
			const a = safeBase * clampedPanelA;
			const c = panelCWidth;
			const b = Math.max(0, 1 - a - c);

			return {
				panelAWidth: a,
				panelBWidth: b,
				panelCWidth: c,
			};
		}

		// 双栏：A / B，panelAWidth 为左侧比例
		if (shouldShowPanelB) {
			const clampedPanelA = Math.min(Math.max(panelAWidth, 0.1), 0.9);
			return {
				panelAWidth: clampedPanelA,
				panelBWidth: 1 - clampedPanelA,
				panelCWidth: 0,
			};
		}

		// 单栏：A 占满
		return {
			panelAWidth: 1,
			panelBWidth: 0,
			panelCWidth: 0,
		};
	}, [shouldShowPanelB, shouldShowPanelC, panelAWidth, panelCWidth]);

	// 面板可见性：由 store 控制（在 FULLSCREEN 入口处会确保三者默认打开）
	const panelAVisible = isPanelAOpen;
	const panelBVisible = isPanelBOpen;
	const panelCVisible = isPanelCOpen;

	// ✅ 计算 Panels 容器的固定高度：PanelRegion 总高度 - BottomDock 高度(60px) - Dock 上方间距(6px)
	const panelsContainerHeight = useMemo(() => {
		if (height && height > 0) {
			return height - 60 - 8; // PanelRegion 高度 - BottomDock 60px - Dock 上方间距 6px
		}
		return undefined; // 如果没有提供 height，使用 flex-1 自适应（兼容完整页面模式）
	}, [height]);

	// ✅ 关键修复：使用 useLayoutEffect 持续确保底部容器高度固定，不受宽度变化影响
	useLayoutEffect(() => {
		const container = bottomDockContainerRef.current;
		if (!container) return;

		// 使用双重 requestAnimationFrame 确保在 React 应用 style 之后执行
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				if (container) {
					// 强制设置高度，使用 !important 确保优先级
					container.style.setProperty('height', '60px', 'important');
					container.style.setProperty('min-height', '60px', 'important');
					container.style.setProperty('max-height', '60px', 'important');
				}
			});
		});
	}, []); // 只在挂载时设置一次

	// ✅ 关键修复：使用 useLayoutEffect 持续确保 Panels 容器高度固定
	// biome-ignore lint/correctness/useExhaustiveDependencies: containerRef.current is stable and doesn't need to be in deps
	useLayoutEffect(() => {
		const panelsContainer = containerRef.current;
		if (!panelsContainer || !panelsContainerHeight) return;

		// 使用双重 requestAnimationFrame 确保在 React 应用 style 之后执行
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				if (panelsContainer && panelsContainerHeight) {
					// 强制设置高度，使用 !important 确保优先级
					panelsContainer.style.setProperty('height', `${panelsContainerHeight}px`, 'important');
					panelsContainer.style.setProperty('min-height', `${panelsContainerHeight}px`, 'important');
					panelsContainer.style.setProperty('max-height', `${panelsContainerHeight}px`, 'important');
				}
			});
		});
	}, [panelsContainerHeight]); // 只在高度变化时重新设置

	return (
		<div className="flex flex-col h-full w-full bg-primary-foreground dark:bg-accent" style={{ opacity: 1 }}>
			{/* Panels 容器：固定高度 = PanelRegion 总高度 - BottomDock 60px */}
			<div
				ref={containerRef}
				className={cn(
					"relative bg-primary-foreground dark:bg-accent flex min-h-0 overflow-hidden px-3",
					panelsContainerHeight ? "" : "flex-1" // 如果有固定高度，不使用 flex-1；否则使用 flex-1（兼容完整页面模式）
				)}
				style={{
					pointerEvents: "auto",
					opacity: 1,
					...(panelsContainerHeight
						? {
						height: `${panelsContainerHeight}px`,
						minHeight: `${panelsContainerHeight}px`,
						maxHeight: `${panelsContainerHeight}px`,
					  }
						: {})
				}}
			>
				{/* 根据窗口宽度显示对应数量的 Panel */}
				<PanelContainer
					key="panelA"
					position="panelA"
					isVisible={panelAVisible}
					width={
						shouldShowPanelC
							? layoutState.panelAWidth
							: shouldShowPanelB
								? layoutState.panelAWidth
								: 1
					}
					isDragging={isDraggingPanelA || isDraggingPanelC || isResizingPanel}
				>
					<PanelContent position="panelA" />
				</PanelContainer>

				{shouldShowPanelB && (
					<>
						<ResizeHandle
							key="panelA-resize-handle"
							onPointerDown={onPanelAResizePointerDown || (() => {})}
							isDragging={isDraggingPanelA}
							// 两个面板时也需要显示中间细线，所以这里始终可见
							isVisible={true}
						/>

						<PanelContainer
							key="panelB"
							position="panelB"
							isVisible={panelBVisible}
							width={
								shouldShowPanelC
									? layoutState.panelBWidth
									: 1 - layoutState.panelAWidth
							}
							isDragging={isDraggingPanelA || isDraggingPanelC || isResizingPanel}
						>
							<PanelContent position="panelB" />
						</PanelContainer>
					</>
				)}

				{shouldShowPanelC && (
					<>
						<ResizeHandle
							key="panelC-resize-handle"
							onPointerDown={onPanelCResizePointerDown || (() => {})}
							isDragging={isDraggingPanelC}
							isVisible={true}
						/>

						<PanelContainer
							key="panelC"
							position="panelC"
							isVisible={panelCVisible}
							width={layoutState.panelCWidth}
							isDragging={isDraggingPanelA || isDraggingPanelC || isResizingPanel}
						>
							<PanelContent position="panelC" />
						</PanelContainer>
					</>
				)}
			</div>

			{/* BottomDock：整条 60px 底部区域（Dock 与 Panels 之间留 6px 间距） */}
			{/* ✅ 保持单个 panel 时的逻辑：始终只显示 panelA 的 dock item，不受宽度变化影响 */}
			<div
				ref={(el) => {
					bottomDockContainerRef.current = el;
					// 仍然强制固定高度 60px，防止随内容抖动
					if (el) {
						requestAnimationFrame(() => {
							if (el) {
								el.style.setProperty("height", "60px", "important");
								el.style.setProperty("min-height", "60px", "important");
								el.style.setProperty("max-height", "60px", "important");
							}
						});
					}
				}}
				className="relative flex h-[60px] shrink-0 items-center justify-center bg-primary-foreground dark:bg-accent"
				style={{
					pointerEvents: "auto",
					marginTop: "6px", // ✅ Dock 到 Panel 内容区的间距（6px）
				}}
			>
				<BottomDock
					className={isInPanelMode ? "!relative !bottom-auto !left-auto !translate-x-0" : undefined}
					isInPanelMode={isInPanelMode}
					panelContainerRef={bottomDockContainerRef as React.RefObject<HTMLElement | null>}
					visiblePanelCount={visiblePanelCount}
				/>
			</div>
		</div>
	);
}
