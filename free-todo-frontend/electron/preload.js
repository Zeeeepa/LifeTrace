const { contextBridge, ipcRenderer } = require("electron");

// 暴露安全的 API 到渲染进程
contextBridge.exposeInMainWorld("electron", {
	// 版本信息
	versions: {
		node: process.versions.node,
		chrome: process.versions.chrome,
		electron: process.versions.electron,
	},

	// 平台信息
	platform: process.platform,

	// IPC 通信（如果将来需要）
	ipc: {
		send: (channel, data) => {
			// 白名单允许的频道
			const validChannels = ["app-quit", "window-minimize", "window-maximize"];
			if (validChannels.includes(channel)) {
				ipcRenderer.send(channel, data);
			}
		},
		on: (channel, func) => {
			const validChannels = ["app-notification", "app-update"];
			if (validChannels.includes(channel)) {
				ipcRenderer.on(channel, (event, ...args) => func(...args));
			}
		},
		once: (channel, func) => {
			const validChannels = ["app-notification", "app-update"];
			if (validChannels.includes(channel)) {
				ipcRenderer.once(channel, (event, ...args) => func(...args));
			}
		},
		removeListener: (channel, func) => {
			const validChannels = ["app-notification", "app-update"];
			if (validChannels.includes(channel)) {
				ipcRenderer.removeListener(channel, func);
			}
		},
	},
});

// 控制台日志，帮助调试
console.log("Preload script loaded");
console.log("Platform:", process.platform);
console.log("Electron version:", process.versions.electron);
