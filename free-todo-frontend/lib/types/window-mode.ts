/**
 * 窗口模式类型（临时，用于迁移）
 * TODO: 重构后可以删除或简化
 */
export enum WindowMode {
	FLOAT = "FLOAT",
	PANEL = "PANEL",
	MAXIMIZE = "MAXIMIZE",
}

// 为了兼容性，导出 IslandMode 作为 WindowMode 的别名
export const IslandMode = WindowMode;
export type IslandMode = WindowMode;
