import { contextBridge } from 'electron';

// 预加载脚本，用于安全地暴露 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 未来可以在这里添加需要暴露给渲染进程的 API
});

