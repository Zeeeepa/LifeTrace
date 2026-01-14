/**
 * 拖拽逻辑 Hook
 */

import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { IslandMode } from "../types";

interface UseDynamicIslandDragOptions {
	mode: IslandMode;
	islandRef: React.RefObject<HTMLDivElement | null>;
	setIgnoreMouse: (ignore: boolean) => void;
	calculateSnapPosition: (x: number, y: number) => { x: number; y: number };
	setPosition: (pos: { x: number; y: number } | null) => void;
	setIsHovered: (hovered: boolean) => void;
}

export function useDynamicIslandDrag({
	mode,
	islandRef,
	setIgnoreMouse,
	calculateSnapPosition,
	setPosition,
	setIsHovered,
}: UseDynamicIslandDragOptions) {
	const [isDragging, setIsDragging] = useState(false);
	const [isDragEnding, setIsDragEnding] = useState(false); // 标记拖拽刚结束，需要禁用动画
	const dragStartPos = useRef<{
		x: number;
		y: number;
		startX: number;
		startY: number;
	} | null>(null);

	// 手动拖拽实现（完全控制位置，防止飞出屏幕）
	const handleMouseDown = useCallback(
		(e: React.MouseEvent) => {
			// PANEL 模式不允许拖拽，其它模式允许
			if (mode === IslandMode.PANEL) return;

			// 如果点击的是按钮或可交互元素，不拖拽
			const target = e.target as HTMLElement;
			if (
				target.closest('button, a, input, select, textarea, [role="button"]')
			) {
				return;
			}

			if (e.button === 0) {
				// 左键
				// 立即取消点击穿透，确保可以捕获鼠标事件
				setIsHovered(true);
				setIgnoreMouse(false); // 立即取消点击穿透，允许交互和拖拽
				console.log(
					"[DynamicIsland] Mouse down for drag, click-through disabled",
				);

				// 开始拖拽
				setIsDragging(true);
				const rect = islandRef.current?.getBoundingClientRect();
				if (rect) {
					dragStartPos.current = {
						x: e.clientX,
						y: e.clientY,
						startX: rect.left,
						startY: rect.top,
					};
				}
				// 不要 preventDefault，让拖拽可以正常工作
				e.stopPropagation(); // 阻止事件冒泡到内容区域
			}
		},
		[mode, setIgnoreMouse, setIsHovered, islandRef],
	);

	// 处理鼠标移动
	useEffect(() => {
		if (typeof window === "undefined") return;
		// FLOAT 和 FULLSCREEN 模式下都允许拖拽
		if (mode !== IslandMode.FLOAT && mode !== IslandMode.FULLSCREEN) return;
		if (!isDragging || !dragStartPos.current) return;

		// 确保在拖拽过程中点击穿透保持被取消状态
		setIgnoreMouse(false);

		const handleMouseMove = (e: MouseEvent) => {
			if (!islandRef.current || !dragStartPos.current) return;

			const deltaX = e.clientX - dragStartPos.current.x;
			const deltaY = e.clientY - dragStartPos.current.y;

			// ✅ 修复：如果灵动岛在右边，只允许上下拖动，不允许左右移动
			// 检查初始位置是否在右边（距离右边小于100px认为是右边）
			const windowWidth = window.innerWidth;
			const windowHeight = window.innerHeight;
			const islandWidth = 150; // 更新为新的宽度
			const islandHeight = 48;
			const isOnRight = dragStartPos.current.startX > windowWidth - islandWidth - 100;

			// 计算新位置
			let newX = dragStartPos.current.startX;
			let newY = dragStartPos.current.startY + deltaY;

			// 如果在右边，保持X位置不变（只允许上下拖动）
			if (isOnRight) {
				// 保持右边位置，使用 right 定位
				const margin = 0; // ✅ 修复：使用0 margin，确保在最右边
				newX = windowWidth - islandWidth - margin;
			} else {
				// 不在右边时，允许左右移动
				newX = dragStartPos.current.startX + deltaX;
				newX = Math.max(0, Math.min(newX, windowWidth - islandWidth));
			}

			// 限制Y在屏幕范围内
			newY = Math.max(0, Math.min(newY, windowHeight - islandHeight));

			// 更新位置（临时位置，不更新 corner）
			if (isOnRight) {
				// 使用 right 定位，确保在最右边
				islandRef.current.style.right = "2px";
				islandRef.current.style.left = "auto";
			} else {
				islandRef.current.style.left = `${newX}px`;
				islandRef.current.style.right = "auto";
			}
			islandRef.current.style.top = `${newY}px`;
			islandRef.current.style.bottom = "auto";
		};

		const handleMouseUp = (_e: MouseEvent) => {
			if (!islandRef.current || !dragStartPos.current) return;

			const rect = islandRef.current.getBoundingClientRect();
			const currentX = rect.left;
			const currentY = rect.top;

			// ✅ 修复：检查是否在右边，如果是则使用 right 定位
			const windowWidth = window.innerWidth;
			const islandWidth = 150;
			const isOnRight = currentX > windowWidth - islandWidth - 100;

			// 计算吸附位置
			const snapPos = calculateSnapPosition(currentX, currentY);

			// 标记拖拽结束，禁用动画
			setIsDragEnding(true);

			// ✅ 修复：直接设置最终位置到 DOM，避免动画回放
			// 如果在右边，使用 right 定位；否则使用 left 定位
			if (isOnRight || snapPos.x > windowWidth - islandWidth - 100) {
				islandRef.current.style.right = "2px";
				islandRef.current.style.left = "auto";
			} else {
				islandRef.current.style.left = `${snapPos.x}px`;
				islandRef.current.style.right = "auto";
			}
			islandRef.current.style.top = `${snapPos.y}px`;
			islandRef.current.style.bottom = "auto";

			// 更新位置状态（用于后续布局计算）
			setPosition(snapPos);
			setIsDragging(false);
			dragStartPos.current = null;

			// 短暂延迟后恢复动画（用于其他非拖拽的位置变化）
			setTimeout(() => {
				setIsDragEnding(false);
			}, 100);

			// 拖拽结束后，检查鼠标是否还在灵动岛区域内
			// 如果不在，恢复点击穿透；如果在，保持可交互状态
			setTimeout(() => {
				if (!islandRef.current) return;
				const finalRect = islandRef.current.getBoundingClientRect();
				const mouseX = _e.clientX;
				const mouseY = _e.clientY;
				const padding = 10;
				const isInside =
					mouseX >= finalRect.left - padding &&
					mouseX <= finalRect.right + padding &&
					mouseY >= finalRect.top - padding &&
					mouseY <= finalRect.bottom + padding;

				if (!isInside && mode === IslandMode.FLOAT) {
					setIsHovered(false);
					setIgnoreMouse(true);
					console.log(
						"[DynamicIsland] Drag ended, mouse outside, click-through enabled",
					);
				}
			}, 100);
		};

		window.addEventListener("mousemove", handleMouseMove);
		window.addEventListener("mouseup", handleMouseUp);

		return () => {
			window.removeEventListener("mousemove", handleMouseMove);
			window.removeEventListener("mouseup", handleMouseUp);
		};
	}, [
		isDragging,
		calculateSnapPosition,
		mode,
		setIgnoreMouse,
		setPosition,
		setIsHovered,
		islandRef,
	]);

	return { isDragging, isDragEnding, handleMouseDown };
}
