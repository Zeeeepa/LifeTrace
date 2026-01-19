/**
 * IPC 通信处理器
 * 集中管理所有主进程与渲染进程之间的 IPC 通信
 */

import { app, BrowserWindow, ipcMain, screen } from "electron";
import { setupTodoCaptureIpcHandlers } from "./ipc-handlers-todo-capture";
import { logger } from "./logger";
import {
	type NotificationData,
	showSystemNotification,
} from "./notification";
import type { WindowManager } from "./window-manager";

/**
 * 设置所有 IPC 处理器
 * @param windowManager 窗口管理器实例
 */
export function setupIpcHandlers(windowManager: WindowManager): void {
	// 处理来自渲染进程的通知请求
	ipcMain.handle(
		"show-notification",
		async (_event, data: NotificationData) => {
			try {
				logger.info(`Received notification request: ${data.id} - ${data.title}`);
				showSystemNotification(data, windowManager);
			} catch (error) {
				const errorMsg = `Failed to handle notification request: ${error instanceof Error ? error.message : String(error)}`;
				logger.error(errorMsg);
				throw error;
			}
		},
	);

	// ========== 窗口管理 IPC 处理器 ==========

	// 设置窗口是否忽略鼠标事件（用于透明窗口点击穿透）
	ipcMain.on(
		"set-ignore-mouse-events",
		(event, ignore: boolean, options?: { forward?: boolean }) => {
			const win = BrowserWindow.fromWebContents(event.sender);
			if (win) {
				win.setIgnoreMouseEvents(ignore, options || {});
			}
		},
	);

	// 移动窗口到指定位置（用于拖拽）
	ipcMain.on("move-window", (event, x: number, y: number) => {
		const win = BrowserWindow.fromWebContents(event.sender);
		if (win) {
			win.setPosition(Math.round(x), Math.round(y));
		}
	});

	// 获取窗口当前位置
	ipcMain.handle("get-window-position", () => {
		const win = windowManager.getWindow();
		if (win) {
			const [x, y] = win.getPosition();
			return { x, y };
		}
		return { x: 0, y: 0 };
	});

	// 获取屏幕信息
	ipcMain.handle("get-screen-info", () => {
		const { width, height } = screen.getPrimaryDisplay().workAreaSize;
		return { screenWidth: width, screenHeight: height };
	});

	// 退出应用
	ipcMain.on("app-quit", () => {
		app.quit();
	});

	// 透明背景就绪通知
	ipcMain.on("transparent-background-ready", () => {
		const win = windowManager.getWindow();
		if (win) {
			win.setBackgroundColor("#00000000");
		}
	});

	// 设置窗口背景色
	ipcMain.on("set-window-background-color", (event, color: string) => {
		const win = BrowserWindow.fromWebContents(event.sender);
		if (win) {
			win.setBackgroundColor(color);
			logger.info(`Window background color set to: ${color}`);
		}
	});

	// ========== 待办提取相关 IPC 处理器 ==========
	// 已提取到 ipc-handlers-todo-capture.ts 以保持文件大小
	setupTodoCaptureIpcHandlers(windowManager);
}
