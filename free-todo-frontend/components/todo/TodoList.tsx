"use client";

import { CheckCircle2, Circle } from "lucide-react";
import { useTodoStore } from "@/lib/store/todo-store";
import type { Todo } from "@/lib/types/todo";
import { cn } from "@/lib/utils";

interface TodoItemProps {
	todo: Todo;
}

function TodoItem({ todo }: TodoItemProps) {
	const { toggleTodoStatus } = useTodoStore();

	const completedSubtasks =
		todo.subtasks?.filter((st) => st.completed).length ?? 0;
	const totalSubtasks = todo.subtasks?.length ?? 0;
	const hasSubtasks = totalSubtasks > 0;

	const formatDate = (dateString?: string) => {
		if (!dateString) return null;
		const date = new Date(dateString);
		return date.toLocaleDateString("zh-CN", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	};

	return (
		<button
			type="button"
			className={cn(
				"w-full text-left flex items-start gap-3 px-4 py-3",
				"hover:bg-muted/50 transition-colors",
				"cursor-pointer",
				"bg-transparent border-0 p-0",
			)}
			onClick={() => toggleTodoStatus(todo.id)}
		>
			<div className="mt-0.5 shrink-0">
				{todo.status === "completed" ? (
					<CheckCircle2 className="h-5 w-5 text-amber-500 dark:text-amber-400" />
				) : (
					<Circle className="h-5 w-5 text-amber-500 dark:text-amber-400" />
				)}
			</div>
			<div className="flex-1 min-w-0">
				<div
					className={cn(
						"text-base font-medium text-foreground",
						todo.status === "completed" && "line-through text-muted-foreground",
					)}
				>
					{todo.title}
				</div>
				{(todo.dueDate || hasSubtasks) && (
					<div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
						{todo.dueDate && (
							<>
								<span>{formatDate(todo.dueDate)}</span>
								{hasSubtasks && (
									<span className="text-muted-foreground/50">|</span>
								)}
							</>
						)}
						{hasSubtasks && (
							<span>
								{completedSubtasks}/{totalSubtasks}
							</span>
						)}
					</div>
				)}
			</div>
		</button>
	);
}

export function TodoList() {
	const { todos } = useTodoStore();

	const pendingTodos = todos.filter((todo) => todo.status === "pending");
	const completedTodos = todos.filter((todo) => todo.status === "completed");

	return (
		<div className="flex h-full flex-col overflow-hidden">
			<div className="flex-1 overflow-y-auto">
				{pendingTodos.length === 0 && completedTodos.length === 0 ? (
					<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
						暂无待办事项
					</div>
				) : (
					<>
						{pendingTodos.length > 0 && (
							<div>
								{pendingTodos.map((todo) => (
									<TodoItem key={todo.id} todo={todo} />
								))}
							</div>
						)}
						{completedTodos.length > 0 && (
							<div className="mt-4 pt-4">
								<div className="px-4 pb-2 text-xs font-medium text-muted-foreground">
									已完成
								</div>
								{completedTodos.map((todo) => (
									<TodoItem key={todo.id} todo={todo} />
								))}
							</div>
						)}
					</>
				)}
			</div>
		</div>
	);
}
