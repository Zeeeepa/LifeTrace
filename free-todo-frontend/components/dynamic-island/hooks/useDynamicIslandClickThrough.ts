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
		if (mode === IslandMode.FLOAT) {
			// ✅ 修复：延迟启用点击穿透，给 hover 检测一些时间
			// 这样如果鼠标已经在灵动岛区域内，hover 检测可以先禁用点击穿透
			// 延迟时间设置为 50ms，足以让 hover 检测完成初始检查
			const timeoutId = setTimeout(() => {
				// FLOAT 模式下：开启点击穿透（窗口级别），由 useElectronClickThrough 负责区域判断
				// 注意：如果 hover 检测已经在灵动岛区域内，它会调用 setIgnoreMouse(false) 覆盖这个设置
				setIgnoreMouse(true);
			}, 50);

			return () => {
				clearTimeout(timeoutId);
			};
		} else {
			// 切换离开 FLOAT（例如到 PANEL）时，确保立即关闭点击穿透
			setIgnoreMouse(false);
		}
	}, [mode, setIgnoreMouse]);

	return setIgnoreMouse;
}
