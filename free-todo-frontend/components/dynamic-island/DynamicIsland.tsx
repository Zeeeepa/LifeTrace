"use client";

import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { useConfig, useSaveConfig } from "@/lib/query";
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
	const [position, setPosition] = useState<{ x: number; y: number } | null>(
		null,
	);
	const islandRef = useRef<HTMLDivElement>(null);

	// 右键菜单状态（仅 FLOAT 模式下使用）
	const [contextMenuOpen, setContextMenuOpen] = useState(false);
	const [contextMenuPosition, setContextMenuPosition] = useState<{
		x: number;
		y: number;
	}>({ x: 0, y: 0 });

	const { theme, systemTheme } = useTheme();
	const currentTheme = theme === "system" ? systemTheme : theme;
	const isDark = currentTheme === "dark";

	const { data: config } = useConfig();
	const saveConfigMutation = useSaveConfig();
	const recorderEnabled = config?.jobsRecorderEnabled ?? false;

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

	// Panel 模式下灵动岛保持浮动外观
	const layoutMode = mode === IslandMode.PANEL ? IslandMode.FLOAT : mode;

	// 使用 hooks 管理各种逻辑
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
				onModeChange?.(IslandMode.FULLSCREEN);
			} else if (e.key === "Escape") {
				if (mode === IslandMode.FULLSCREEN) {
					// FULLSCREEN 模式：先恢复窗口状态，再切换模式
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


	const handleToggleScreenshot = useCallback(async () => {
		try {
			await saveConfigMutation.mutateAsync({
				data: { jobsRecorderEnabled: !recorderEnabled },
			});
		} catch (error) {
			console.error("[DynamicIsland] toggle screenshot failed", error);
		}
	}, [recorderEnabled, saveConfigMutation]);

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
	const isFullscreen = mode === IslandMode.FULLSCREEN;
	const shouldShowPanelOverlay = panelVisible || mode === IslandMode.PANEL;

	// 注意：点击穿透设置已移到 app/page.tsx 统一管理，这里不再设置
	// 避免双重点击穿透设置冲突

	// 防御：确保在展示 Panel/全屏时恢复任何被主进程注入的透明/禁用样式
	useEffect(() => {
		if (!shouldShowPanelOverlay && !isFullscreen) return;
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
	}, [isFullscreen, shouldShowPanelOverlay]);

	return (
	<>
		{/* Panel 右侧窗口覆盖层（完全独立于灵动岛，单独渲染） */}
		{/* 在使用现有页面布局模式下不再单独渲染 Panel 浮层 */}

		{/* 全屏控制栏（完全独立） - 现在使用 AppHeader */}
		{isFullscreen ? (
			<div className="fixed inset-x-0 top-0 z-[32] pointer-events-auto bg-primary-foreground dark:bg-accent">
				<AppHeader
					mode={IslandMode.FULLSCREEN}
					onModeChange={onModeChange}
					onClose={onClose}
					isPanelMode={false}
					currentNotification={currentNotification}
					isElectron={isElectron}
				/>
			</div>
		) : null}

		{/* 灵动岛（完全独立，永远渲染，不受 Panel 影响） */}
		<div
			className="fixed inset-0 pointer-events-none"
			suppressHydrationWarning
			style={{
				zIndex: 999999, // 使用非常高的 z-index 确保始终置顶，但不影响页面交互（因为 pointer-events-none）
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
					// 只有 FLOAT 模式需要切换点击穿透
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
					// 只有 FLOAT 模式需要恢复点击穿透
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
					className={`absolute inset-0 transition-opacity duration-1000 ${isFullscreen ? "opacity-100" : "opacity-0"}`}
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
					{/* FULLSCREEN 也保持灵动岛内容可见，行为与 FLOAT/PANEL 一致 */}
					<motion.div
						key="float"
						className="absolute inset-0 w-full h-full pointer-events-none"
						onMouseEnter={() => {
							// 所有模式都允许根据 hover 展开/收起
							setIsHovered(true);
							// 只有 FLOAT 模式需要切换点击穿透
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
							// 只有 FLOAT 模式需要恢复点击穿透
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
								onScreenshot={handleToggleScreenshot}
								screenshotEnabled={recorderEnabled}
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
