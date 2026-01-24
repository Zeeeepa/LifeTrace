import type { ChatMode } from "@/apps/chat/types";

/**
 * 消息构建参数
 */
export interface BuildPayloadMessageParams {
	chatMode: ChatMode;
	trimmedText: string;
	userLabel: string;
	todoContext: string;
	planSystemPrompt: string;
	editSystemPrompt: string;
}

/**
 * 消息构建结果
 */
export interface PayloadMessageResult {
	/** 发送给后端的完整消息 */
	payloadMessage: string;
	/** 系统提示词（可选，用于后端保存） */
	systemPromptForBackend?: string;
	/** 上下文（可选，用于后端保存） */
	contextForBackend?: string;
}

/**
 * 根据聊天模式构建发送给后端的 payload 消息
 *
 * @param params - 消息构建参数
 * @returns 构建好的消息结果
 */
export const buildPayloadMessage = (
	params: BuildPayloadMessageParams,
): PayloadMessageResult => {
	const {
		chatMode,
		trimmedText,
		userLabel,
		todoContext,
		planSystemPrompt,
		editSystemPrompt,
	} = params;

	let payloadMessage: string;
	let systemPromptForBackend: string | undefined;
	let contextForBackend: string | undefined;

	if (chatMode === "plan") {
		// Plan 模式：使用任务规划系统提示词
		systemPromptForBackend = planSystemPrompt;
		payloadMessage = `${planSystemPrompt}\n\n${userLabel}: ${trimmedText}`;
	} else if (chatMode === "edit") {
		// Edit 模式：结合待办上下文和编辑系统提示词
		systemPromptForBackend = editSystemPrompt;
		contextForBackend = todoContext;
		payloadMessage = `${editSystemPrompt}\n\n${todoContext}\n\n${userLabel}: ${trimmedText}`;
	} else if (chatMode === "difyTest") {
		// Dify 测试模式：直接使用用户输入，避免额外的系统提示词干扰
		payloadMessage = trimmedText;
	} else {
		// Ask 模式 (maps to agent) / Agno 模式：包含待办上下文，帮助理解用户意图
		contextForBackend = todoContext;
		payloadMessage = `${todoContext}\n\n${userLabel}: ${trimmedText}`;
	}

	return {
		payloadMessage,
		systemPromptForBackend,
		contextForBackend,
	};
};

/**
 * 将前端聊天模式映射为后端模式
 *
 * @param chatMode - 前端聊天模式
 * @returns 后端模式字符串
 */
export const getModeForBackend = (chatMode: ChatMode): string => {
	switch (chatMode) {
		case "difyTest":
			return "dify_test";
		case "ask":
			// ask 模式使用 agent（Agent会自动判断是否需要使用工具）
			return "agent";
		case "agno":
			// agno 模式使用 agno（启用工具调用事件流）
			return "agno";
		default:
			// plan, edit 等模式直接使用原始模式名
			return chatMode;
	}
};
