import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { ChatMode } from "@/apps/chat/types";

interface ChatStoreState {
	chatMode: ChatMode;
	conversationId: string | null;
	historyOpen: boolean;
	pendingPrompt: string | null; // 待发送的预设消息（由其他组件触发）
	pendingNewChat: boolean; // 是否需要先开启新会话再发送消息
	setChatMode: (mode: ChatMode) => void;
	setConversationId: (id: string | null) => void;
	setHistoryOpen: (open: boolean) => void;
	setPendingPrompt: (prompt: string | null, startNewChat?: boolean) => void;
}

export const useChatStore = create<ChatStoreState>()(
	persist(
		(set) => ({
			chatMode: "agno",
			conversationId: null,
			historyOpen: false,
			pendingPrompt: null,
			pendingNewChat: false,
			setChatMode: (mode) => set({ chatMode: mode }),
			setConversationId: (id) => set({ conversationId: id }),
			setHistoryOpen: (open) => set({ historyOpen: open }),
			setPendingPrompt: (prompt, startNewChat = false) =>
				set({ pendingPrompt: prompt, pendingNewChat: startNewChat }),
		}),
		{
			name: "chat-config",
			storage: createJSONStorage(() => {
				return {
					getItem: (name: string): string | null => {
						if (typeof window === "undefined") return null;

						try {
							const stored = localStorage.getItem(name);
							const parsed = stored ? JSON.parse(stored) : null;
							const state = parsed?.state || parsed || {};

							// 从 ui-store 读取默认聊天模式
							let defaultChatMode: ChatMode = "agno";
							try {
								const uiConfig = localStorage.getItem("ui-panel-config");
								if (uiConfig) {
									const uiParsed = JSON.parse(uiConfig);
									const uiState = uiParsed?.state || uiParsed;
									if (
										uiState?.defaultChatMode &&
										["ask", "plan", "edit", "difyTest", "agno"].includes(
											uiState.defaultChatMode,
										)
									) {
										defaultChatMode = uiState.defaultChatMode;
									}
								}
							} catch (e) {
								// 如果读取 ui-store 失败，使用默认值 "agno"
								console.warn("Failed to read default chat mode from ui-store:", e);
							}

							// 使用默认聊天模式，而不是硬编码的 "ask"
							// 用户每次刷新页面时，会进入设置的默认模式
							const chatMode: ChatMode = defaultChatMode;

							// 验证 conversationId - 刷新后清空，不默认选中历史记录
							const conversationId: string | null = null;

							// 验证 historyOpen
							const historyOpen: boolean =
								typeof state.historyOpen === "boolean"
									? state.historyOpen
									: false;

							return JSON.stringify({
								state: {
									chatMode,
									conversationId,
									historyOpen,
								},
							});
						} catch (e) {
							console.error("Error loading chat config:", e);
							return null;
						}
					},
					setItem: (name: string, value: string): void => {
						if (typeof window === "undefined") return;

						try {
							localStorage.setItem(name, value);
						} catch (e) {
							console.error("Error saving chat config:", e);
						}
					},
					removeItem: (name: string): void => {
						if (typeof window === "undefined") return;
						localStorage.removeItem(name);
					},
				};
			}),
		},
	),
);
