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
			const margin = 0; // ✅ 修复：使用0 margin，确保在最右边时紧贴边缘
			const snapThreshold = 50; // 吸附阈值：50px

			let snapX = x;
			let snapY = y;

			// ✅ 修复：检查是否在右边区域（距离右边小于100px认为是右边）
			const isOnRight = x > windowWidth - islandWidth - 100;

			if (isOnRight) {
				// 如果在右边，固定X位置为最右边（margin=0）
				snapX = windowWidth - islandWidth - margin;
			} else {
				// 检查是否靠近左边缘
				if (x <= margin + snapThreshold) {
					snapX = margin;
				}
				// 检查是否靠近右边缘
				else if (x >= windowWidth - islandWidth - margin - snapThreshold) {
					snapX = windowWidth - islandWidth - margin;
				}
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
			if (!isOnRight) {
				snapX = Math.max(
					margin,
					Math.min(snapX, windowWidth - islandWidth - margin),
				);
			}
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
					// ✅ 修复：检查是否在右边区域（距离右边小于100px认为是右边）
					// 使用更宽松的判断条件，确保在右边时始终使用 right: 7 定位
					const windowWidth = typeof window !== "undefined" ? window.innerWidth : 1920;
					const islandWidth = isHovered ? expandedLayout.width : collapsedLayout.width;
					// ✅ 修复：使用更宽松的判断，只要 position.x 接近右边就使用 right: 7
					// 这样可以避免因为窗口大小变化或计算误差导致的"弹开"问题
					// 关键：使用相对判断，而不是绝对判断，避免模式切换时窗口大小变化导致位置错误
					const isOnRight = position.x >= windowWidth - islandWidth - 150;

					if (isOnRight) {
						// ✅ 如果在右边，使用 right: 7 定位，确保贴近最右边
						// 关键：使用 right 定位，不依赖 position.x 的绝对值，避免窗口大小变化时位置错误
						return {
							...baseLayout,
							right: 7,
							top: position.y,
							left: "auto",
							bottom: "auto",
						};
					} else {
						// 当使用 left 定位时，需要调整 left 值，使得右边（Hexagon 位置）保持不变
						// 收起状态：width = 36px, left = position.x，右边 = position.x + 36px
						// 展开状态：width = 134px, left = position.x - (134 - 36) = position.x - 98px，右边 = position.x - 98px + 134px = position.x + 36px（保持不变）
						// ✅ 修复：确保 position.x 不会超出窗口范围
						const maxLeft = windowWidth - islandWidth;
						const clampedX = Math.max(0, Math.min(position.x, maxLeft));
						const leftOffset = isHovered ? -(expandedLayout.width - collapsedLayout.width) : 0;
						return {
							...baseLayout,
							left: clampedX + leftOffset,
							top: position.y,
							right: "auto",
							bottom: "auto",
						};
					}
				} else {
					// 默认位置：右下角
					// ✅ 修复：使用 right: 7 定位，确保贴近最右边
					return {
						...baseLayout,
						right: 7,
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
					// ✅ 修复：检查是否在右边区域（距离右边小于150px认为是右边）
					// 使用更宽松的判断条件，确保在右边时始终使用 right: 0 定位
					const windowWidth = typeof window !== "undefined" ? window.innerWidth : 1920;
					const islandWidth = isHovered ? expandedLayout.width : collapsedLayout.width;
					// ✅ 修复：使用更宽松的判断，只要 position.x 接近右边就使用 right: 0
					// 这样可以避免因为窗口大小变化或计算误差导致的"弹开"问题
					const isOnRight = position.x >= windowWidth - islandWidth - 150;

					if (isOnRight) {
						// ✅ 如果在右边，使用 right: 0 定位，确保紧贴最右边
						return {
							...baseLayout,
							right: 2,
							top: position.y,
							left: "auto",
							bottom: "auto",
						};
					} else {
						// 当使用 left 定位时，需要调整 left 值，使得右边（Hexagon 位置）保持不变
						const leftOffset = isHovered ? -(expandedLayout.width - collapsedLayout.width) : 0;
						return {
							...baseLayout,
							left: position.x + leftOffset,
							top: position.y,
							right: "auto",
							bottom: "auto",
						};
					}
				} else {
					// 默认位置：右下角
					// ✅ 修复：使用 right: 2 定位，确保贴近最右边
					return {
						...baseLayout,
						right: 2,
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
