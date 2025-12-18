import type { CreateTodoInput } from "@/lib/types";

export type ChatMessage = {
	id: string;
	role: "user" | "assistant";
	content: string;
};

export type ChatMode = "ask" | "plan";

export type ParsedTodo = Pick<
	CreateTodoInput,
	"name" | "description" | "tags" | "deadline" | "order"
>;

export type ParsedTodoTree = ParsedTodo & { subtasks?: ParsedTodoTree[] };
