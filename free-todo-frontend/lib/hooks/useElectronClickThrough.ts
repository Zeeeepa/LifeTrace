/**
 * Electron 点击穿透管理 Hook
 * 管理 Electron 窗口的点击穿透状态，确保 Panel 和 FULLSCREEN 模式下可以交互
 */

import { useEffect } from "react";
import { getElectronAPI } from "@/components/dynamic-island/electron-api";
import { IslandMode } from "@/components/dynamic-island/types";

interface UseElectronClickThroughOptions {
	mounted: boolean;
	isElectron: boolean;
	mode: IslandMode;
	isUserInteracting: boolean;
}

export function useElectronClickThrough({
	mounted,
	isElectron,
	mode,
	isUserInteracting,
}: UseElectronClickThroughOptions) {
	useEffect(() => {
		if (!mounted || !isElectron) return;
		const api = getElectronAPI();
		if (!api.electronAPI?.setIgnoreMouseEvents) {
			return;
		}

		// FULLSCREEN 模式下，确保内容可见（移除透明样式，设置可见背景）
		if (mode === IslandMode.FULLSCREEN) {
			// 移除 Panel 模式的透明样式
			const panelOpacityStyle = document.getElementById("panel-mode-opacity-fix");
			if (panelOpacityStyle) {
				panelOpacityStyle.remove();
			}
			// ✅ 确保 html/body/#__next 可见，设置背景色为 CSS 变量值
			if (typeof document !== "undefined") {
				const html = document.documentElement;
				const body = document.body;
				const next = document.getElementById("__next");

				// 获取当前主题的实际背景色值（从 CSS 变量计算）
				const computedStyle = window.getComputedStyle(body);
				const backgroundColor = computedStyle.backgroundColor || "rgb(26, 26, 26)"; // 默认深色背景

				if (html) {
					html.style.removeProperty("opacity");
					html.style.setProperty("background-color", "oklch(var(--background))", "important");
					html.style.setProperty("background", "oklch(var(--background))", "important");
				}
				if (body) {
					body.style.removeProperty("opacity");
					body.style.setProperty("background-color", "oklch(var(--background))", "important");
					body.style.setProperty("background", "oklch(var(--background))", "important");
				}
				if (next) {
					next.style.removeProperty("opacity");
					next.style.setProperty("background-color", "oklch(var(--background))", "important");
					next.style.setProperty("background", "oklch(var(--background))", "important");
				}

				// ✅ 设置 Electron 窗口背景色为当前主题的实际背景色值
				const api = getElectronAPI();
				if (api.electronAPI?.setWindowBackgroundColor) {
					// 将 CSS 颜色值转换为 Electron 可用的格式（rgb 或 hex）
					api.electronAPI.setWindowBackgroundColor(backgroundColor);
				}
			}
		}

		// Panel 模式下，强制设置窗口和内容不透明
		if (mode === IslandMode.PANEL) {
			// ✅ 修复 FULLSCREEN → PANEL：先清理 FULLSCREEN 设置的背景色样式
			if (typeof document !== "undefined") {
				const html = document.documentElement;
				const body = document.body;
				const next = document.getElementById("__next");

				// 先移除 FULLSCREEN 模式下设置的背景色（oklch(var(--background))）
				if (html) {
					html.style.removeProperty("background-color");
					html.style.removeProperty("background");
				}
				if (body) {
					body.style.removeProperty("background-color");
					body.style.removeProperty("background");
				}
				if (next) {
					next.style.removeProperty("background-color");
					next.style.removeProperty("background");
				}
			}

			const panelOpacityStyleId = "panel-mode-opacity-fix";
			let panelOpacityStyle = document.getElementById(panelOpacityStyleId);
			if (!panelOpacityStyle) {
				panelOpacityStyle = document.createElement("style");
				panelOpacityStyle.id = panelOpacityStyleId;
				document.head.appendChild(panelOpacityStyle);
			}
			// ✅ 只设置 Panel 窗口不透明，main/body/html 保持透明
			// ✅ 修复：确保不影响全局组件（DynamicIsland等）的定位
			panelOpacityStyle.textContent = `
				html, body, #__next {
					opacity: 1 !important;
					background-color: transparent !important;
					background: transparent !important;
				}
				[data-panel-window] {
					opacity: 1 !important;
					background-color: white !important;
					background: white !important;
					visibility: visible !important;
				}
				/* ✅ 修复：确保全局组件（DynamicIsland等）不受影响 */
				[data-panel-window] ~ *,
				body > [style*="z-index: 1000002"],
				body > [style*="z-index: 999999"] {
					position: fixed !important;
					z-index: inherit !important;
				}
			`;

			// 直接设置 DOM 样式，确保立即生效
			if (typeof document !== "undefined") {
				const html = document.documentElement;
				const body = document.body;
				const next = document.getElementById("__next");

				// ✅ main 和 body 保持透明，只有 Panel 窗口有背景
				// ✅ 修复：不修改 position 相关样式，避免影响全局组件
				if (html) {
					html.style.setProperty("opacity", "1", "important");
					html.style.setProperty("background-color", "transparent", "important");
					html.style.setProperty("background", "transparent", "important");
					// 不修改 position，避免影响 fixed 定位的全局组件
				}
				if (body) {
					body.style.setProperty("opacity", "1", "important");
					body.style.setProperty("background-color", "transparent", "important");
					body.style.setProperty("background", "transparent", "important");
					// 不修改 position，避免影响 fixed 定位的全局组件
				}
				if (next) {
					next.style.setProperty("opacity", "1", "important");
					next.style.setProperty("background-color", "transparent", "important");
					next.style.setProperty("background", "transparent", "important");
					// 不修改 position，避免影响 fixed 定位的全局组件
				}

				// ✅ 强制设置 Panel 窗口不透明
				const panelWindow = document.querySelector('[data-panel-window]') as HTMLElement;
				if (panelWindow) {
					panelWindow.style.setProperty('opacity', '1', 'important');
					panelWindow.style.setProperty('backgroundColor', 'white', 'important');
					panelWindow.style.setProperty('background', 'white', 'important');
					panelWindow.style.setProperty('visibility', 'visible', 'important');
				}
			}
		} else if (mode === IslandMode.FLOAT) {
			// FLOAT 模式：移除 Panel 模式的样式，恢复透明背景
			const panelOpacityStyle = document.getElementById("panel-mode-opacity-fix");
			if (panelOpacityStyle) {
				panelOpacityStyle.remove();
			}
			// ✅ 恢复窗口背景色为透明
			const api = getElectronAPI();
			if (api.electronAPI?.setWindowBackgroundColor) {
				api.electronAPI.setWindowBackgroundColor("#00000000");
			}
			// ✅ 恢复 html/body/#__next 为透明
			if (typeof document !== "undefined") {
				const html = document.documentElement;
				const body = document.body;
				const next = document.getElementById("__next");

				if (html) {
					html.style.removeProperty("opacity");
					html.style.setProperty("background-color", "transparent", "important");
					html.style.setProperty("background", "transparent", "important");
				}
				if (body) {
					body.style.removeProperty("opacity");
					body.style.setProperty("background-color", "transparent", "important");
					body.style.setProperty("background", "transparent", "important");
				}
				if (next) {
					next.style.removeProperty("opacity");
					next.style.setProperty("background-color", "transparent", "important");
					next.style.setProperty("background", "transparent", "important");
				}
			}
		}

		// ====== 点击穿透逻辑重写 ======
		// 目标：
		// - FLOAT：整个窗口点击穿透（保持不变）
		// - FULLSCREEN：整个窗口可交互（保持不变）
		// - PANEL：只有 Panel 窗口区域可交互，其它透明区域点击透传到系统

		// FLOAT 模式：整窗点击穿透
		if (mode === IslandMode.FLOAT) {
			try {
				api.electronAPI.setIgnoreMouseEvents(true, { forward: true });
			} catch {
				// ignore
			}
			return;
		}

		// FULLSCREEN 模式：整窗始终可交互
		if (mode === IslandMode.FULLSCREEN) {
			const setInteractive = () => {
				if (isUserInteracting) return;
				if (!api.electronAPI?.setIgnoreMouseEvents) return;
				try {
					api.electronAPI.setIgnoreMouseEvents(false);
				} catch {
					// ignore
				}
			};

			setInteractive();
			const intervalId = setInterval(setInteractive, 500);
			return () => {
				clearInterval(intervalId);
			};
		}

		// PANEL 模式：根据鼠标是否在 panel-window 区域内，动态切换点击穿透
		if (mode === IslandMode.PANEL) {
			let lastInside = false;

			const handleMouseMove = (event: MouseEvent) => {
				const panelEl = document.querySelector(
					"[data-panel-window]",
				) as HTMLElement | null;
				if (!panelEl) {
					return;
				}
				const rect = panelEl.getBoundingClientRect();
				const x = event.clientX;
				const y = event.clientY;
				// ✅ 修复：确保顶部区域也被识别为 panel 内部（包括顶部调整区域）
				// 使用 <= 和 >= 确保边界也被包含
				const inside =
					x >= rect.left &&
					x <= rect.right &&
					y >= rect.top &&
					y <= rect.bottom;

				// 状态没变就不重复调用 IPC
				if (inside === lastInside) return;
				lastInside = inside;

				if (!api.electronAPI?.setIgnoreMouseEvents) return;
				try {
					if (inside) {
						// ✅ 鼠标在 Panel 上（包括顶部区域）：允许 Electron 窗口接收点击
						// 确保顶部区域不会点击穿透
						api.electronAPI.setIgnoreMouseEvents(false);
					} else {
						// 鼠标不在 Panel 上：窗口点击穿透，转发到底层系统
						api.electronAPI.setIgnoreMouseEvents(true, {
							forward: true,
						});
					}
				} catch {
					// ignore
				}
			};

			window.addEventListener("mousemove", handleMouseMove);

			// 初始化：如果一开始鼠标就在 panel 上，需要主动触发一次
			//（例如从其它模式切换进来时）
			requestAnimationFrame(() => {
				const initEvent = new MouseEvent("mousemove", {
					clientX: window.innerWidth / 2,
					clientY: window.innerHeight / 2,
				});
				handleMouseMove(initEvent);
			});

			return () => {
				window.removeEventListener("mousemove", handleMouseMove);
				// 清理时恢复整窗点击穿透，避免残留
				if (!api.electronAPI?.setIgnoreMouseEvents) return;
				try {
					api.electronAPI.setIgnoreMouseEvents(true, { forward: true });
				} catch {
					// ignore
				}
			};
		}
	}, [mounted, isElectron, mode, isUserInteracting]);
}
