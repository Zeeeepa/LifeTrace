/**
 * Panel 窗口拖动 Hook
 * 处理 Panel 窗口的拖动逻辑
 */

import { useCallback } from "react";
import { getElectronAPI } from "@/components/dynamic-island/electron-api";
import type { IslandMode } from "@/components/dynamic-island/types";

interface UsePanelWindowDragOptions {
	panelWindowWidth: number;
	isElectron: boolean;
	mode: IslandMode;
	shouldShowPage: boolean;
	setPanelWindowPosition: (position: { x: number; y: number }) => void;
	setIsDraggingPanel: (isDragging: boolean) => void;
	setIsUserInteracting: (isInteracting: boolean) => void;
}

export function usePanelWindowDrag({
	panelWindowWidth,
	isElectron,
	mode,
	shouldShowPage,
	setPanelWindowPosition,
	setIsDraggingPanel,
	setIsUserInteracting,
}: UsePanelWindowDragOptions) {
	const handlePanelDragStart = useCallback((e: React.MouseEvent) => {
		// 如果点击的是调整大小的手柄，不触发拖动
		if ((e.target as HTMLElement).classList.contains("resize-handle")) {
			return;
		}
		// 如果点击的是按钮，不触发拖动
		if ((e.target as HTMLElement).closest("button")) {
			return;
		}
		// 如果点击的不是标题栏区域，不触发拖动
		if (!(e.target as HTMLElement).closest(".panel-drag-handle")) {
			return;
		}
		e.preventDefault();
		e.stopPropagation();

		// ✅ 设置交互标志，防止定时器干扰
		setIsUserInteracting(true);
		setIsDraggingPanel(true);

		// ✅ 立即禁用点击穿透
		if (isElectron) {
			const api = getElectronAPI();
			api.electronAPI?.setIgnoreMouseEvents?.(false);
		}

		// ✅ 关键修复：拖动时强制确保 Panel DOM 元素可见
		// 立即设置，不等待
		const panelWindow = document.querySelector('[data-panel-window]') as HTMLElement;
		if (!panelWindow) return;

		// 使用 cssText 追加样式，确保优先级最高
		const currentStyle = panelWindow.getAttribute('style') || '';
		panelWindow.style.cssText = `${currentStyle}
			opacity: 1 !important;
			background-color: white !important;
			background: white !important;
			visibility: visible !important;
			display: flex !important;
			z-index: 1000001 !important;
			position: fixed !important;
		`;

		// 再次确保（使用 setTimeout 和 requestAnimationFrame）
		setTimeout(() => {
			requestAnimationFrame(() => {
				const panelWindowAfter = document.querySelector('[data-panel-window]') as HTMLElement;
				if (panelWindowAfter) {
					const currentStyle = panelWindowAfter.getAttribute('style') || '';
					panelWindowAfter.style.cssText = `${currentStyle}
						opacity: 1 !important;
						background-color: white !important;
						background: white !important;
						visibility: visible !important;
						display: flex !important;
						z-index: 1000001 !important;
						position: fixed !important;
					`;
				}
			});
		}, 0);

		// ✅ 获取当前窗口的实际位置（从 DOM 元素获取，而不是从 state）
		const rect = panelWindow.getBoundingClientRect();
		// 计算鼠标相对于窗口的偏移量（点击位置在窗口内的偏移）
		const offsetX = e.clientX - rect.left;
		const offsetY = e.clientY - rect.top;

		const handleMouseMove = (moveEvent: MouseEvent) => {
			// ✅ 关键检查：在移动前检查 Panel 窗口是否存在
			const currentPanelWindow = document.querySelector('[data-panel-window]') as HTMLElement;
			if (!currentPanelWindow) {
				console.error('[Panel Drag] Panel window disappeared! mode:', mode, 'showContent:', shouldShowPage);
				// 如果 Panel 窗口不存在，停止拖动
				setIsDraggingPanel(false);
				setIsUserInteracting(false);
				document.removeEventListener("mousemove", handleMouseMove);
				document.removeEventListener("mouseup", handleMouseUp);
				return;
			}

			// ✅ 在更新位置之前，立即强制设置样式，防止 React 重新渲染时丢失
			currentPanelWindow.style.setProperty('opacity', '1', 'important');
			currentPanelWindow.style.setProperty('background-color', 'white', 'important');
			currentPanelWindow.style.setProperty('background', 'white', 'important');
			currentPanelWindow.style.setProperty('visibility', 'visible', 'important');
			currentPanelWindow.style.setProperty('display', 'flex', 'important');
			currentPanelWindow.style.setProperty('z-index', '1000001', 'important');
			currentPanelWindow.style.setProperty('position', 'fixed', 'important');

			// ✅ 计算新位置：鼠标当前位置减去初始偏移量，得到窗口的新左边位置
			const newLeft = moveEvent.clientX - offsetX;
			// newTop 是相对于屏幕的绝对位置，但 panelWindowPosition.y 是相对于顶部40px的偏移
			// 所以需要从 newTop 中减去40px，得到 panelWindowPosition.y
			const newTop = moveEvent.clientY - offsetY;

			// 限制在屏幕范围内
			const minX = 0;
			const maxX = window.innerWidth - panelWindowWidth;
			// y 的最小值是 0（顶部40px位置），最大值是窗口高度减去80px（上下边距）
			const minY = 0;
			const maxY = window.innerHeight - 80; // 留出上下边距

			const clampedX = Math.max(minX, Math.min(maxX, newLeft));
			const clampedTop = Math.max(minY, Math.min(maxY, newTop));

			// ✅ 计算 panelWindowPosition：
			// x 是从左边到窗口左边的距离（用于计算 right）
			// y 是相对于顶部40px的偏移（不是绝对位置）
			const newX = clampedX;
			// 从绝对位置转换为相对于顶部40px的偏移
			const newY = clampedTop - 40;

			setPanelWindowPosition({
				x: newX,
				y: newY,
			});

			// ✅ 每次移动后强制确保 Panel DOM 元素可见（使用三重 requestAnimationFrame 确保在 React 渲染后执行）
			requestAnimationFrame(() => {
				requestAnimationFrame(() => {
					requestAnimationFrame(() => {
						const panelWindowAfter = document.querySelector('[data-panel-window]') as HTMLElement;
						if (!panelWindowAfter) {
							console.error('[Panel Drag] Panel window disappeared after setState! mode:', mode);
							return;
						}

						// 检查元素是否真的在 DOM 中
						if (!panelWindowAfter.isConnected) {
							console.error('[Panel Drag] Panel window disconnected from DOM!');
							return;
						}

						// ✅ 获取计算后的样式，检查是否真的可见
						const rect = panelWindowAfter.getBoundingClientRect();

						// 直接设置 DOM 样式，使用 cssText 一次性设置，优先级最高
						// 先获取当前样式，然后添加我们的强制样式
						const currentStyleAfter = panelWindowAfter.getAttribute('style') || '';
						panelWindowAfter.style.cssText = `${currentStyleAfter}
							opacity: 1 !important;
							background-color: white !important;
							background: white !important;
							visibility: visible !important;
							display: flex !important;
							z-index: 1000001 !important;
							position: fixed !important;
						`;

						// ✅ 检查是否有其他元素遮挡
						const elementAtPoint = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
						if (elementAtPoint && !panelWindowAfter.contains(elementAtPoint) && elementAtPoint !== panelWindowAfter) {
							const blockingElement = elementAtPoint as HTMLElement;
							const blockingStyle = window.getComputedStyle(blockingElement);
							const blockingInfo = {
								element: blockingElement,
								tagName: blockingElement.tagName,
								className: blockingElement.className,
								zIndex: blockingStyle.zIndex,
								opacity: blockingStyle.opacity,
								pointerEvents: blockingStyle.pointerEvents,
							};
							console.warn('[Panel Drag] Panel window may be blocked by:', blockingInfo);
						}
					});
				});
			});
		};

		const handleMouseUp = () => {
			setIsDraggingPanel(false);
			// ✅ 清除交互标志
			setIsUserInteracting(false);

			// ✅ 清理后确保点击穿透仍然关闭
			if (isElectron) {
				const api = getElectronAPI();
				api.electronAPI?.setIgnoreMouseEvents?.(false);
			}
			document.removeEventListener("mousemove", handleMouseMove);
			document.removeEventListener("mouseup", handleMouseUp);
		};

		document.addEventListener("mousemove", handleMouseMove);
		document.addEventListener("mouseup", handleMouseUp);
	}, [panelWindowWidth, isElectron, mode, shouldShowPage, setPanelWindowPosition, setIsDraggingPanel, setIsUserInteracting]);

	return { handlePanelDragStart };
}
