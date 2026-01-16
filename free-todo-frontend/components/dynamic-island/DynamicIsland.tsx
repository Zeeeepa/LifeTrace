"use client";

import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { useTodoCapture } from "@/lib/hooks/useTodoCapture";
import { useDynamicIslandStore } from "@/lib/store/dynamic-island-store";
import { useNotificationStore } from "@/lib/store/notification-store";
import { isElectronEnvironment } from "@/lib/utils/electron";
import { ContextMenu } from "./ContextMenu";
import { getElectronAPI } from "./electron-api";
import { FloatContent } from "./FloatContent";
import { useDynamicIslandClickThrough } from "./hooks/useDynamicIslandClickThrough";
import { useDynamicIslandDrag } from "./hooks/useDynamicIslandDrag";
import { useDynamicIslandHover } from "./hooks/useDynamicIslandHover";
import { useDynamicIslandLayout } from "./hooks/useDynamicIslandLayout";
import { IslandMode } from "./types";

interface DynamicIslandProps {
	mode: IslandMode;
	onModeChange?: (mode: IslandMode) => void;
	onClose?: () => void;
}

export function DynamicIsland({
	mode,
	onModeChange,
	onClose,
}: DynamicIslandProps) {
	// 录音状态（已移除音频模块，保留UI状态）
	const [isRecording] = useState(false);
	const [isPaused] = useState(false);

	// 拖拽状态（完全手动实现，支持任意位置放置，吸附到最近的边缘）
	// ✅ 修复：position 状态应该持久化，不受模式切换影响
	const [position, setPosition] = useState<{ x: number; y: number } | null>(
		null,
	);
	const islandRef = useRef<HTMLDivElement>(null);

	// ✅ 修复：监听模式切换，确保全局组件（灵动岛和N徽章）不受影响
	// 关键：position 是相对于屏幕的绝对位置，不应该受模式切换影响
	// 但是，我们需要确保在模式切换时，DOM 样式不会被意外修改
	// ✅ 修复：监听模式切换，确保全局组件（灵动岛和N徽章）不受影响
	// 关键：position 是相对于屏幕的绝对位置，不应该受模式切换影响
	// 但是，我们需要确保在模式切换时，DOM 样式不会被意外修改
	useEffect(() => {
		// 当模式切换时，确保灵动岛容器的样式不会被其他逻辑覆盖
		// 特别是从 MAXIMIZE 切换到 PANEL 时，useElectronClickThrough 可能会修改 DOM
		// 我们需要确保灵动岛容器的 fixed 定位和 z-index 不被影响
		const ensureContainerStyle = () => {
			if (islandRef.current) {
				const container = islandRef.current.parentElement;
				if (container) {
					// 强制设置所有关键样式，确保容器始终可见且在最上层
					container.style.setProperty('position', 'fixed', 'important');
					container.style.setProperty('z-index', '1000002', 'important');
					container.style.setProperty('pointer-events', 'none', 'important');
					container.style.setProperty('top', '0', 'important');
					container.style.setProperty('left', '0', 'important');
					container.style.setProperty('right', '0', 'important');
					container.style.setProperty('bottom', '0', 'important');
					container.style.setProperty('opacity', '1', 'important');
					container.style.setProperty('visibility', 'visible', 'important');
				}
			}
		};

		// 立即执行一次
		ensureContainerStyle();

		// 使用多个 requestAnimationFrame 确保在所有 DOM 操作之后执行
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				ensureContainerStyle();
			});
		});

		// 延迟执行，确保在 useElectronClickThrough 之后执行
		const timeoutId = setTimeout(() => {
			ensureContainerStyle();
		}, 100);

		return () => {
			clearTimeout(timeoutId);
		};
	}, []);

	// 右键菜单状态（仅 FLOAT 模式下使用）
	const [contextMenuOpen, setContextMenuOpen] = useState(false);
	const [contextMenuPosition, setContextMenuPosition] = useState<{
		x: number;
		y: number;
	}>({ x: 0, y: 0 });

	const { theme, systemTheme } = useTheme();
	const currentTheme = theme === "system" ? systemTheme : theme;
	const isDark = currentTheme === "dark";

	// 待办提取相关状态
	const { isCapturing, captureAndExtract } = useTodoCapture();

	// 获取通知和 Electron 环境状态
	const { currentNotification } = useNotificationStore();
	const isElectron = isElectronEnvironment();

	// 处理录音控制（已移除音频模块）
	const handleToggleRecording = useCallback(() => {
		console.log("[DynamicIsland] 麦克风按钮点击（功能已禁用）");
	}, []);

	// 处理停止录音（已移除音频模块）
	const handleStopRecording = useCallback(() => {
		console.log("[DynamicIsland] 停止录音按钮点击（功能已禁用）");
	}, []);

	// ✅ 修复：灵动岛和左下角N是全局的，不受模式切换影响
	// 始终使用 FLOAT 模式的布局逻辑，确保在所有模式下保持一致的外观和行为
	const layoutMode = IslandMode.FLOAT;

	// 使用 hooks 管理各种逻辑
	// ✅ 修复：点击穿透逻辑仍然需要根据实际模式来决定，但布局始终使用 FLOAT
	const setIgnoreMouse = useDynamicIslandClickThrough(mode);
	const { isHovered, setIsHovered } = useDynamicIslandHover({
		mode: layoutMode,
		islandRef,
		isDragging: false, // 将在拖拽 hook 中设置
		setIgnoreMouse,
	});
	const { calculateSnapPosition, getLayoutState } = useDynamicIslandLayout({
		mode: layoutMode,
		position,
		isHovered,
	});
	const { isDragging, isDragEnding, handleMouseDown } = useDynamicIslandDrag({
		mode: layoutMode,
		islandRef,
		setIgnoreMouse,
		calculateSnapPosition,
		setPosition,
		setIsHovered,
	});

	// 监听模式变化，确保在切换到FLOAT模式后恢复opacity
	useEffect(() => {
		if (mode === IslandMode.FLOAT) {
			// 恢复opacity，移除Electron主进程设置的opacity: 0
			// 使用!important覆盖Electron设置的样式
			const style = document.createElement("style");
			style.id = "restore-opacity-float-mode";
			style.textContent = `
				html {
					opacity: 1 !important;
				}
				body {
					opacity: 1 !important;
				}
				#__next {
					opacity: 1 !important;
				}
				#__next > div {
					opacity: 1 !important;
				}
			`;
			// 移除旧的样式（如果存在）
			const oldStyle = document.getElementById("restore-opacity-float-mode");
			if (oldStyle) {
				oldStyle.remove();
			}
			document.head.appendChild(style);
		}
	}, [mode]);

	useEffect(() => {
		const handleKeyDown = async (e: KeyboardEvent) => {
			if (e.key === "1") {
				onModeChange?.(IslandMode.FLOAT);
				const api = getElectronAPI();
				api.electronAPI?.setIgnoreMouseEvents?.(true, { forward: true });
			} else if (e.key === "4") {
				onModeChange?.(IslandMode.PANEL);
			} else if (e.key === "5") {
					onModeChange?.(IslandMode.MAXIMIZE);
			} else if (e.key === "Escape") {
				if (mode === IslandMode.MAXIMIZE) {
					// MAXIMIZE 模式：先恢复窗口状态，再切换模式
					const api = getElectronAPI();
					if (api.electronAPI?.collapseWindow) {
						await api.electronAPI.collapseWindow();
					}
					onModeChange?.(IslandMode.FLOAT);
					onClose?.();
				} else if (mode === IslandMode.PANEL) {
					// PANEL 模式：先恢复窗口状态，再切换模式
					const api = getElectronAPI();
					if (api.electronAPI?.collapseWindow) {
						await api.electronAPI.collapseWindow();
					}
					onModeChange?.(IslandMode.FLOAT);
					onClose?.();
				}
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [mode, onClose, onModeChange]);


	// 处理截图并提取待办（直接创建，不显示模态框）
	const handleCaptureAndExtract = useCallback(async () => {
		await captureAndExtract();
		// 待办已由后端直接创建为 draft 状态，前端只需显示成功消息
	}, [captureAndExtract]);

	const handleOpenContextMenu = useCallback(
		(event: React.MouseEvent) => {
			if (mode !== IslandMode.FLOAT) return;
			event.preventDefault();
			setContextMenuPosition({ x: event.clientX, y: event.clientY - 8 });
			setContextMenuOpen(true);
		},
		[mode],
	);

	const handleCloseContextMenu = useCallback(() => {
		setContextMenuOpen(false);
	}, []);


	const { panelVisible, showPanel } = useDynamicIslandStore();
	const layoutState = getLayoutState();
	const isMaximize = mode === IslandMode.MAXIMIZE;
	const shouldShowPanelOverlay = panelVisible || mode === IslandMode.PANEL;

	// 注意：点击穿透设置已移到 app/page.tsx 统一管理，这里不再设置
	// 避免双重点击穿透设置冲突

	// 防御：确保在展示 Panel/最大化时恢复任何被主进程注入的透明/禁用样式
	useEffect(() => {
		if (!shouldShowPanelOverlay && !isMaximize) return;
		const restore = () => {
			const ids = [
				"restore-opacity-after-collapse",
				"restore-opacity-keyboard",
				"restore-opacity-escape",
			];
			ids.forEach((id) => {
				const el = document.getElementById(id);
				if (el) el.remove();
			});
			const html = document.documentElement;
			const body = document.body;
			const next = document.getElementById("__next");
			const set = (node?: HTMLElement | null) => {
				if (!node) return;
				node.style.opacity = "1";
				node.style.pointerEvents = "auto";
			};
			set(html);
			set(body);
			set(next as HTMLElement | null);
		};
		restore();
	}, [isMaximize, shouldShowPanelOverlay]);

	return (
	<>
		{/* Panel 右侧窗口覆盖层（完全独立于灵动岛，单独渲染） */}
		{/* 在使用现有页面布局模式下不再单独渲染 Panel 浮层 */}

		{/* 最大化控制栏（完全独立） - 现在使用 AppHeader */}
		{isMaximize ? (
			<div className="fixed inset-x-0 top-0 z-[32] pointer-events-auto bg-primary-foreground dark:bg-accent">
				<AppHeader
					mode={IslandMode.MAXIMIZE}
					onModeChange={onModeChange}
					onClose={onClose}
					isPanelMode={false}
					currentNotification={currentNotification}
					isElectron={isElectron}
				/>
			</div>
		) : null}

		{/* 灵动岛（完全独立，永远渲染，不受 Panel 影响） */}
		{/* ✅ 修复：z-index 必须比 PanelWindow (1000001) 更高，确保始终在最上层 */}
		{/* ✅ 修复：使用 ref 回调强制设置样式，防止被其他逻辑覆盖 */}
		<div
			ref={(el) => {
				// ✅ 关键修复：使用 ref 回调强制设置样式，确保容器始终可见且在最上层
				if (el) {
					requestAnimationFrame(() => {
						if (el) {
							el.style.setProperty('position', 'fixed', 'important');
							el.style.setProperty('z-index', '1000002', 'important');
							el.style.setProperty('pointer-events', 'none', 'important');
							el.style.setProperty('top', '0', 'important');
							el.style.setProperty('left', '0', 'important');
							el.style.setProperty('right', '0', 'important');
							el.style.setProperty('bottom', '0', 'important');
							el.style.setProperty('opacity', '1', 'important');
							el.style.setProperty('visibility', 'visible', 'important');
						}
					});
				}
			}}
			className="fixed inset-0 pointer-events-none"
			suppressHydrationWarning
			style={{
				position: 'fixed',
				zIndex: 1000002, // ✅ 修复：使用比 PanelWindow (1000001) 更高的 z-index，确保始终置顶
				pointerEvents: 'none',
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				opacity: 1,
				visibility: 'visible',
			} as React.CSSProperties}
		>
			<motion.div
				ref={islandRef}
				layout
				initial={false}
				animate={layoutState}
				onMouseEnter={() => {
					// 所有模式都允许 hover 展开/收起
					setIsHovered(true);
					// ✅ 修复：点击穿透逻辑仍然需要根据实际模式来决定
					if (mode === IslandMode.FLOAT) {
						setIgnoreMouse(false); // 取消点击穿透，允许交互
					}
				}}
				onMouseLeave={() => {
					// 如果正在拖拽，不要恢复点击穿透，否则会中断拖拽
					if (isDragging) {
						return;
					}
					// 所有模式都收起
					setIsHovered(false);
					// ✅ 修复：点击穿透逻辑仍然需要根据实际模式来决定
					if (mode === IslandMode.FLOAT) {
						setIgnoreMouse(true); // 恢复点击穿透
					}
				}}
				onMouseDown={handleMouseDown}
				onContextMenu={handleOpenContextMenu}
				transition={
					// 拖拽时或拖拽刚结束时禁用动画，直接设置位置；非拖拽时使用平滑动画
					isDragging || isDragEnding
						? { duration: 0 }
						: {
								type: "spring",
								stiffness: 350,
								damping: 30,
								mass: 0.8,
								restDelta: 0.001,
							}
				}
				className="absolute cursor-grab active:cursor-grabbing overflow-hidden pointer-events-auto"
				style={
					{
						boxShadow: isDark
							? "0px 20px 50px -10px rgba(0, 0, 0, 0.5), 0px 10px 20px -10px rgba(0,0,0,0.3)"
							: "0px 20px 50px -10px rgba(0, 0, 0, 0.15), 0px 10px 20px -10px rgba(0,0,0,0.1)",
						borderRadius: layoutState.borderRadius ? `${layoutState.borderRadius}px` : undefined,
						userSelect: "none",
						backgroundColor: isDark ? "#0a0a0a" : "oklch(var(--primary-foreground))",
					} as React.CSSProperties
				}
			>
				{/* 背景 */}
				<div
					className="absolute inset-0 backdrop-blur-[80px] transition-colors duration-700 ease-out"
					style={{
						backgroundColor: isDark
							? "rgba(8, 8, 8, 0.9)"
							: "oklch(var(--primary-foreground))",
					}}
				></div>
				<div
					className={`absolute inset-0 transition-opacity duration-1000 ${isMaximize ? "opacity-100" : "opacity-0"}`}
				>
					{isDark ? (
						<>
							<div className="absolute top-[-50%] left-[-20%] w-[100%] h-[100%] rounded-full bg-indigo-500/10 blur-[120px] mix-blend-screen"></div>
							<div className="absolute bottom-[-20%] right-[-20%] w-[80%] h-[80%] rounded-full bg-purple-500/10 blur-[120px] mix-blend-screen"></div>
						</>
					) : null}
				</div>
				<div
					className="absolute inset-0 rounded-[inherit] pointer-events-none transition-opacity duration-500"
					style={{
						border: `1px solid ${isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.08)"}`,
						boxShadow: isDark
							? "inset 0 0 20px rgba(255,255,255,0.03)"
							: "inset 0 0 20px rgba(0,0,0,0.02)",
					}}
				></div>

				{/* 内容区域 */}
				{/* biome-ignore lint/a11y/noStaticElementInteractions: onContextMenu is not a true interaction, it's for custom context menu */}
				<div
					className={`absolute inset-0 w-full h-full font-sans antialiased overflow-hidden ${isDark ? "text-white" : "text-[oklch(var(--foreground))]"}`}
					// 右键打开自定义菜单，屏蔽浏览器/系统默认菜单（包括"退出应用"等文字）
					onContextMenu={handleOpenContextMenu}
				>
					{/* MAXIMIZE 也保持灵动岛内容可见，行为与 FLOAT/PANEL 一致 */}
					<motion.div
						key="float"
						className="absolute inset-0 w-full h-full pointer-events-none"
						onMouseEnter={() => {
							// 所有模式都允许根据 hover 展开/收起
							setIsHovered(true);
							// ✅ 修复：点击穿透逻辑仍然需要根据实际模式来决定
							if (mode === IslandMode.FLOAT) {
								setIgnoreMouse(false);
							}
						}}
						onMouseLeave={() => {
							if (isDragging) {
								return;
							}
							// hover 离开时统一收起
							setIsHovered(false);
							// ✅ 修复：点击穿透逻辑仍然需要根据实际模式来决定
							if (mode === IslandMode.FLOAT) {
								setIgnoreMouse(true);
							}
						}}
					>
						<div
							className="w-full h-full pointer-events-auto"
							role="group"
							onMouseDown={(e) => {
								// 如果点击的是按钮，阻止拖拽和事件冒泡
								const target = e.target as HTMLElement;
								if (
									target.closest(
										'button, a, input, select, textarea, [role="button"]',
									)
								) {
									e.stopPropagation();
									return;
								}
								// 如果不是按钮，让事件继续冒泡到外层的 handleMouseDown
								// 不要阻止默认行为，让拖拽可以正常工作
							}}
						>
								<FloatContent
								onToggleRecording={handleToggleRecording}
								onStopRecording={handleStopRecording}
								onScreenshot={handleCaptureAndExtract}
								screenshotEnabled={!isCapturing}
								isCapturing={isCapturing}
								// 所有模式都根据 isHovered 决定展开/收起
								isCollapsed={!isHovered}
								isRecording={isRecording}
								isPaused={isPaused}
								onOpenPanel={() => {
									// 直接开启 Panel 显示，并显式切换模式为 PANEL，不改变灵动岛外观
									// 点击穿透设置由 app/page.tsx 统一管理
									showPanel();
									onModeChange?.(IslandMode.PANEL);
								}}
							/>
						</div>
					</motion.div>
				</div>
			</motion.div>

			<ContextMenu
				open={contextMenuOpen}
				position={contextMenuPosition}
				onClose={handleCloseContextMenu}
				onQuit={() => {
					const api = getElectronAPI();
					api.electronAPI?.quit?.();
				}}
			/>
		</div>
	</>
);
}
