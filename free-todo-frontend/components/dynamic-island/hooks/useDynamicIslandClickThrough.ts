/**
 * 点击穿透逻辑 Hook
 */

import { useCallback, useEffect } from "react";
import { getElectronAPI } from "../electron-api";
import { IslandMode } from "../types";

export function useDynamicIslandClickThrough(mode: IslandMode) {
	const setIgnoreMouse = useCallback((ignore: boolean) => {
		const api = getElectronAPI();
		try {
			if (api.require) {
				const { ipcRenderer } = api.require("electron") ?? {};
				if (ignore) {
					// forward: true lets the mouse move event still reach the browser
					// so we can detect when to turn it back on.
					ipcRenderer?.send("set-ignore-mouse-events", true, {
						forward: true,
					});
				} else {
					ipcRenderer?.send("set-ignore-mouse-events", false);
				}
			} else {
				api.electronAPI?.setIgnoreMouseEvents?.(
					ignore,
					ignore ? { forward: true } : undefined,
				);
			}
		} catch (error) {
			console.error("[DynamicIsland] setIgnoreMouse failed", error);
		}
	}, []);

	useEffect(() => {
		// 注意：点击穿透设置已由 app/page.tsx 统一管理
		// 这里只在 FLOAT 模式下设置点击穿透，用于 hover 时的临时控制
		// PANEL 和 FULLSCREEN 模式的点击穿透由 app/page.tsx 控制
		if (mode === IslandMode.FLOAT) {
			// Delay setting click-through to ensure window state is updated
			setTimeout(() => {
				setIgnoreMouse(true);
			}, 100);
			console.log(
				"[DynamicIsland] Switched to FLOAT mode, will enable click-through in 100ms",
			);
		}
		// PANEL 和 FULLSCREEN 模式不在这里设置，由 app/page.tsx 统一管理
	}, [mode, setIgnoreMouse]);

	return setIgnoreMouse;
}
