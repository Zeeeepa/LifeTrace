"use client";

import { ChevronsUpDown, Minimize2 } from "lucide-react";
import type React from "react";
import { IslandMode } from "./types";

interface MaximizeControlBarProps {
	onModeChange?: (mode: IslandMode) => void;
	onClose?: () => void;
}

export function MaximizeControlBar({
	onModeChange,
	onClose,
}: MaximizeControlBarProps) {
	return (
		<div
			className="fixed inset-x-0 top-0 z-[100010] pointer-events-none"
			style={{
				pointerEvents: "none",
				zIndex: 100010,
			} as React.CSSProperties}
		>
			<div
				className="flex items-center justify-end px-4 h-15"
				style={{
					WebkitAppRegion: "no-drag", // MAXIMIZE模式固定窗口，不允许拖动
					pointerEvents: "auto",
					zIndex: 100011,
					position: "relative",
				} as React.CSSProperties}
			>
				<div
					role="toolbar"
					className="flex items-center gap-1.5 rounded-xl bg-background/80 dark:bg-background/80 backdrop-blur-xl border border-[oklch(var(--border))]/40 shadow-sm px-2 py-1 text-[oklch(var(--foreground))]/60 pointer-events-auto mr-50"
					style={{
						WebkitAppRegion: "no-drag",
						zIndex: 100012,
						position: "relative",
					} as React.CSSProperties}
				>
					<button
						type="button"
						className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[oklch(var(--muted))]/40 hover:text-[oklch(var(--foreground))] transition-colors cursor-pointer relative z-[100013]"
						title="Exit fullscreen"
						onMouseDown={(e) => {
							// Stop propagation to prevent drag events
							e.stopPropagation();
						}}
						onClick={async (e) => {
							e.stopPropagation();
							console.log("[MaximizeControlBar] Exit maximize button clicked");
							// ✅ 关键改动：从 MAXIMIZE 退到 PANEL 时不再缩小 Electron 窗口，只切换前端模式
							// 这样灵动岛和左下角 N 徽章的屏幕绝对位置保持不变
							onModeChange?.(IslandMode.PANEL);
						}}
					>
						<Minimize2 size={15} />
					</button>
					<button
						type="button"
						className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[oklch(var(--muted))]/40 hover:text-[oklch(var(--foreground))] transition-colors cursor-pointer relative z-[100013]"
						title="Collapse to Dynamic Island"
						onMouseDown={(e) => {
							// Stop propagation to prevent drag events
							e.stopPropagation();
						}}
						onClick={async (e) => {
							e.stopPropagation();
							console.log("[MaximizeControlBar] Collapse button clicked");
							try {
								const w = window as typeof window & {
									electronAPI?: {
										collapseWindow?: () => Promise<void> | void;
										setIgnoreMouseEvents?: (
											ignore: boolean,
											options?: { forward?: boolean },
										) => void;
									};
								};
								// 关键修复：在窗口动画开始前，先切换前端状态到 FLOAT 模式
								onModeChange?.(IslandMode.FLOAT);
								onClose?.();

								// 等待一小段时间，确保前端状态切换完成
								await new Promise((resolve) => setTimeout(resolve, 50));

								if (w.electronAPI?.collapseWindow) {
									// 现在窗口动画时，前端已经是 FLOAT 模式
									await w.electronAPI.collapseWindow();
								}

								// ✅ 修复：移除这里的点击穿透设置，由 hook 统一管理
								// 只负责恢复透明度，确保窗口动画完全完成
								// 窗口动画时长是 800ms，加上透明度过渡 350ms，加上等待时间 400ms，总共约 1550ms
								// 我们等待 1600ms 确保所有动画完成，避免瞬闪
								setTimeout(() => {
									// 恢复透明度
									const style = document.createElement("style");
									style.id = "restore-opacity-maximize-collapse";
									style.textContent = `
										html, body, #__next, #__next > div {
											opacity: 1 !important;
											pointer-events: auto !important;
										}
									`;
									const oldStyle = document.getElementById("restore-opacity-maximize-collapse");
									if (oldStyle) oldStyle.remove();
									document.head.appendChild(style);
								}, 1600);
							} catch (error) {
								console.error("[MaximizeControlBar] 折叠失败:", error);
								// 即使失败也切换状态，避免卡住
								onModeChange?.(IslandMode.FLOAT);
								onClose?.();
							}
						}}
					>
						<ChevronsUpDown size={15} />
					</button>
				</div>
			</div>
		</div>
	);
}
