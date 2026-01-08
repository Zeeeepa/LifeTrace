/**
 * 布局计算 Hook
 */

import { useCallback } from "react";
import { IslandMode } from "../types";

interface UseDynamicIslandLayoutOptions {
	mode: IslandMode;
	position: { x: number; y: number } | null;
	isHovered: boolean;
}

export function useDynamicIslandLayout({
	mode,
	position,
	isHovered,
}: UseDynamicIslandLayoutOptions) {
	const calculateSnapPosition = useCallback(
		(x: number, y: number): { x: number; y: number } => {
			if (typeof window === "undefined") {
				return { x, y };
			}

			const windowWidth = window.innerWidth;
			const windowHeight = window.innerHeight;
			const islandWidth = 150; // 更新为新的宽度
			const islandHeight = 48;
			const margin = 32;
			const snapThreshold = 50; // 吸附阈值：50px

			let snapX = x;
			let snapY = y;

			// 检查是否靠近左边缘
			if (x <= margin + snapThreshold) {
				snapX = margin;
			}
			// 检查是否靠近右边缘
			else if (x >= windowWidth - islandWidth - margin - snapThreshold) {
				snapX = windowWidth - islandWidth - margin;
			}

			// 检查是否靠近上边缘
			if (y <= margin + snapThreshold) {
				snapY = margin;
			}
			// 检查是否靠近下边缘
			else if (y >= windowHeight - islandHeight - margin - snapThreshold) {
				snapY = windowHeight - islandHeight - margin;
			}

			// 限制在屏幕范围内
			snapX = Math.max(
				margin,
				Math.min(snapX, windowWidth - islandWidth - margin),
			);
			snapY = Math.max(
				margin,
				Math.min(snapY, windowHeight - islandHeight - margin),
			);

			return { x: snapX, y: snapY };
		},
		[],
	);

	const getLayoutState = useCallback(() => {
		const margin = 40;

		switch (mode) {
			case IslandMode.FLOAT: {
				// 默认收起状态：只显示小图标（32x32）
				// 鼠标悬停时展开：显示完整内容（180x48）
				const collapsedLayout = {
					width: 36,
					height: 36,
					borderRadius: 18,
				};
				const expandedLayout = {
					// 三个图标并列，留点间距：18*3 + 16*2(gap) + 32*2(padding) = 54 + 32 + 64 = 150
					width: 135,
					height: 48,
					borderRadius: 24,
				};

				const baseLayout = isHovered ? expandedLayout : collapsedLayout;

				if (position) {
					return {
						...baseLayout,
						left: position.x,
						top: position.y,
						right: "auto",
						bottom: "auto",
					};
				} else {
					// 默认位置：右下角
					return {
						...baseLayout,
						right: margin,
						bottom: margin,
						left: "auto",
						top: "auto",
					};
				}
			}
			case IslandMode.PANEL:
				// Panel模式：窗口化显示，由Electron控制大小和位置
				// 添加圆角（增大到16px，更明显）
				return {
					width: "100%",
					height: "100%",
					borderRadius: 16,
					right: 0,
					bottom: 0,
					left: 0,
					top: 0,
				};
			case IslandMode.FULLSCREEN:
				return {
					width: "100vw",
					height: "100vh",
					borderRadius: 16, // 全屏模式也添加圆角
					right: 0,
					bottom: 0,
					left: 0,
					top: 0,
				};
			default:
				return {
					width: 180,
					height: 48,
					borderRadius: 24,
					right: margin,
					bottom: margin,
					left: "auto",
					top: "auto",
				};
		}
	}, [mode, position, isHovered]);

	return { calculateSnapPosition, getLayoutState };
}
