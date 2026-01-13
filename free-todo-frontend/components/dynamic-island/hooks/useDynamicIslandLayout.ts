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
				// 默认收起状态：只显示小图标（36x36）
				// 鼠标悬停时展开：从左边展开麦克风和截图图标，Hexagon 保持在右边固定位置
				const collapsedLayout = {
					width: 36,
					height: 36,
					borderRadius: 18,
				};
				const expandedLayout = {
					// 三个图标居中排列：18*3 + 16*2(gap) + 24*2(padding) = 54 + 32 + 48 = 134
					width: 130,
					height: 48,
					borderRadius: 24,
				};

				const baseLayout = isHovered ? expandedLayout : collapsedLayout;

				if (position) {
					// 当使用 left 定位时，需要调整 left 值，使得右边（Hexagon 位置）保持不变
					// 收起状态：width = 36px, left = position.x，右边 = position.x + 36px
					// 展开状态：width = 134px, left = position.x - (134 - 36) = position.x - 98px，右边 = position.x - 98px + 134px = position.x + 36px（保持不变）
					const leftOffset = isHovered ? -(expandedLayout.width - collapsedLayout.width) : 0;
					return {
						...baseLayout,
						left: position.x + leftOffset,
						top: position.y,
						right: "auto",
						bottom: "auto",
					};
				} else {
					// 默认位置：右下角
					// 使用 right 定位，这样当宽度变化时，右边（Hexagon 位置）保持不变
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
			case IslandMode.FULLSCREEN: {
				// FULLSCREEN 模式下，和 FLOAT 模式一样，根据 hover 状态展开/收起
				const collapsedLayout = {
					width: 36,
					height: 36,
					borderRadius: 18,
				};
				const expandedLayout = {
					width: 130,
					height: 48,
					borderRadius: 24,
				};

				const baseLayout = isHovered ? expandedLayout : collapsedLayout;

				if (position) {
					// 当使用 left 定位时，需要调整 left 值，使得右边（Hexagon 位置）保持不变
					const leftOffset = isHovered ? -(expandedLayout.width - collapsedLayout.width) : 0;
					return {
						...baseLayout,
						left: position.x + leftOffset,
						top: position.y,
						right: "auto",
						bottom: "auto",
					};
				} else {
					// 默认位置：右下角
					// 使用 right 定位，这样当宽度变化时，右边（Hexagon 位置）保持不变
				return {
						...baseLayout,
						right: margin,
						bottom: margin,
						left: "auto",
						top: "auto",
				};
				}
			}
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
