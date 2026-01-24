import type { useTranslations } from "next-intl";
import type { usePlanParser } from "@/apps/chat/hooks/usePlanParser";
import type { ChatMessage } from "@/apps/chat/types";
import { createId } from "@/apps/chat/utils/id";
import type { CreateTodoInput, Todo } from "@/lib/types";

/**
 * 处理 Plan 模式响应
 * 解析 AI 返回的待办列表并创建待办
 */
export async function handlePlanModeResponse(
	assistantContent: string,
	assistantMessageId: string,
	parsePlanTodos: ReturnType<typeof usePlanParser>["parsePlanTodos"],
	buildTodoPayloads: ReturnType<typeof usePlanParser>["buildTodoPayloads"],
	createTodo: (todo: CreateTodoInput) => Promise<Todo | null>,
	t: ReturnType<typeof useTranslations<"chat">>,
	setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
	setError: React.Dispatch<React.SetStateAction<string | null>>,
): Promise<void> {
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
		return;
	}

	const payloads = buildTodoPayloads(parsedTodos);
	const clientIdToApiId = new Map<string, number>();
	let successCount = 0;

	for (const draft of payloads) {
		const clientId = draft.id ?? createId();
		const parentClientId = draft.parentTodoId;
		const apiParentId =
			typeof parentClientId === "string"
				? (clientIdToApiId.get(parentClientId) ?? null)
				: (parentClientId ?? null);

		const { id: _tempId, ...createPayload } = draft;
		const created = await createTodo({
			...createPayload,
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

/**
 * 处理流式请求错误
 */
export function handleStreamError(
	err: unknown,
	abortController: AbortController,
	assistantContent: string,
	assistantMessageId: string,
	t: ReturnType<typeof useTranslations<"chat">>,
	setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
	setError: React.Dispatch<React.SetStateAction<string | null>>,
): void {
	if (
		abortController.signal.aborted ||
		(err instanceof Error && err.name === "AbortError")
	) {
		// 用户主动取消
		if (!assistantContent) {
			setMessages((prev) =>
				prev.filter((msg) => msg.id !== assistantMessageId),
			);
		}
	} else {
		console.error(err);
		const fallback = t("errorOccurred");
		setMessages((prev) =>
			prev.map((msg) =>
				msg.id === assistantMessageId ? { ...msg, content: fallback } : msg,
			),
		);
		setError(fallback);
	}
}

/**
 * 处理空响应
 */
export function handleEmptyResponse(
	assistantMessageId: string,
	t: ReturnType<typeof useTranslations<"chat">>,
	setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
): void {
	const fallback = t("noResponseReceived");
	setMessages((prev) =>
		prev.map((msg) =>
			msg.id === assistantMessageId ? { ...msg, content: fallback } : msg,
		),
	);
}
