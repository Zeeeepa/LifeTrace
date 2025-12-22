import type { CreateTodoInput } from "@/lib/types";

export type ChatMessage = {
	id: string;
	role: "user" | "assistant";
	content: string;
};

export type ChatMode = "ask" | "plan" | "edit" | "agent";

export type ParsedTodo = Pick<
	CreateTodoInput,
	"name" | "description" | "tags" | "deadline" | "order"
>;

export type ParsedTodoTree = ParsedTodo & { subtasks?: ParsedTodoTree[] };

// Edit mode content block with AI-recommended target todo
export type EditContentBlock = {
	id: string;
	title: string;
	content: string;
	recommendedTodoId: number | null;
};

// ============================================================================
// Agent 模式专用类型
// ============================================================================

export type AgentResponseType =
	| "message"
	| "questions"
	| "edit_proposal"
	| "decompose_proposal";

export type AgentQuestion = {
	id: string;
	question: string;
	options: string[];
};

export type AgentEditProposal = {
	field: "name" | "description" | "userNotes";
	currentValue: string | null;
	proposedValue: string;
	reason: string;
};

export type AgentDecomposeProposal = {
	subtasks: Array<{
		name: string;
		description?: string;
	}>;
	reason: string;
};

export type AgentResponse = {
	responseType: AgentResponseType;
	content: string;
	questions?: AgentQuestion[];
	editProposal?: AgentEditProposal;
	decomposeProposal?: AgentDecomposeProposal;
};

// Agent 对话状态
export type AgentState = {
	isStreaming: boolean;
	pendingEditProposal: AgentEditProposal | null;
	pendingDecomposeProposal: AgentDecomposeProposal | null;
	pendingQuestions: AgentQuestion[] | null;
	questionAnswers: Record<string, string[]>;
};
