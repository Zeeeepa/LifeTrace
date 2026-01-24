import { useTranslations } from "next-intl";
import type { KeyboardEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { usePlanParser } from "@/apps/chat/hooks/usePlanParser";
import type { ChatMessage, ToolCallStep } from "@/apps/chat/types";
import { createId } from "@/apps/chat/utils/id";
import {
	buildHierarchicalTodoContext,
	buildTodoContextBlock,
} from "@/apps/chat/utils/todoContext";
import type { ChatHistoryItem, ToolCallEvent } from "@/lib/api";
import { sendChatMessageStream } from "@/lib/api";
import { getChatPromptsApiGetChatPromptsGet } from "@/lib/generated/config/config";
import { useChatHistory, useChatSessions, useTodos } from "@/lib/query";
import { useChatStore } from "@/lib/store/chat-store";
import { useUiStore } from "@/lib/store/ui-store";
import type { CreateTodoInput, Todo } from "@/lib/types";

type UseChatControllerParams = {
	locale: string;
	selectedTodoIds: number[];
	createTodo: (todo: CreateTodoInput) => Promise<Todo | null>;
};

export const useChatController = ({
	locale,
	selectedTodoIds,
	createTodo,
}: UseChatControllerParams) => {
	const t = useTranslations("chat");
	const tCommon = useTranslations("common");
	const { planSystemPrompt, parsePlanTodos, buildTodoPayloads } = usePlanParser(
		locale,
		t,
	);

	// 从 API 获取编辑模式系统提示词
	const [editSystemPrompt, setEditSystemPrompt] = useState<string>("");

	useEffect(() => {
		let cancelled = false;
		async function loadPrompts() {
			try {
				const response = (await getChatPromptsApiGetChatPromptsGet({
					locale,
				})) as {
					success: boolean;
					editSystemPrompt: string;
					planSystemPrompt: string;
				};
				if (!cancelled && response.success) {
					setEditSystemPrompt(response.editSystemPrompt);
				}
			} catch (error) {
				console.error("Failed to load chat prompts:", error);
				// 如果加载失败，使用空字符串（向后兼容）
				if (!cancelled) {
					setEditSystemPrompt("");
				}
			}
		}
		void loadPrompts();
		return () => {
			cancelled = true;
		};
	}, [locale]);

	// 从 TanStack Query 获取 todos 数据
	const { data: todos = [] } = useTodos();

	// 使用 chat-store 管理持久化状态
	const {
		chatMode,
		conversationId,
		historyOpen,
		setChatMode,
		setConversationId,
		setHistoryOpen,
	} = useChatStore();

	// 从 ui-store 读取选中的 Agno 工具
	const selectedAgnoTools = useUiStore((state) => state.selectedAgnoTools);

	// 调试：打印 selectedAgnoTools 的值
	useEffect(() => {
		console.log("[useChatController] Current selectedAgnoTools:", selectedAgnoTools);
	}, [selectedAgnoTools]);

	// 使用 TanStack Query 获取会话列表
	const {
		data: sessions = [],
		isLoading: historyLoading,
		error: sessionsError,
	} = useChatSessions({
		enabled: historyOpen,
	});

	// 使用 TanStack Query 获取当前会话的历史记录
	const { data: sessionHistory = [] } = useChatHistory(conversationId);

	const [messages, setMessages] = useState<ChatMessage[]>(() => []);
	const [inputValue, setInputValue] = useState("");
	const [isStreaming, setIsStreaming] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isComposing, setIsComposing] = useState(false);
	// 使用ref跟踪上一次的conversationId，只在conversationId改变时加载history
	const prevConversationIdRef = useRef<string | null>(null);
	// 跟踪是否是主动加载历史记录（点击历史记录）vs 发送消息后的被动更新
	const isLoadingSessionRef = useRef<boolean>(false);
	// 用于取消流式请求的 AbortController
	const abortControllerRef = useRef<AbortController | null>(null);
	// 跟踪当前活跃的请求 ID，用于在切换对话时忽略旧请求的 UI 更新
	const activeRequestIdRef = useRef<string | null>(null);

	const historyError = sessionsError ? t("loadHistoryFailed") : null;

	const selectedTodos = useMemo(
		() => todos.filter((todo: Todo) => selectedTodoIds.includes(todo.id)),
		[selectedTodoIds, todos],
	) as Todo[];
	const effectiveTodos = useMemo(
		() => (selectedTodos.length ? selectedTodos : []),
		[selectedTodos],
	);
	const hasSelection = selectedTodoIds.length > 0;

	// keepStreaming: 如果为 true，不中断当前流式输出，让它在后台继续
	const handleNewChat = useCallback(
		(keepStreaming = false) => {
			if (!keepStreaming) {
				// 如果正在流式输出，先停止
				if (abortControllerRef.current) {
					abortControllerRef.current.abort();
					abortControllerRef.current = null;
				}
				setIsStreaming(false);
			}
			// 清空活跃请求 ID，让旧请求的回调忽略 UI 更新
			activeRequestIdRef.current = null;
			setConversationId(null);
			setMessages([]);
			setInputValue("");
			setError(null);
			setHistoryOpen(false);
		},
		[setConversationId, setHistoryOpen],
	);

	const handleStop = useCallback(() => {
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
			abortControllerRef.current = null;
			setIsStreaming(false);
		}
	}, []);


	const handleLoadSession = useCallback(
		async (sessionId: string) => {
			// 标记为主动加载历史记录
			isLoadingSessionRef.current = true;
			// 使用 TanStack Query 的数据
			// 当 conversationId 改变时，useChatHistory 会自动获取新的历史记录
			setConversationId(sessionId);
			setHistoryOpen(false);
		},
		[setConversationId, setHistoryOpen],
	);

	// 当会话历史加载完成后，更新 messages（仅在主动加载历史记录时）
	useEffect(() => {
		// 如果正在流式传输，不要覆盖消息
		if (isStreaming) {
			return;
		}

		// 更新prevConversationIdRef
		const conversationIdChanged =
			prevConversationIdRef.current !== conversationId;
		if (conversationIdChanged) {
			prevConversationIdRef.current = conversationId;
		}

		// 只有在主动加载历史记录时才用history覆盖messages
		// 发送消息后的history更新不应该覆盖当前正在显示的消息
		if (!isLoadingSessionRef.current) {
			return;
		}

		if (sessionHistory.length > 0 && conversationId) {
			const mapped = sessionHistory.map((item: ChatHistoryItem) => ({
				id: createId(),
				role: item.role,
				content: item.content,
			}));
			setMessages(mapped);
			// 加载完成，重置标志
			isLoadingSessionRef.current = false;
		}
		// 如果conversationId存在但历史记录为空，可能是正在加载，保持标志为true等待数据
	}, [sessionHistory, conversationId, isStreaming]);

	// 核心发送消息逻辑，接受文本参数直接发送
	// clearInput: 是否清空输入框（普通发送时为 true，预设按钮发送时为 false）
	const sendMessage = useCallback(
		async (text: string, clearInput = false) => {
			const trimmedText = text.trim();
			if (!trimmedText) return;

			// 生成当前请求的唯一 ID
			const requestId = createId();
			activeRequestIdRef.current = requestId;

			// 检查 prompt 是否已加载（plan 和 edit 模式需要）
			if (chatMode === "plan" && !planSystemPrompt) {
				setError(t("promptNotLoaded") || "提示词正在加载中，请稍候...");
				return;
			}
			if (chatMode === "edit" && !editSystemPrompt) {
				setError(t("promptNotLoaded") || "提示词正在加载中，请稍候...");
				return;
			}

			if (clearInput) {
				setInputValue("");
			}
			setError(null);

			// 当有选中待办时，使用完整的层级上下文（包含所有参数和父子关系）
			// 否则使用简单的空上下文提示
			const todoContext = hasSelection
				? buildHierarchicalTodoContext(effectiveTodos, todos, t, tCommon)
				: buildTodoContextBlock([], t("noTodoContext"), t);
			const userLabel = t("userInput");

			// Build payload message based on chat mode
			let payloadMessage: string;
			if (chatMode === "plan") {
				payloadMessage = `${planSystemPrompt}\n\n${userLabel}: ${trimmedText}`;
			} else if (chatMode === "edit") {
				// Edit mode: combine todo context with edit system prompt
				payloadMessage = `${editSystemPrompt}\n\n${todoContext}\n\n${userLabel}: ${trimmedText}`;
			} else if (chatMode === "difyTest") {
				// Dify 测试模式：直接把用户输入作为消息，避免额外的前置 system prompt 干扰
				payloadMessage = trimmedText;
			} else {
				// Ask mode: 包含待办上下文，帮助理解用户意图
				payloadMessage = `${todoContext}\n\n${userLabel}: ${trimmedText}`;
			}
			const userMessage: ChatMessage = {
				id: createId(),
				role: "user",
				content: trimmedText,
			};
			const assistantMessageId = createId();

			setMessages((prev) => [
				...prev,
				userMessage,
				{ id: assistantMessageId, role: "assistant", content: "" },
			]);
			setIsStreaming(true);

			// 创建新的 AbortController
			const abortController = new AbortController();
			abortControllerRef.current = abortController;

			let assistantContent = "";
			// 用于跟踪工具调用步骤
			const toolCallStepsMap = new Map<string, ToolCallStep>();

			try {
				// 根据聊天模式选择后端模式
				// ask 模式使用 agent（Agent会自动判断是否需要使用工具）
				// agno 模式使用 agno（启用工具调用事件流）
				const modeForBackend =
					chatMode === "difyTest"
						? "dify_test"
						: chatMode === "ask"
							? "agent"
							: chatMode === "agno"
								? "agno"
								: chatMode;

				// 调试日志：查看选中的工具和模式
				console.log("[useChatController] chatMode:", chatMode);
				console.log("[useChatController] modeForBackend:", modeForBackend);
				console.log("[useChatController] selectedAgnoTools:", selectedAgnoTools);
				console.log(
					"[useChatController] Will send selectedTools:",
					chatMode === "agno" ? selectedAgnoTools : undefined,
				);

				await sendChatMessageStream(
					{
						message: payloadMessage,
						conversationId: conversationId || undefined,
						// 当发送格式化消息（包含todo上下文）时，设置useRag=false
						// 因为前端已经构建了完整的prompt，后端只需要解析并保存用户输入部分
						// agent 模式使用 useRag=false，因为工具调用逻辑在后端独立处理
						useRag: false,
						mode: modeForBackend,
						// Agno 模式下传递选中的工具列表
						selectedTools: chatMode === "agno" ? selectedAgnoTools : undefined,
					},
					(chunk) => {
						// 检查是否已取消或请求已不再活跃（用户切换到了新对话）
						if (
							abortController.signal.aborted ||
							activeRequestIdRef.current !== requestId
						) {
							return;
						}
						assistantContent += chunk;
						// 使用 flushSync 强制同步更新，确保流式输出效果
						flushSync(() => {
							setMessages((prev) =>
								prev.map((msg) =>
									msg.id === assistantMessageId
										? {
												...msg,
												content: assistantContent,
												toolCallSteps: Array.from(toolCallStepsMap.values()),
											}
										: msg,
								),
							);
						});
					},
					(sessionId) => {
						setConversationId(conversationId || sessionId);
					},
					abortController.signal,
					locale,
					// 工具调用事件处理器
					(event: ToolCallEvent) => {
						// 检查是否已取消或请求已不再活跃
						if (
							abortController.signal.aborted ||
							activeRequestIdRef.current !== requestId
						) {
							return;
						}

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
							toolCallStepsMap.set(stepId, newStep);

							// 立即更新消息以显示新的工具调用步骤
							flushSync(() => {
								setMessages((prev) =>
									prev.map((msg) =>
										msg.id === assistantMessageId
											? {
													...msg,
													toolCallSteps: Array.from(toolCallStepsMap.values()),
												}
											: msg,
									),
								);
							});
						} else if (event.type === "tool_call_end" && event.tool_name) {
							// 找到对应的工具调用步骤并更新状态
							const stepKey = Array.from(toolCallStepsMap.keys()).find((key) =>
								key.startsWith(event.tool_name as string),
							);
							if (stepKey) {
								const existingStep = toolCallStepsMap.get(stepKey);
								if (existingStep) {
									toolCallStepsMap.set(stepKey, {
										...existingStep,
										status: "completed",
										resultPreview: event.result_preview,
										endTime: Date.now(),
									});

									// 更新消息以显示完成状态
									flushSync(() => {
										setMessages((prev) =>
											prev.map((msg) =>
												msg.id === assistantMessageId
													? {
															...msg,
															toolCallSteps: Array.from(
																toolCallStepsMap.values(),
															),
														}
													: msg,
											),
										);
									});
								}
							}
						}
					},
				);

				if (!assistantContent) {
					const fallback = t("noResponseReceived");
					setMessages((prev) =>
						prev.map((msg) =>
							msg.id === assistantMessageId
								? { ...msg, content: fallback }
								: msg,
						),
					);
				} else if (chatMode === "plan") {
					const { todos: parsedTodos, error: parseError } =
						parsePlanTodos(assistantContent);
					if (parseError) {
						setMessages((prev) =>
							prev.map((msg) =>
								msg.id === assistantMessageId
									? { ...msg, content: `${assistantContent}\n\n${parseError}` }
									: msg,
							),
						);
						setError(parseError);
					} else {
						const payloads = buildTodoPayloads(parsedTodos);

						// plan 模式：payloads 内的 id / parentTodoId 是前端临时 id（UUID），
						// 需要顺序创建并把 parent 映射为后端数值 id
						const clientIdToApiId = new Map<string, number>();
						let successCount = 0;
						for (const draft of payloads) {
							const clientId = draft.id ?? createId();
							const parentClientId = draft.parentTodoId;
							const apiParentId =
								typeof parentClientId === "string"
									? (clientIdToApiId.get(parentClientId) ?? null)
									: (parentClientId ?? null);

							// Create payload without the temporary string ID
							const { id: _tempId, ...createPayload } = draft;
							const created = await createTodo({
								...createPayload,
								// 若父任务未成功创建，则降级为根任务（避免整棵子树丢失）
								parentTodoId: apiParentId,
							});
							if (created) {
								clientIdToApiId.set(clientId, created.id);
								successCount += 1;
							}
						}

						const addedText = t("addedTodos", { count: successCount });
						setMessages((prev) =>
							prev.map((msg) =>
								msg.id === assistantMessageId
									? { ...msg, content: `${assistantContent}\n\n${addedText}` }
									: msg,
							),
						);
					}
				}
			} catch (err) {
				// 如果是用户主动取消，不显示错误
				if (
					abortController.signal.aborted ||
					(err instanceof Error && err.name === "AbortError")
				) {
					// 如果已收到部分内容，保留它
					if (assistantContent) {
						// 内容已更新，不需要额外操作
					} else {
						// 如果没有内容，移除空的助手消息
						setMessages((prev) =>
							prev.filter((msg) => msg.id !== assistantMessageId),
						);
					}
				} else {
					console.error(err);
					const fallback = t("errorOccurred");
					setMessages((prev) =>
						prev.map((msg) =>
							msg.id === assistantMessageId
								? { ...msg, content: fallback }
								: msg,
						),
					);
					setError(fallback);
				}
			} finally {
				// 只有当这个请求仍然是活跃请求时，才更新全局状态
				if (activeRequestIdRef.current === requestId) {
					abortControllerRef.current = null;
					setIsStreaming(false);
				}
			}
		},
		[
			buildTodoPayloads,
			chatMode,
			conversationId,
			createTodo,
			editSystemPrompt,
			effectiveTodos,
			hasSelection,
			locale,
			parsePlanTodos,
			planSystemPrompt,
			selectedAgnoTools,
			t,
			tCommon,
			todos,
			setConversationId,
		],
	);

	// 处理普通发送（从输入框发送）
	const handleSend = useCallback(async () => {
		await sendMessage(inputValue, true);
	}, [sendMessage, inputValue]);

	const handleKeyDown = useCallback(
		(event: KeyboardEvent<HTMLTextAreaElement>) => {
			if (
				event.key === "Enter" &&
				!event.shiftKey &&
				!isComposing &&
				!event.nativeEvent.isComposing
			) {
				event.preventDefault();
				void handleSend();
			}
		},
		[handleSend, isComposing],
	);

	return {
		chatMode,
		setChatMode,
		messages,
		setMessages,
		inputValue,
		setInputValue,
		conversationId,
		setConversationId,
		isStreaming,
		setIsStreaming,
		error,
		setError,
		historyOpen,
		setHistoryOpen,
		historyLoading,
		historyError,
		sessions,
		isComposing,
		setIsComposing,
		sendMessage,
		handleSend,
		handleStop,
		handleNewChat,
		handleLoadSession,
		handleKeyDown,
		effectiveTodos,
		hasSelection,
		editSystemPrompt,
		planSystemPrompt,
		parsePlanTodos,
		buildTodoPayloads,
		todos,
	};
};
