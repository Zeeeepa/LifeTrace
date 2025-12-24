"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { HeaderBar } from "@/apps/chat/HeaderBar";
import { HistoryDrawer } from "@/apps/chat/HistoryDrawer";
import { useChatController } from "@/apps/chat/hooks/useChatController";
import { usePlanParser } from "@/apps/chat/hooks/usePlanParser";
import { usePlanService } from "@/apps/chat/hooks/usePlanService";
import { InputBox } from "@/apps/chat/InputBox";
import { LinkedTodos } from "@/apps/chat/LinkedTodos";
import { MessageList } from "@/apps/chat/MessageList";
import { ModeSwitcher } from "@/apps/chat/ModeSwitcher";
import { PlanSummary } from "@/apps/chat/PlanSummary";
import { Questionnaire } from "@/apps/chat/Questionnaire";
import { SummaryStreaming } from "@/apps/chat/SummaryStreaming";
import type { ChatMessage } from "@/apps/chat/types";
import { createId } from "@/apps/chat/utils/id";
import {
	buildHierarchicalTodoContext,
	buildTodoContextBlock,
} from "@/apps/chat/utils/todoContext";
import { sendChatMessageStream } from "@/lib/api";
import { getChatPromptsApiGetChatPromptsGet } from "@/lib/generated/config/config";
import { useCreateTodo, useTodos, useUpdateTodo } from "@/lib/query";
import { useLocaleStore } from "@/lib/store/locale";
import { usePlanStore } from "@/lib/store/plan-store";
import { useTodoStore } from "@/lib/store/todo-store";
import type { CreateTodoInput, Todo } from "@/lib/types";

export function ChatPanel() {
	const { locale } = useLocaleStore();
	const tChat = useTranslations("chat");
	const tPage = useTranslations("page");
	const tCommon = useTranslations("common");

	// 从 TanStack Query 获取 todos 数据（用于 Plan 功能）
	const { data: todos = [] } = useTodos();

	// 从 TanStack Query 获取创建 todo 的 mutation
	const createTodoMutation = useCreateTodo();

	// 从 TanStack Query 获取更新 todo 的 mutation（用于 Edit 模式）
	const updateTodoMutation = useUpdateTodo();

	// 包装 createTodo 函数以匹配 useChatController 期望的签名
	const createTodoWithResult = useCallback(
		async (input: CreateTodoInput): Promise<Todo | null> => {
			try {
				return await createTodoMutation.mutateAsync(input);
			} catch (error) {
				console.error("Failed to create todo:", error);
				return null;
			}
		},
		[createTodoMutation],
	);

	// 从 Zustand 获取 UI 状态
	const { selectedTodoIds, clearTodoSelection, toggleTodoSelection } =
		useTodoStore();

	// Plan功能相关状态
	const {
		activePlanTodoId,
		stage,
		questions,
		answers,
		summary,
		subtasks,
		isLoading: planLoading,
		isGeneratingSummary,
		summaryStreamingText,
		isGeneratingQuestions,
		questionStreamingCount,
		questionStreamingTitle,
		error: planError,
		setQuestions,
		setAnswer,
		setSummary,
		setSummaryStreaming,
		setIsGeneratingSummary,
		setQuestionStreaming,
		setIsGeneratingQuestions,
		applyPlan,
	} = usePlanStore();

	const { generateQuestions, generateSummary } = usePlanService();

	// 获取plan parser相关函数和prompt
	const { planSystemPrompt, parsePlanTodos, buildTodoPayloads } = usePlanParser(
		locale,
		tChat,
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

	// 获取当前正在规划的待办
	const activePlanTodo = useMemo(() => {
		if (!activePlanTodoId) return null;
		return todos.find((todo: Todo) => todo.id === activePlanTodoId) || null;
	}, [activePlanTodoId, todos]);

	// 当进入questionnaire阶段时，生成选择题
	useEffect(() => {
		if (
			stage === "questionnaire" &&
			activePlanTodo &&
			questions.length === 0 &&
			planLoading
		) {
			let cancelled = false;
			const generate = async () => {
				try {
					console.log(
						"开始生成选择题，任务名称:",
						activePlanTodo.name,
						"任务ID:",
						activePlanTodo.id,
					);
					setIsGeneratingQuestions(true);
					const generatedQuestions = await generateQuestions(
						activePlanTodo.name,
						activePlanTodo.id,
						(count, title) => {
							// 流式更新问题生成进度
							if (!cancelled) {
								setQuestionStreaming(count, title);
							}
						},
					);
					if (!cancelled) {
						console.log("生成的选择题:", generatedQuestions);
						setQuestions(generatedQuestions);
						setIsGeneratingQuestions(false);
					}
				} catch (error) {
					if (!cancelled) {
						console.error("Failed to generate questions:", error);
						// 错误处理：设置错误状态
						usePlanStore.setState({
							error:
								error instanceof Error
									? error.message
									: tChat("generateQuestionsFailed"),
							isLoading: false,
							isGeneratingQuestions: false,
						});
					}
				}
			};
			void generate();
			return () => {
				cancelled = true;
			};
		}
	}, [
		stage,
		activePlanTodo,
		questions.length,
		planLoading,
		generateQuestions,
		setQuestions,
		setQuestionStreaming,
		setIsGeneratingQuestions,
		tChat,
	]);

	// 处理提交回答
	const handleSubmitAnswers = useCallback(async () => {
		if (!activePlanTodo) return;

		try {
			// 设置生成状态
			setIsGeneratingSummary(true);
			setSummaryStreaming("");

			// 流式生成总结
			const result = await generateSummary(
				activePlanTodo.name,
				answers,
				(streamingText) => {
					// 实时更新流式文本
					setSummaryStreaming(streamingText);
				},
			);

			// 生成完成，设置最终结果
			setSummary(result.summary, result.subtasks);
		} catch (error) {
			console.error("Failed to generate summary:", error);
			setIsGeneratingSummary(false);
			setSummaryStreaming(null);
			// 设置错误状态
			usePlanStore.setState({
				error:
					error instanceof Error
						? error.message
						: tChat("generateSummaryFailed"),
			});
		}
	}, [
		activePlanTodo,
		answers,
		generateSummary,
		setSummary,
		setIsGeneratingSummary,
		setSummaryStreaming,
		tChat,
	]);

	// 处理接收计划
	const handleAcceptPlan = useCallback(async () => {
		await applyPlan();
	}, [applyPlan]);

	const [modeMenuOpen, setModeMenuOpen] = useState(false);
	const [showTodosExpanded, setShowTodosExpanded] = useState(false);
	const modeMenuRef = useRef<HTMLDivElement | null>(null);

	const {
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
		setIsComposing,
		handleSend,
		handleNewChat,
		handleLoadSession,
		handleKeyDown,
		effectiveTodos,
		hasSelection,
	} = useChatController({
		locale,
		selectedTodoIds,
		createTodo: createTodoWithResult,
	});

	// 处理预设prompt选择：直接发送消息，不设置到输入框
	const handleSelectPrompt = useCallback(
		async (prompt: string) => {
			const text = prompt.trim();
			if (!text || isStreaming) return;

			// 检查 prompt 是否已加载（plan 和 edit 模式需要）
			if (chatMode === "plan" && !planSystemPrompt) {
				setError(tChat("promptNotLoaded") || "提示词正在加载中，请稍候...");
				return;
			}
			if (chatMode === "edit" && !editSystemPrompt) {
				setError(tChat("promptNotLoaded") || "提示词正在加载中，请稍候...");
				return;
			}

			setError(null);

			// 当有选中待办时，使用完整的层级上下文（包含所有参数和父子关系）
			// 否则使用简单的空上下文提示
			const todoContext = hasSelection
				? buildHierarchicalTodoContext(effectiveTodos, todos, tChat, tCommon)
				: buildTodoContextBlock([], tChat("noTodoContext"), tChat);
			const userLabel = tChat("userInput");

			// Build payload message based on chat mode
			let payloadMessage: string;
			if (chatMode === "plan") {
				payloadMessage = `${planSystemPrompt}\n\n${userLabel}: ${text}`;
			} else if (chatMode === "edit") {
				// Edit mode: combine todo context with edit system prompt
				payloadMessage = `${editSystemPrompt}\n\n${todoContext}\n\n${userLabel}: ${text}`;
			} else if (chatMode === "difyTest") {
				// Dify 测试模式：直接把用户输入作为消息
				payloadMessage = text;
			} else {
				// Ask mode: just todo context
				payloadMessage = `${todoContext}\n\n${userLabel}: ${text}`;
			}

			const userMessage: ChatMessage = {
				id: createId(),
				role: "user",
				content: text,
			};
			const assistantMessageId = createId();

			setMessages((prev) => [
				...prev,
				userMessage,
				{ id: assistantMessageId, role: "assistant", content: "" },
			]);
			setIsStreaming(true);

			let assistantContent = "";

			try {
				const modeForBackend = chatMode === "difyTest" ? "dify_test" : chatMode;

				await sendChatMessageStream(
					{
						message: payloadMessage,
						conversationId: conversationId || undefined,
						// 当发送格式化消息（包含todo上下文）时，设置useRag=false
						useRag: false,
						mode: modeForBackend,
					},
					(chunk) => {
						assistantContent += chunk;
						// 使用 flushSync 强制同步更新，确保流式输出效果
						flushSync(() => {
							setMessages((prev) =>
								prev.map((msg) =>
									msg.id === assistantMessageId
										? { ...msg, content: assistantContent }
										: msg,
								),
							);
						});
					},
					(sessionId) => {
						setConversationId(conversationId || sessionId);
					},
				);

				if (!assistantContent) {
					const fallback = tChat("noResponseReceived");
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
							const created = await createTodoWithResult({
								...createPayload,
								// 若父任务未成功创建，则降级为根任务（避免整棵子树丢失）
								parentTodoId: apiParentId,
							});
							if (created) {
								clientIdToApiId.set(clientId, created.id);
								successCount += 1;
							}
						}

						const addedText = tChat("addedTodos", { count: successCount });
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
				console.error(err);
				const fallback = tChat("errorOccurred");
				setMessages((prev) =>
					prev.map((msg) =>
						msg.id === assistantMessageId ? { ...msg, content: fallback } : msg,
					),
				);
				setError(fallback);
			} finally {
				setIsStreaming(false);
			}
		},
		[
			isStreaming,
			chatMode,
			planSystemPrompt,
			editSystemPrompt,
			hasSelection,
			effectiveTodos,
			todos,
			tChat,
			tCommon,
			conversationId,
			setConversationId,
			parsePlanTodos,
			buildTodoPayloads,
			createTodoWithResult,
			setMessages,
			setIsStreaming,
			setError,
		],
	);

	const typingText = useMemo(() => tChat("aiThinking"), [tChat]);

	const inputPlaceholder =
		chatMode === "plan"
			? tChat("planModeInputPlaceholder")
			: chatMode === "edit"
				? tChat("editMode.inputPlaceholder")
				: chatMode === "difyTest"
					? tChat("difyTest.inputPlaceholder")
					: tPage("chatInputPlaceholder");

	const formatMessageCount = useCallback(
		(count?: number) => tPage("messagesCount", { count: count ?? 0 }),
		[tPage],
	);

	useEffect(() => {
		if (!modeMenuOpen) return;
		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as Node;
			if (modeMenuRef.current?.contains(target)) return;
			setModeMenuOpen(false);
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [modeMenuOpen]);

	return (
		<div className="flex h-full flex-col bg-background">
			<HeaderBar
				chatHistoryLabel={tPage("chatHistory")}
				newChatLabel={tPage("newChat")}
				onToggleHistory={() => setHistoryOpen(!historyOpen)}
				onNewChat={handleNewChat}
			/>

			{historyOpen && (
				<HistoryDrawer
					historyLoading={historyLoading}
					historyError={historyError}
					sessions={sessions}
					conversationId={conversationId}
					formatMessageCount={formatMessageCount}
					labels={{
						recentSessions: tPage("recentSessions"),
						noHistory: tPage("noHistory"),
						loading: tChat("loading"),
						chatHistory: tPage("chatHistory"),
					}}
					onSelectSession={handleLoadSession}
				/>
			)}

			{/* Plan功能：根据阶段显示不同内容 */}
			{stage === "questionnaire" &&
				(questions.length > 0 ? (
					<Questionnaire
						questions={questions}
						answers={answers}
						onAnswerChange={setAnswer}
						onSubmit={handleSubmitAnswers}
						isSubmitting={isGeneratingSummary}
						disabled={isGeneratingSummary}
					/>
				) : (
					<div className="flex-1 flex items-center justify-center">
						<div className="text-center space-y-3">
							{isGeneratingQuestions && questionStreamingCount > 0 ? (
								<div className="flex flex-col items-center gap-2">
									<div className="flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm text-muted-foreground">
										<Loader2 className="h-4 w-4 animate-spin" />
										<span>
											{tChat("generatingQuestion", {
												count: questionStreamingCount,
											})}
										</span>
									</div>
									{questionStreamingTitle && (
										<p className="text-sm text-foreground max-w-md">
											{questionStreamingTitle}
										</p>
									)}
								</div>
							) : (
								<p className="text-muted-foreground">
									{tChat("generatingQuestions")}
								</p>
							)}
							{planError && (
								<p className="mt-2 text-sm text-destructive">{planError}</p>
							)}
						</div>
					</div>
				))}

			{/* 流式生成总结阶段 */}
			{isGeneratingSummary && (
				<SummaryStreaming streamingText={summaryStreamingText || ""} />
			)}

			{/* 总结展示阶段（生成完成后） */}
			{stage === "summary" && summary && subtasks && !isGeneratingSummary && (
				<PlanSummary
					summary={summary}
					subtasks={subtasks}
					onAccept={handleAcceptPlan}
					isApplying={planLoading}
					locale={locale}
				/>
			)}

			{/* 正常聊天模式 */}
			{(stage === "idle" || stage === "completed") && (
				<MessageList
					messages={messages}
					isStreaming={isStreaming}
					typingText={typingText}
					locale={locale}
					chatMode={chatMode}
					effectiveTodos={effectiveTodos}
					onUpdateTodo={updateTodoMutation.mutateAsync}
					isUpdating={updateTodoMutation.isPending}
					onSelectPrompt={handleSelectPrompt}
				/>
			)}

			<div className="bg-background p-4">
				<InputBox
					linkedTodos={
						<LinkedTodos
							effectiveTodos={effectiveTodos}
							hasSelection={hasSelection}
							locale={locale}
							showTodosExpanded={showTodosExpanded}
							onToggleExpand={() => setShowTodosExpanded((prev) => !prev)}
							onClearSelection={clearTodoSelection}
							onToggleTodo={toggleTodoSelection}
						/>
					}
					modeSwitcher={
						<div className="relative" ref={modeMenuRef}>
							<ModeSwitcher
								chatMode={chatMode}
								locale={locale}
								modeMenuOpen={modeMenuOpen}
								onToggleMenu={() => setModeMenuOpen((prev) => !prev)}
								onChangeMode={(mode) => {
									setChatMode(mode);
									setModeMenuOpen(false);
								}}
								variant="inline"
							/>
						</div>
					}
					inputValue={inputValue}
					placeholder={inputPlaceholder}
					isStreaming={isStreaming}
					locale={locale}
					onChange={setInputValue}
					onSend={handleSend}
					onKeyDown={handleKeyDown}
					onCompositionStart={() => setIsComposing(true)}
					onCompositionEnd={() => setIsComposing(false)}
				/>

				{error && <p className="mt-2 text-sm text-destructive">{error}</p>}
			</div>
		</div>
	);
}
