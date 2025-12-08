/**
 * Panel 配置层
 * 定义功能到位置的映射关系
 */

export type PanelPosition = "panelA" | "panelB" | "panelC";
export type PanelFeature = "calendar" | "todos" | "chat";

/**
 * 功能到位置的映射配置
 * 未来可以通过修改这个配置来改变功能占据的位置
 */
export const PANEL_CONFIG: Record<PanelPosition, PanelFeature> = {
	panelA: "calendar",
	panelB: "todos",
	panelC: "chat",
};

/**
 * 位置到功能的映射（反向查找）
 */
export const POSITION_TO_FEATURE: Record<PanelPosition, PanelFeature> =
	PANEL_CONFIG;

/**
 * 功能到位置的映射（反向查找）
 */
export const FEATURE_TO_POSITION: Record<PanelFeature, PanelPosition> = {
	calendar: "panelA",
	todos: "panelB",
	chat: "panelC",
};

/**
 * 获取指定位置对应的功能
 */
export function getFeatureByPosition(position: PanelPosition): PanelFeature {
	return PANEL_CONFIG[position];
}

/**
 * 获取指定功能对应的位置
 */
export function getPositionByFeature(feature: PanelFeature): PanelPosition {
	return FEATURE_TO_POSITION[feature];
}
