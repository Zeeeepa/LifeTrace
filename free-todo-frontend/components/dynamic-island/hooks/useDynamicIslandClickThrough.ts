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
		// If we are in FULLSCREEN mode, we always want to capture mouse
		if (mode === IslandMode.FULLSCREEN) {
			// Immediately disable click-through for fullscreen mode
			setIgnoreMouse(false);
			console.log("[DynamicIsland] Switched to FULLSCREEN mode, click-through disabled");
		}
		// Panel mode: window is interactive, don't ignore mouse
		else if (mode === IslandMode.PANEL) {
			setIgnoreMouse(false);
			console.log("[DynamicIsland] Switched to PANEL mode, click-through disabled");
		}
		// FLOAT mode: default ignore mouse (click-through), cancel ignore on hover
		else {
			// Delay setting click-through to ensure window state is updated
			setTimeout(() => {
				setIgnoreMouse(true);
			}, 100);
			console.log(
				"[DynamicIsland] Switched to FLOAT mode, will enable click-through in 100ms",
			);
		}
	}, [mode, setIgnoreMouse]);

	return setIgnoreMouse;
}
