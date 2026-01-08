/**
 * 悬停逻辑 Hook
 */

import type React from "react";
import { useEffect, useState } from "react";
import { IslandMode } from "../types";

interface UseDynamicIslandHoverOptions {
	mode: IslandMode;
	islandRef: React.RefObject<HTMLDivElement | null>;
	isDragging: boolean;
	setIgnoreMouse: (ignore: boolean) => void;
}

export function useDynamicIslandHover({
	mode,
	islandRef,
	isDragging,
	setIgnoreMouse,
}: UseDynamicIslandHoverOptions) {
	const [isHovered, setIsHovered] = useState(false);

	// 全局鼠标移动监听器：检测鼠标是否在灵动岛区域内
	useEffect(() => {
		// 只在 FLOAT 模式下运行，PANEL 和 FULLSCREEN 模式都不需要
		if (
			mode === IslandMode.FULLSCREEN ||
			mode === IslandMode.PANEL ||
			typeof window === "undefined"
		)
			return;

		const handleGlobalMouseMove = (e: MouseEvent) => {
			if (!islandRef.current) return;

			const rect = islandRef.current.getBoundingClientRect();
			const { clientX, clientY } = e;

			// 检查鼠标是否在灵动岛区域内（包括一些容差，避免边缘抖动）
			const padding = 10; // 容差：10px
			const isInside =
				clientX >= rect.left - padding &&
				clientX <= rect.right + padding &&
				clientY >= rect.top - padding &&
				clientY <= rect.bottom + padding;

			if (isInside && !isHovered) {
				// 鼠标进入区域，展开
				setIsHovered(true);
				setIgnoreMouse(false); // 取消点击穿透，允许交互
				console.log(
					"[DynamicIsland] Mouse entered (global), click-through disabled",
				);
			} else if (!isInside && isHovered && !isDragging) {
				// 鼠标移出区域，折叠（如果不在拖拽中）
				setIsHovered(false);
				setIgnoreMouse(true); // 恢复点击穿透
				console.log(
					"[DynamicIsland] Mouse left (global), click-through enabled",
				);
			}
		};

		// 使用 requestAnimationFrame 优化性能
		let rafId: number | null = null;
		const throttledHandleMouseMove = (e: MouseEvent) => {
			if (rafId) return;
			rafId = requestAnimationFrame(() => {
				handleGlobalMouseMove(e);
				rafId = null;
			});
		};

		window.addEventListener("mousemove", throttledHandleMouseMove, {
			passive: true,
		});

		return () => {
			window.removeEventListener("mousemove", throttledHandleMouseMove);
			if (rafId) {
				cancelAnimationFrame(rafId);
			}
		};
	}, [mode, isHovered, isDragging, setIgnoreMouse, islandRef]);

	return { isHovered, setIsHovered };
}
