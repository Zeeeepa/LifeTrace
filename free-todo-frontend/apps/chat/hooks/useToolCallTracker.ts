import { useCallback, useRef } from "react";
import type { ToolCallStep } from "@/apps/chat/types";
import type { ToolCallEvent } from "@/lib/api";

/**
 * 工具调用跟踪器 Hook 返回值接口
 */
export interface ToolCallTrackerReturn {
	/**
	 * 处理工具调用事件
	 * @param event - 工具调用事件
	 * @returns 更新后的工具调用步骤数组（如果有更新），否则返回 null
	 */
	handleToolEvent: (event: ToolCallEvent) => ToolCallStep[] | null;
	/** 获取当前所有工具调用步骤 */
	getToolCallSteps: () => ToolCallStep[];
	/** 重置跟踪器状态 */
	reset: () => void;
}

/**
 * 跟踪工具调用的状态（开始/完成）
 *
 * 支持：
 * - 处理 tool_call_start 事件（创建新的工具调用步骤）
 * - 处理 tool_call_end 事件（更新工具调用状态和结果）
 * - 获取当前所有工具调用步骤
 *
 * @returns 工具调用跟踪器方法
 */
export const useToolCallTracker = (): ToolCallTrackerReturn => {
	// 用于跟踪工具调用步骤的 Map
	const toolCallStepsMapRef = useRef<Map<string, ToolCallStep>>(new Map());

	const handleToolEvent = useCallback(
		(event: ToolCallEvent): ToolCallStep[] | null => {
			if (event.type === "tool_call_start" && event.tool_name) {
				// 创建新的工具调用步骤
				const stepId = `${event.tool_name}-${Date.now()}`;
				const newStep: ToolCallStep = {
					id: stepId,
					toolName: event.tool_name,
					toolArgs: event.tool_args,
					status: "running",
					startTime: Date.now(),
				};
				toolCallStepsMapRef.current.set(stepId, newStep);

				return Array.from(toolCallStepsMapRef.current.values());
			}

			if (event.type === "tool_call_end" && event.tool_name) {
				// 找到对应的工具调用步骤并更新状态
				const stepKey = Array.from(toolCallStepsMapRef.current.keys()).find(
					(key) => key.startsWith(event.tool_name as string),
				);

				if (stepKey) {
					const existingStep = toolCallStepsMapRef.current.get(stepKey);
					if (existingStep) {
						toolCallStepsMapRef.current.set(stepKey, {
							...existingStep,
							status: "completed",
							resultPreview: event.result_preview,
							endTime: Date.now(),
						});

						return Array.from(toolCallStepsMapRef.current.values());
					}
				}
			}

			// 其他事件类型（run_started, run_completed）不需要更新 UI
			return null;
		},
		[],
	);

	const getToolCallSteps = useCallback(() => {
		return Array.from(toolCallStepsMapRef.current.values());
	}, []);

	const reset = useCallback(() => {
		toolCallStepsMapRef.current.clear();
	}, []);

	return {
		handleToolEvent,
		getToolCallSteps,
		reset,
	};
};
