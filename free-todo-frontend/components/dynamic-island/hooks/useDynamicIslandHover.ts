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

// 全局变量：跟踪最后已知的鼠标位置（用于模式切换时立即检测）
let lastKnownMousePosition: { x: number; y: number } | null = null;

export function useDynamicIslandHover({
	mode,
	islandRef,
	isDragging,
	setIgnoreMouse,
}: UseDynamicIslandHoverOptions) {
	const [isHovered, setIsHovered] = useState(false);

	// 全局鼠标移动监听器：检测鼠标是否在灵动岛区域内
	useEffect(() => {
		// 只在 FLOAT 模式下运行，PANEL 和 MAXIMIZE 模式都不需要
		if (
			mode === IslandMode.MAXIMIZE ||
			mode === IslandMode.PANEL ||
			typeof window === "undefined"
		)
			return;

		const checkMousePosition = (clientX: number, clientY: number) => {
			if (!islandRef.current) return false;

			const rect = islandRef.current.getBoundingClientRect();
			// 检查鼠标是否在灵动岛区域内（包括一些容差，避免边缘抖动）
			const padding = 10; // 容差：10px
			return (
				clientX >= rect.left - padding &&
				clientX <= rect.right + padding &&
				clientY >= rect.top - padding &&
				clientY <= rect.bottom + padding
			);
		};

		const handleMousePositionUpdate = (clientX: number, clientY: number) => {
			// 更新最后已知的鼠标位置
			lastKnownMousePosition = { x: clientX, y: clientY };

			if (!islandRef.current) return;

			const isInside = checkMousePosition(clientX, clientY);

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

		// ✅ 修复：模式切换到FLOAT时，检查最后已知的鼠标位置
		// 如果鼠标已经在灵动岛区域内，立即禁用点击穿透
		if (lastKnownMousePosition && islandRef.current) {
			const isInside = checkMousePosition(
				lastKnownMousePosition.x,
				lastKnownMousePosition.y,
			);
			if (isInside) {
				setIsHovered(true);
				setIgnoreMouse(false);
			}
		}

		const handleGlobalMouseMove = (e: MouseEvent) => {
			handleMousePositionUpdate(e.clientX, e.clientY);
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

		// 同时监听 pointermove 和 mousemove，确保即使鼠标不动也能检测到位置
		// pointermove 在某些情况下比 mousemove 更可靠
		window.addEventListener("pointermove", handleGlobalMouseMove, {
			passive: true,
		});
		window.addEventListener("mousemove", throttledHandleMouseMove, {
			passive: true,
		});

		return () => {
			window.removeEventListener("pointermove", handleGlobalMouseMove);
			window.removeEventListener("mousemove", throttledHandleMouseMove);
			if (rafId) {
				cancelAnimationFrame(rafId);
			}
		};
	}, [mode, isHovered, isDragging, setIgnoreMouse, islandRef]);

	return { isHovered, setIsHovered };
}
