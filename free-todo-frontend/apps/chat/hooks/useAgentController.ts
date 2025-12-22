/**
 * useAgentController - Agent 模式控制器
 *
 * 管理 Agent 模式的状态和交互逻辑：
 * - 处理流式响应解析
 * - 管理待确认的编辑/拆解提议
 * - 处理多选题问答流程
 */

import { useCallback, useState } from "react";
import type {
	AgentDecomposeProposal,
	AgentEditProposal,
	AgentQuestion,
	AgentResponse,
	ChatMessage,
} from "@/apps/chat/types";
import {
	confirmAgentDecompose,
	confirmAgentEdit,
	sendAgentMessageStream,
} from "@/lib/api";

interface UseAgentControllerOptions {
	todoId?: number;
	onTodoUpdated?: () => void;
}

interface UseAgentControllerReturn {
	// 状态
	messages: ChatMessage[];
	isStreaming: boolean;
	error: string | null;
	conversationId: string | null;

	// 待处理的提议
	pendingEditProposal: AgentEditProposal | null;
	pendingDecomposeProposal: AgentDecomposeProposal | null;
	pendingQuestions: AgentQuestion[] | null;
	questionAnswers: Record<string, string[]>;

	// 操作
	sendMessage: (message: string) => Promise<void>;
	confirmEdit: () => Promise<void>;
	rejectEdit: () => void;
	confirmDecompose: () => Promise<void>;
	rejectDecompose: () => void;
	setQuestionAnswer: (questionId: string, answers: string[]) => void;
	submitQuestionAnswers: () => Promise<void>;
	clearMessages: () => void;
}

/**
 * 解析 Agent 响应 JSON
 */
function parseAgentResponse(text: string): AgentResponse | null {
	try {
		// 尝试从文本中提取 JSON
		const jsonMatch = text.match(/\{[\s\S]*\}/);
		if (!jsonMatch) return null;

		const parsed = JSON.parse(jsonMatch[0]);

		// 转换 snake_case 为 camelCase
		return {
			responseType: parsed.response_type,
			content: parsed.content,
			questions: parsed.questions,
			editProposal: parsed.edit_proposal
				? {
						field: parsed.edit_proposal.field,
						currentValue: parsed.edit_proposal.current_value,
						proposedValue: parsed.edit_proposal.proposed_value,
						reason: parsed.edit_proposal.reason,
					}
				: undefined,
			decomposeProposal: parsed.decompose_proposal
				? {
						subtasks: parsed.decompose_proposal.subtasks,
						reason: parsed.decompose_proposal.reason,
					}
				: undefined,
		};
	} catch {
		return null;
	}
}

export function useAgentController(
	options: UseAgentControllerOptions = {},
): UseAgentControllerReturn {
	const { todoId, onTodoUpdated } = options;

	// 基本状态
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [isStreaming, setIsStreaming] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [conversationId, setConversationId] = useState<string | null>(null);

	// 待处理的提议状态
	const [pendingEditProposal, setPendingEditProposal] =
		useState<AgentEditProposal | null>(null);
	const [pendingDecomposeProposal, setPendingDecomposeProposal] =
		useState<AgentDecomposeProposal | null>(null);
	const [pendingQuestions, setPendingQuestions] = useState<
		AgentQuestion[] | null
	>(null);
	const [questionAnswers, setQuestionAnswers] = useState<
		Record<string, string[]>
	>({});

	/**
	 * 发送消息给 Agent
	 */
	const sendMessage = useCallback(
		async (message: string) => {
			if (!message.trim() || isStreaming) return;

			setError(null);
			setIsStreaming(true);

			// 添加用户消息
			const userMessage: ChatMessage = {
				id: `user-${Date.now()}`,
				role: "user",
				content: message,
			};
			setMessages((prev) => [...prev, userMessage]);

			// 准备助手消息占位
			const assistantMessageId = `assistant-${Date.now()}`;
			setMessages((prev) => [
				...prev,
				{
					id: assistantMessageId,
					role: "assistant",
					content: "",
				},
			]);

			let fullResponse = "";

			try {
				// 构建对话历史
				const conversationHistory = messages.map((m) => ({
					role: m.role,
					content: m.content,
				}));

				await sendAgentMessageStream(
					{
						message,
						todoId,
						conversationId: conversationId ?? undefined,
						conversationHistory,
					},
					(chunk) => {
						fullResponse += chunk;
						// 更新流式消息
						setMessages((prev) =>
							prev.map((m) =>
								m.id === assistantMessageId
									? { ...m, content: fullResponse }
									: m,
							),
						);
					},
					(sessionId) => {
						setConversationId(sessionId);
					},
				);

				// 解析完整响应
				const parsed = parseAgentResponse(fullResponse);
				if (parsed) {
					switch (parsed.responseType) {
						case "message":
							// 对于 message 类型，更新消息内容为解析后的 content
							// 这样 MessageList 可以正常渲染 Markdown 内容
							if (parsed.content) {
								setMessages((prev) =>
									prev.map((m) =>
										m.id === assistantMessageId
											? { ...m, content: parsed.content }
											: m,
									),
								);
							}
							break;
						case "questions":
							if (parsed.questions) {
								setPendingQuestions(parsed.questions);
								setQuestionAnswers({});
								// 如果有 content，也更新消息内容
								if (parsed.content) {
									setMessages((prev) =>
										prev.map((m) =>
											m.id === assistantMessageId
												? { ...m, content: parsed.content }
												: m,
										),
									);
								}
							}
							break;
						case "edit_proposal":
							if (parsed.editProposal) {
								setPendingEditProposal(parsed.editProposal);
								// 如果有 content，也更新消息内容
								if (parsed.content) {
									setMessages((prev) =>
										prev.map((m) =>
											m.id === assistantMessageId
												? { ...m, content: parsed.content }
												: m,
										),
									);
								}
							}
							break;
						case "decompose_proposal":
							if (parsed.decomposeProposal) {
								setPendingDecomposeProposal(parsed.decomposeProposal);
								// 如果有 content，也更新消息内容
								if (parsed.content) {
									setMessages((prev) =>
										prev.map((m) =>
											m.id === assistantMessageId
												? { ...m, content: parsed.content }
												: m,
										),
									);
								}
							}
							break;
					}
				}
			} catch (err) {
				const errorMessage =
					err instanceof Error ? err.message : "发送消息失败";
				setError(errorMessage);
				// 移除失败的助手消息
				setMessages((prev) => prev.filter((m) => m.id !== assistantMessageId));
			} finally {
				setIsStreaming(false);
			}
		},
		[isStreaming, messages, todoId, conversationId],
	);

	/**
	 * 确认编辑提议
	 */
	const confirmEdit = useCallback(async () => {
		if (!pendingEditProposal || !todoId) return;

		try {
			const result = await confirmAgentEdit(
				todoId,
				pendingEditProposal.field,
				pendingEditProposal.proposedValue,
			);

			if (result.success) {
				// 添加确认消息
				setMessages((prev) => [
					...prev,
					{
						id: `system-${Date.now()}`,
						role: "assistant",
						content: `✅ ${result.message || "编辑已应用"}`,
					},
				]);
				setPendingEditProposal(null);
				onTodoUpdated?.();
			} else {
				setError(result.error || "编辑失败");
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "确认编辑失败");
		}
	}, [pendingEditProposal, todoId, onTodoUpdated]);

	/**
	 * 拒绝编辑提议
	 */
	const rejectEdit = useCallback(() => {
		setPendingEditProposal(null);
		setMessages((prev) => [
			...prev,
			{
				id: `system-${Date.now()}`,
				role: "assistant",
				content: "已取消编辑",
			},
		]);
	}, []);

	/**
	 * 确认拆解提议
	 */
	const confirmDecompose = useCallback(async () => {
		if (!pendingDecomposeProposal || !todoId) return;

		try {
			const result = await confirmAgentDecompose(
				todoId,
				pendingDecomposeProposal.subtasks,
			);

			if (result.success) {
				setMessages((prev) => [
					...prev,
					{
						id: `system-${Date.now()}`,
						role: "assistant",
						content: `✅ ${result.message || "已创建子任务"}`,
					},
				]);
				setPendingDecomposeProposal(null);
				onTodoUpdated?.();
			} else {
				setError(result.error || "拆解失败");
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "确认拆解失败");
		}
	}, [pendingDecomposeProposal, todoId, onTodoUpdated]);

	/**
	 * 拒绝拆解提议
	 */
	const rejectDecompose = useCallback(() => {
		setPendingDecomposeProposal(null);
		setMessages((prev) => [
			...prev,
			{
				id: `system-${Date.now()}`,
				role: "assistant",
				content: "已取消拆解",
			},
		]);
	}, []);

	/**
	 * 设置问题答案
	 */
	const setQuestionAnswer = useCallback(
		(questionId: string, answers: string[]) => {
			setQuestionAnswers((prev) => ({
				...prev,
				[questionId]: answers,
			}));
		},
		[],
	);

	/**
	 * 提交问题答案
	 */
	const submitQuestionAnswers = useCallback(async () => {
		if (!pendingQuestions) return;

		// 构建答案消息
		const answerText = pendingQuestions
			.map((q) => {
				const answers = questionAnswers[q.id] || [];
				return `${q.question}: ${answers.join(", ") || "未回答"}`;
			})
			.join("\n");

		setPendingQuestions(null);
		setQuestionAnswers({});

		// 发送答案作为新消息
		await sendMessage(`我的回答：\n${answerText}`);
	}, [pendingQuestions, questionAnswers, sendMessage]);

	/**
	 * 清空消息
	 */
	const clearMessages = useCallback(() => {
		setMessages([]);
		setConversationId(null);
		setPendingEditProposal(null);
		setPendingDecomposeProposal(null);
		setPendingQuestions(null);
		setQuestionAnswers({});
		setError(null);
	}, []);

	return {
		messages,
		isStreaming,
		error,
		conversationId,
		pendingEditProposal,
		pendingDecomposeProposal,
		pendingQuestions,
		questionAnswers,
		sendMessage,
		confirmEdit,
		rejectEdit,
		confirmDecompose,
		rejectDecompose,
		setQuestionAnswer,
		submitQuestionAnswers,
		clearMessages,
	};
}

