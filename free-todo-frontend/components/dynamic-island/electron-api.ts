/**
 * Electron API 类型定义和工具函数
 */

export type ElectronAPI = typeof window & {
	electronAPI?: {
		collapseWindow?: () => Promise<void> | void;
		expandWindow?: () => Promise<void> | void;
		expandWindowFull?: () => Promise<void> | void;
		setIgnoreMouseEvents?: (
			ignore: boolean,
			options?: { forward?: boolean },
		) => void;
		resizeWindow?: (dx: number, dy: number, pos: string) => void;
		quit?: () => void;
		setWindowBackgroundColor?: (color: string) => void;
	};
	require?: (module: string) => {
		ipcRenderer?: { send: (...args: unknown[]) => void };
	};
};

export function getElectronAPI(): ElectronAPI {
	return window as ElectronAPI;
}
