/**
 * Island 窗口管理器
 * 负责创建和管理 Dynamic Island 悬浮窗口
 */

import path from "node:path";
import { app, BrowserWindow, ipcMain, screen } from "electron";
import { logger } from "./logger";

/**
 * Island 模式枚举（与前端保持一致）
 */
export enum IslandMode {
  FLOAT = "FLOAT",
  POPUP = "POPUP",
  SIDEBAR = "SIDEBAR",
  FULLSCREEN = "FULLSCREEN",
}

/**
 * 各模式对应的窗口尺寸
 */
const ISLAND_SIZES: Record<IslandMode, { width: number; height: number }> = {
  [IslandMode.FLOAT]: { width: 180, height: 48 },
  [IslandMode.POPUP]: { width: 340, height: 110 },
  [IslandMode.SIDEBAR]: { width: 400, height: 500 },
  [IslandMode.FULLSCREEN]: { width: 0, height: 0 }, // 动态计算
};

/**
 * Island 窗口管理器类
 */
export class IslandWindowManager {
  /** Island 窗口实例 */
  private islandWindow: BrowserWindow | null = null;
  /** 当前模式 */
  private currentMode: IslandMode = IslandMode.FLOAT;
  /** 是否启用 Island */
  private enabled: boolean = false;
  /** 窗口位置配置 */
  private readonly marginRight: number = 20;
  private readonly marginTop: number = 20;

  /**
   * 获取 preload 脚本路径
   */
  private getPreloadPath(): string {
    if (app.isPackaged) {
      return path.join(app.getAppPath(), "dist-electron", "preload.js");
    }
    return path.join(__dirname, "preload.js");
  }

  /**
   * 计算窗口位置（屏幕右上角）
   */
  private calculateWindowPosition(width: number, _height: number): { x: number; y: number } {
    const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;
    return {
      x: screenWidth - width - this.marginRight,
      y: this.marginTop,
    };
  }

  /**
   * 获取指定模式的窗口尺寸
   */
  private getSizeForMode(mode: IslandMode): { width: number; height: number } {
    if (mode === IslandMode.FULLSCREEN) {
      return screen.getPrimaryDisplay().workAreaSize;
    }
    return ISLAND_SIZES[mode];
  }

  /**
   * 创建 Island 窗口
   * @param serverUrl 前端服务器 URL
   */
  create(serverUrl: string): void {
    if (this.islandWindow) {
      logger.warn("Island window already exists");
      return;
    }

    const preloadPath = this.getPreloadPath();
    const { width, height } = this.getSizeForMode(this.currentMode);
    const { x, y } = this.calculateWindowPosition(width, height);

    this.islandWindow = new BrowserWindow({
      width,
      height,
      x,
      y,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: true,
      hasShadow: true,
      focusable: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: preloadPath,
      },
      show: false,
      backgroundColor: "#00000000",
    });

    // 设置窗口级别，使其始终在最上层（包括全屏应用之上）
    this.islandWindow.setAlwaysOnTop(true, "floating");

    // macOS 特定：设置窗口在所有工作区可见
    if (process.platform === "darwin") {
      this.islandWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    }

    // 加载 Island 页面
    const islandUrl = `${serverUrl}/island`;
    this.islandWindow.loadURL(islandUrl);

    // 窗口准备好后显示
    this.islandWindow.once("ready-to-show", () => {
      this.islandWindow?.show();
      logger.info("Island window ready and shown");
    });

    // 窗口关闭时清理引用
    this.islandWindow.on("closed", () => {
      this.islandWindow = null;
      logger.info("Island window closed");
    });

    // 设置 IPC 处理器
    this.setupIpcHandlers();

    this.enabled = true;
    logger.info(`Island window created at ${islandUrl}`);
  }

  /**
   * 设置 Island 专用的 IPC 处理器
   */
  private setupIpcHandlers(): void {
    // 处理窗口大小调整请求
    ipcMain.on("island:resize-window", (_event, mode: string) => {
      this.resizeToMode(mode as IslandMode);
    });

    // 兼容旧的 resize-window 通道（来自原始 Island 代码）
    ipcMain.on("resize-window", (event, mode: string) => {
      // 只处理来自 Island 窗口的请求
      if (this.islandWindow && event.sender === this.islandWindow.webContents) {
        this.resizeToMode(mode as IslandMode);
      }
    });
  }

  /**
   * 调整窗口到指定模式
   */
  resizeToMode(mode: IslandMode): void {
    if (!this.islandWindow) return;

    const validModes = Object.values(IslandMode);
    if (!validModes.includes(mode)) {
      logger.warn(`Invalid Island mode: ${mode}`);
      return;
    }

    this.currentMode = mode;
    const { width, height } = this.getSizeForMode(mode);

    if (mode === IslandMode.FULLSCREEN) {
      // 全屏模式：覆盖整个工作区
      const { x: screenX, y: screenY } = screen.getPrimaryDisplay().workArea;
      this.islandWindow.setBounds({ x: screenX, y: screenY, width, height });
    } else {
      // 非全屏模式：定位到右上角
      const { x, y } = this.calculateWindowPosition(width, height);
      this.islandWindow.setBounds({ x, y, width, height });
    }

    logger.info(`Island window resized to mode: ${mode} (${width}x${height})`);
  }

  /**
   * 显示 Island 窗口
   */
  show(): void {
    if (this.islandWindow && !this.islandWindow.isVisible()) {
      this.islandWindow.show();
    }
  }

  /**
   * 隐藏 Island 窗口
   */
  hide(): void {
    if (this.islandWindow && this.islandWindow.isVisible()) {
      this.islandWindow.hide();
    }
  }

  /**
   * 切换 Island 窗口显示/隐藏
   */
  toggle(): void {
    if (this.islandWindow) {
      if (this.islandWindow.isVisible()) {
        this.hide();
      } else {
        this.show();
      }
    }
  }

  /**
   * 销毁 Island 窗口
   */
  destroy(): void {
    if (this.islandWindow) {
      this.islandWindow.close();
      this.islandWindow = null;
    }
    this.enabled = false;
  }

  /**
   * 获取 Island 窗口实例
   */
  getWindow(): BrowserWindow | null {
    return this.islandWindow;
  }

  /**
   * 检查 Island 是否已启用
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * 检查窗口是否存在
   */
  hasWindow(): boolean {
    return this.islandWindow !== null && !this.islandWindow.isDestroyed();
  }

  /**
   * 获取当前模式
   */
  getCurrentMode(): IslandMode {
    return this.currentMode;
  }

  /**
   * 向 Island 窗口发送消息
   */
  sendMessage(channel: string, ...args: unknown[]): void {
    if (this.islandWindow && !this.islandWindow.isDestroyed()) {
      this.islandWindow.webContents.send(channel, ...args);
    }
  }
}
