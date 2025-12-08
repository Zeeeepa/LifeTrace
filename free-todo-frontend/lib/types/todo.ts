export type TodoStatus = "pending" | "completed";

export interface Todo {
	id: string;
	title: string;
	status: TodoStatus;
	dueDate?: string; // ISO date string
	subtasks?: Subtask[];
	createdAt: string;
	updatedAt: string;
}

export interface Subtask {
	id: string;
	title: string;
	completed: boolean;
}

export interface CreateTodoInput {
	title: string;
	dueDate?: string;
	subtasks?: Omit<Subtask, "id">[];
}

export interface UpdateTodoInput {
	title?: string;
	status?: TodoStatus;
	dueDate?: string;
	subtasks?: Subtask[];
}
