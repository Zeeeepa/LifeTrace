"use client";

import {
	ChevronRight,
	History,
	Loader2,
	Plus,
	Send,
	Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChatHistoryItem, ChatSessionSummary } from "@/lib/api";
import { getChatHistory, sendChatMessageStream } from "@/lib/api";
import { useTranslations } from "@/lib/i18n";
import { useLocaleStore } from "@/lib/store/locale";
import { cn } from "@/lib/utils";

type ChatMessage = {
	id: string;
	role: "user" | "assistant";
	content: string;
};

const createId = () => {
	if (typeof crypto !== "undefined" && crypto.randomUUID) {
		return crypto.randomUUID();
	}
	return `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const buildWelcomeMessage = (locale: string): ChatMessage => ({
	id: createId(),
	role: "assistant",
	content:
		locale === "zh"
			? "你好，我是你的待办助手，可以帮你拆解任务、制定计划，也能聊聊生活。"
			: "Hi! I'm your task assistant. I can break down work, plan the day, or just chat.",
});

export function ChatPanel() {
	const { locale } = useLocaleStore();
	const t = useTranslations(locale);
	const [messages, setMessages] = useState<ChatMessage[]>(() => [
		buildWelcomeMessage(locale),
	]);
	const [inputValue, setInputValue] = useState("");
	const [conversationId, setConversationId] = useState<string | null>(null);
	const [isStreaming, setIsStreaming] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [showHistory, setShowHistory] = useState(false);
	const [sessionHistory, setSessionHistory] = useState<ChatSessionSummary[]>(
		[],
	);
	const [historyLoading, setHistoryLoading] = useState(false);
	const [historyError, setHistoryError] = useState<string | null>(null);

	const messageListRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const topBarRef = useRef<HTMLDivElement>(null);
	const suggestionsRef = useRef<HTMLDivElement>(null);
	const [inputMaxHeight, setInputMaxHeight] = useState<number | null>(null);

	// 根据当前语言生成提示文本
	const typingText = useMemo(
		() => (locale === "zh" ? "AI 正在思考..." : "AI is thinking..."),
		[locale],
	);
	const helperText = useMemo(
		() =>
			locale === "zh"
				? "试着描述你的任务、日程或想了解的任何内容。"
				: "Describe your tasks, schedule, or anything you want to explore.",
		[locale],
	);

	// 计算输入框最大高度：不超出顶部栏下方，留出少量间距
	const computeInputMaxHeight = useCallback(() => {
		const container = containerRef.current;
		const topBar = topBarRef.current;
		if (!container || !topBar) return;

		const containerHeight = container.clientHeight;
		const topBarHeight = topBar.offsetHeight;
		const suggestionsHeight = suggestionsRef.current?.offsetHeight ?? 0;
		const gap = 16; // 预留一点间距

		const available = containerHeight - topBarHeight - suggestionsHeight - gap;
		if (available > 0) {
			setInputMaxHeight(available);
		}
	}, []);

	useEffect(() => {
		computeInputMaxHeight();
		const handleResize = () => computeInputMaxHeight();
		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, [computeInputMaxHeight]);

	useEffect(() => {
		// 历史列表展开/收起会改变可用高度，触发重新计算
		if (showHistory) {
			computeInputMaxHeight();
		} else {
			computeInputMaxHeight();
		}
	}, [computeInputMaxHeight, showHistory]);

	// 新消息出现时自动滚动到底部
	useEffect(() => {
		if (messages.length === 0) return;
		const el = messageListRef.current;
		if (el) {
			el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
		}
	}, [messages]);

	const resizeInput = useCallback(
		(value: string) => {
			const el = inputRef.current;
			if (!el) return;
			const maxHeight = inputMaxHeight ?? 200;
			if (el.value !== value) {
				el.value = value;
			}
			el.style.height = "auto";
			const nextHeight = Math.min(el.scrollHeight, maxHeight);
			el.style.height = `${nextHeight}px`;
			el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
		},
		[inputMaxHeight],
	);

	// 输入框随内容自适应高度，并受最大高度限制
	useEffect(() => {
		resizeInput(inputValue);
	}, [inputValue, resizeInput]);

	const handleSend = async () => {
		const text = inputValue.trim();
		if (!text || isStreaming) return;

		setInputValue("");
		setError(null);
		setHistoryError(null);

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
			await sendChatMessageStream(
				{
					message: text,
					conversation_id: conversationId || undefined,
				},
				(chunk) => {
					assistantContent += chunk;
					setMessages((prev) =>
						prev.map((msg) =>
							msg.id === assistantMessageId
								? { ...msg, content: assistantContent }
								: msg,
						),
					);
				},
				(sessionId) => {
					setConversationId((prev) => prev || sessionId);
				},
			);

			if (!assistantContent) {
				const fallback =
					locale === "zh"
						? "没有收到回复，请稍后再试。"
						: "No response received, please try again.";
				setMessages((prev) =>
					prev.map((msg) =>
						msg.id === assistantMessageId ? { ...msg, content: fallback } : msg,
					),
				);
			}
		} catch (err) {
			console.error(err);
			const fallback =
				locale === "zh"
					? "出错了，请稍后再试。"
					: "Something went wrong. Please try again.";
			setMessages((prev) =>
				prev.map((msg) =>
					msg.id === assistantMessageId ? { ...msg, content: fallback } : msg,
				),
			);
			setError(fallback);
		} finally {
			setIsStreaming(false);
		}
	};

	const loadChatHistory = async () => {
		setHistoryLoading(true);
		setHistoryError(null);
		try {
			const data = await getChatHistory(undefined, 20);
			setSessionHistory(data.sessions || []);
		} catch (err) {
			console.error(err);
			setHistoryError(t.page.loadHistoryFailed);
		} finally {
			setHistoryLoading(false);
		}
	};

	const loadSessionMessages = async (sessionId: string) => {
		setHistoryLoading(true);
		setHistoryError(null);
		try {
			const data = await getChatHistory(sessionId);
			const history = (data.history || []) as ChatHistoryItem[];
			const chatMessages =
				history.length > 0
					? history.map((msg) => ({
							id: createId(),
							role: msg.role,
							content: msg.content,
						}))
					: [buildWelcomeMessage(locale)];

			setMessages(chatMessages);
			setConversationId(sessionId);
			setShowHistory(false);
			setError(null);
		} catch (err) {
			console.error(err);
			setHistoryError(t.page.loadSessionFailed);
		} finally {
			setHistoryLoading(false);
		}
	};

	const handleNewConversation = () => {
		setConversationId(null);
		setMessages([buildWelcomeMessage(locale)]);
		setShowHistory(false);
		setHistoryError(null);
		setError(null);
	};

	const handleToggleHistory = () => {
		const nextVisible = !showHistory;
		setShowHistory(nextVisible);
		if (!showHistory) {
			void loadChatHistory();
		}
	};

	const formatHistoryTime = (value?: string) => {
		if (!value) return "";
		const parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) return "";
		return parsed.toLocaleString(locale === "zh" ? "zh-CN" : "en-US", {
			hour12: false,
		});
	};

	const handleSuggestionClick = (suggestion: string) => {
		setInputValue(suggestion);
	};

	const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault();
			handleSend();
		}
	};

	return (
		<div ref={containerRef} className="flex h-full flex-col bg-background">
			<div
				ref={topBarRef}
				className="flex flex-col gap-2 border-b border-border p-4"
			>
				<div className="flex items-center justify-between gap-3">
					<div className="flex items-center gap-2">
						<Sparkles className="h-5 w-5 text-blue-500" />
						<h1 className="text-lg font-semibold text-foreground">
							{t.page.chatTitle}
						</h1>
					</div>
					<div className="flex items-center gap-1">
						<button
							type="button"
							onClick={handleToggleHistory}
							className={cn(
								"flex h-9 w-9 items-center justify-center rounded-lg border border-border",
								"text-muted-foreground transition-colors",
								"hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
							)}
							title={t.page.chatHistory}
							aria-label={t.page.chatHistory}
						>
							{historyLoading && showHistory ? (
								<Loader2 className="h-5 w-5 animate-spin" />
							) : (
								<History className="h-5 w-5" />
							)}
						</button>
						<button
							type="button"
							onClick={handleNewConversation}
							className={cn(
								"flex h-9 w-9 items-center justify-center rounded-lg border border-border",
								"text-muted-foreground transition-colors",
								"hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
							)}
							title={t.page.newChat}
							aria-label={t.page.newChat}
						>
							<Plus className="h-5 w-5" />
						</button>
					</div>
				</div>
				<p className="text-sm text-muted-foreground">{t.page.chatSubtitle}</p>
				<p className="text-xs text-muted-foreground">{helperText}</p>
			</div>

			{showHistory && (
				<div className="border-b border-border bg-muted/40 px-4 py-3">
					<div className="mb-2 flex items-center justify-between">
						<h3 className="text-xs font-semibold uppercase text-muted-foreground">
							{t.page.recentSessions}
						</h3>
						<button
							type="button"
							onClick={loadChatHistory}
							className={cn(
								"flex h-8 w-8 items-center justify-center rounded-md border border-border",
								"text-muted-foreground transition-colors hover:bg-muted",
								"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
							)}
							title={t.page.chatHistory}
							aria-label={t.page.chatHistory}
						>
							<Loader2
								className={`h-4 w-4 ${
									historyLoading ? "animate-spin" : "text-muted-foreground"
								}`}
							/>
						</button>
					</div>

					{historyError && (
						<p className="mb-2 text-xs text-red-500">{historyError}</p>
					)}

					{historyLoading ? (
						<div className="flex items-center gap-2 text-xs text-muted-foreground">
							<Loader2 className="h-4 w-4 animate-spin" />
							<span>{t.page.chatHistory}</span>
						</div>
					) : sessionHistory.length === 0 ? (
						<p className="text-sm text-muted-foreground">{t.page.noHistory}</p>
					) : (
						<div className="space-y-2 max-h-[200px] overflow-y-auto">
							{sessionHistory.map((session) => {
								const displayTitle =
									session.title ||
									`${t.page.chatHistory} ${session.session_id.slice(0, 8)}`;
								const lastActive = formatHistoryTime(session.last_active);
								return (
									<button
										key={session.session_id}
										type="button"
										onClick={() => loadSessionMessages(session.session_id)}
										className={cn(
											"w-full text-left rounded-lg border border-border bg-card p-3",
											"transition-colors hover:bg-muted/50",
											"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
										)}
									>
										<div className="flex items-center justify-between gap-2">
											<div className="min-w-0">
												<p
													className="truncate text-sm font-medium text-foreground"
													title={displayTitle}
												>
													{displayTitle}
												</p>
												<div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
													{typeof session.message_count === "number" && (
														<span>
															{t.page.messagesCount.replace(
																"{count}",
																String(session.message_count),
															)}
														</span>
													)}
													{lastActive && <span>{lastActive}</span>}
												</div>
											</div>
											<ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
										</div>
									</button>
								);
							})}
						</div>
					)}
				</div>
			)}

			<div
				className="flex-1 space-y-4 overflow-y-auto px-4 py-4"
				ref={messageListRef}
			>
				{messages.map((msg) => (
					<div
						key={msg.id}
						className={cn(
							"flex",
							msg.role === "assistant" ? "justify-start" : "justify-end",
						)}
					>
						<div
							className={cn(
								"max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm",
								msg.role === "assistant"
									? "bg-muted text-foreground"
									: "bg-blue-500 text-white",
							)}
						>
							<div className="mb-1 text-[11px] uppercase tracking-wide opacity-70">
								{msg.role === "assistant"
									? locale === "zh"
										? "助理"
										: "Assistant"
									: locale === "zh"
										? "我"
										: "You"}
							</div>
							<div className="whitespace-pre-wrap leading-relaxed">
								{msg.content || typingText}
							</div>
						</div>
					</div>
				))}
				{isStreaming && (
					<div className="flex justify-start">
						<div className="flex items-center gap-2 rounded-full bg-muted px-3 py-2 text-xs text-muted-foreground">
							<Loader2 className="h-4 w-4 animate-spin" />
							{typingText}
						</div>
					</div>
				)}
			</div>

			<div className="bg-background p-4">
				{!inputValue.trim() && (
					<div ref={suggestionsRef} className="mb-3 flex flex-wrap gap-2">
						{t.page.chatSuggestions.map((suggestion) => (
							<button
								key={suggestion}
								type="button"
								onClick={() => handleSuggestionClick(suggestion)}
								className={cn(
									"px-3 py-2 text-sm",
									"rounded-full border border-foreground/10",
									"text-foreground transition-colors",
									"hover:bg-foreground/5",
									"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
								)}
							>
								{suggestion}
							</button>
						))}
					</div>
				)}

				<div className="flex items-end gap-2">
					<textarea
						ref={inputRef}
						value={inputValue}
						onChange={(e) => setInputValue(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder={t.page.chatInputPlaceholder}
						rows={2}
						style={{
							maxHeight: inputMaxHeight ?? undefined,
						}}
						className={cn(
							"flex-1 resize-none rounded-2xl border border-border bg-muted/60 px-4 py-3",
							"text-foreground placeholder:text-muted-foreground",
							"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
							"overflow-y-auto",
						)}
					/>
					<button
						type="button"
						onClick={handleSend}
						disabled={!inputValue.trim() || isStreaming}
						className={cn(
							"flex h-11 w-11 items-center justify-center rounded-full",
							"bg-blue-500 text-white transition-colors",
							"hover:bg-blue-600",
							"disabled:cursor-not-allowed disabled:opacity-50",
							"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
						)}
						aria-label={t.page.chatSendButton}
					>
						{isStreaming ? (
							<Loader2 className="h-5 w-5 animate-spin" />
						) : (
							<Send className="h-5 w-5" />
						)}
					</button>
				</div>

				{error && <p className="mt-2 text-sm text-red-500">{error}</p>}
			</div>
		</div>
	);
}
