import type messages from "./lib/i18n/messages/zh.json";

type Messages = typeof messages;

declare global {
	// Use type safe message keys with `auto-complete`
	interface IntlMessages extends Messages {}

	// Cookie Store API 类型声明
	interface CookieStoreSetOptions {
		name: string;
		value: string;
		expires?: number | Date;
		maxAge?: number;
		domain?: string;
		path?: string;
		sameSite?: "strict" | "lax" | "none";
		secure?: boolean;
		partitioned?: boolean;
	}

	interface CookieStoreApi {
		set(options: CookieStoreSetOptions): Promise<void>;
		set(name: string, value: string): Promise<void>;
		get(name: string): Promise<{ name: string; value: string } | null>;
		delete(name: string): Promise<void>;
	}

	interface Window {
		cookieStore?: CookieStoreApi;
		electronAPI?: {
			/**
			 * 显示系统通知
			 * @param data 通知数据
			 */
			showNotification: (data: {
				id: string;
				title: string;
				content: string;
				timestamp: string;
			}) => Promise<void>;

			/**
			 * 设置窗口是否忽略鼠标事件
			 */
			setIgnoreMouseEvents: (ignore: boolean, options?: { forward?: boolean }) => void;

			/**
			 * 获取屏幕信息
			 */
			getScreenInfo: () => Promise<{ screenWidth: number; screenHeight: number }>;

			/**
			 * 移动窗口到指定位置
			 */
			moveWindow: (x: number, y: number) => void;

			/**
			 * 获取窗口当前位置
			 */
			getWindowPosition: () => Promise<{ x: number; y: number }>;

			/**
			 * 退出应用
			 */
			quit: () => void;

			/**
			 * 设置窗口背景色
			 */
			setWindowBackgroundColor: (color: string) => void;

			// ========== Island 动态岛相关 API ==========

			/**
			 * 调整 Island 窗口大小（切换模式）
			 * @param mode Island 模式: "FLOAT" | "POPUP" | "SIDEBAR" | "FULLSCREEN"
			 */
			islandResizeWindow: (mode: string) => void;

			/**
			 * 显示 Island 窗口
			 */
			islandShow: () => void;

			/**
			 * 隐藏 Island 窗口
			 */
			islandHide: () => void;

			/**
			 * 切换 Island 窗口显示/隐藏
			 */
			islandToggle: () => void;
		};
	}
}
