import { useCallback, useEffect, useRef } from "react";
import type { SessionCacheReturn } from "@/apps/chat/hooks/useSessionCache";
import type { StreamControllerReturn } from "@/apps/chat/hooks/useStreamController";
import type { ChatMessage } from "@/apps/chat/types";
import { createId } from "@/apps/chat/utils/id";
import type { ChatHistoryItem } from "@/lib/api";
import { useChatStore } from "@/lib/store/chat-store";

/**
 * useSessionManager 参数
 */
export interface UseSessionManagerParams {
	/** 会话缓存 hook */
	sessionCache: SessionCacheReturn;
	/** 流式控制器 hook */
	streamController: StreamControllerReturn;
	/** 重置拆解状态 */
	resetBreakdown: () => void;
	/** 设置 conversationId */
	setConversationId: (id: string | null) => void;
	/** 设置历史抽屉开关 */
	setHistoryOpen: (open: boolean) => void;
	/** 设置消息列表 */
	setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
	/** 设置输入框内容 */
	setInputValue: React.Dispatch<React.SetStateAction<string>>;
	/** 设置流式状态 */
	setIsStreaming: React.Dispatch<React.SetStateAction<boolean>>;
	/** 设置错误状态 */
	setError: React.Dispatch<React.SetStateAction<string | null>>;
	/** 当前会话历史记录 */
	sessionHistory: ChatHistoryItem[];
	/** 当前 conversationId */
	conversationId: string | null;
}

/**
 * useSessionManager 返回值
 */
export interface SessionManagerReturn {
	/** 新建聊天 */
	handleNewChat: (keepStreaming?: boolean) => void;
	/** 加载历史会话 */
	handleLoadSession: (sessionId: string) => Promise<void>;
}

/**
 * 管理会话切换和新建聊天逻辑
 */
export const useSessionManager = ({
	sessionCache,
	streamController,
	resetBreakdown,
	setConversationId,
	setHistoryOpen,
	setMessages,
	setInputValue,
	setIsStreaming,
	setError,
	sessionHistory,
	conversationId,
}: UseSessionManagerParams): SessionManagerReturn => {
	// Refs
	const prevConversationIdRef = useRef<string | null>(null);
	const isLoadingSessionRef = useRef<boolean>(false);

	/**
	 * 新建聊天
	 * @param keepStreaming - 如果为 true，不中断当前流式输出，让它在后台继续
	 */
	const handleNewChat = useCallback(
		(keepStreaming = false) => {
			const currentSessionId = useChatStore.getState().conversationId;

			// 保存当前对话的消息到缓存
			if (currentSessionId) {
				setMessages((currentMessages) => {
					if (currentMessages.length > 0) {
						sessionCache.saveMessages(currentSessionId, currentMessages);
					}
					return currentMessages;
				});
			}

			if (!keepStreaming) {
				streamController.cancelRequest();
				setIsStreaming(false);
			}

			// 如果正在进行待办拆解，放弃拆解并进入新聊天
			resetBreakdown();
			streamController.clearActiveRequest();
			setConversationId(null);
			setMessages([]);
			setInputValue("");
			setError(null);
			setHistoryOpen(false);
		},
		[
			setConversationId,
			setHistoryOpen,
			resetBreakdown,
			sessionCache,
			streamController,
			setMessages,
			setInputValue,
			setIsStreaming,
			setError,
		],
	);

	/**
	 * 加载历史会话
	 */
	const handleLoadSession = useCallback(
		async (sessionId: string) => {
			const currentSessionId = useChatStore.getState().conversationId;

			// 1. 先保存当前对话的消息到缓存
			if (currentSessionId) {
				setMessages((currentMessages) => {
					if (currentMessages.length > 0) {
						sessionCache.saveMessages(currentSessionId, currentMessages);
					}
					return currentMessages;
				});
			}

			// 2. 清空活跃请求 ID，但不中断流式输出
			streamController.clearActiveRequest();

			// 3. 检查目标 sessionId 是否有内存缓存
			const cachedMessages = sessionCache.getMessages(sessionId);
			const isSessionStreaming = sessionCache.isStreaming(sessionId);

			if (cachedMessages && cachedMessages.length > 0) {
				setMessages(cachedMessages);
				setIsStreaming(isSessionStreaming);
				setError(null);
				isLoadingSessionRef.current = false;
			} else {
				isLoadingSessionRef.current = true;
				setMessages([]);
				setIsStreaming(false);
				setError(null);
			}

			// 4. 更新 conversationId，触发 TanStack Query 获取历史记录
			setConversationId(sessionId);
			setHistoryOpen(false);
		},
		[
			setConversationId,
			setHistoryOpen,
			sessionCache,
			streamController,
			setMessages,
			setIsStreaming,
			setError,
		],
	);

	// 当会话历史加载完成后，更新 messages
	useEffect(() => {
		if (!isLoadingSessionRef.current) {
			return;
		}

		const conversationIdChanged =
			prevConversationIdRef.current !== conversationId;
		if (conversationIdChanged) {
			prevConversationIdRef.current = conversationId;
		}

		if (sessionHistory.length > 0 && conversationId) {
			const mapped = sessionHistory.map((item: ChatHistoryItem) => ({
				id: createId(),
				role: item.role,
				content: item.content,
			}));
			setMessages(mapped);
			isLoadingSessionRef.current = false;
		}
	}, [sessionHistory, conversationId, setMessages]);

	return {
		handleNewChat,
		handleLoadSession,
	};
};
