"use client";

import { ChevronsUpDown, Minimize2 } from "lucide-react";
import type React from "react";
import { IslandMode } from "./types";

interface FullscreenControlBarProps {
	onModeChange?: (mode: IslandMode) => void;
	onClose?: () => void;
}

export function FullscreenControlBar({
	onModeChange,
	onClose,
}: FullscreenControlBarProps) {
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
					WebkitAppRegion: "drag",
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
							console.log("[FullscreenControlBar] Exit fullscreen button clicked");
							try {
								const w = window as typeof window & {
									electronAPI?: {
										expandWindow?: () => Promise<void> | void;
										setIgnoreMouseEvents?: (
											ignore: boolean,
											options?: { forward?: boolean },
										) => void;
									};
								};
								if (w.electronAPI?.expandWindow) {
									await w.electronAPI.expandWindow();
								}
								w.electronAPI?.setIgnoreMouseEvents?.(false);
								onModeChange?.(IslandMode.PANEL);
							} catch (error) {
								console.error("[DynamicIsland] Failed to exit fullscreen:", error);
							}
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
							console.log("[FullscreenControlBar] Collapse button clicked");
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
								if (w.electronAPI?.collapseWindow) {
									await w.electronAPI.collapseWindow();
								}
								// When collapsing back to Dynamic Island, re-enable click-through to avoid blocking desktop
								w.electronAPI?.setIgnoreMouseEvents?.(true, {
									forward: true,
								});
							} finally {
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
