"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { useTodoStore } from "@/lib/store/todo-store";
import type { CreateTodoInput } from "@/lib/types/todo";
import { cn } from "@/lib/utils";

interface CreateTodoFormProps {
	onSuccess?: () => void;
}

export function CreateTodoForm({ onSuccess }: CreateTodoFormProps) {
	const { addTodo } = useTodoStore();
	const [isExpanded, setIsExpanded] = useState(false);
	const [title, setTitle] = useState("");
	const [dueDate, setDueDate] = useState("");
	const [subtasks, setSubtasks] = useState<
		Array<{ id: string; title: string }>
	>([]);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!title.trim()) return;

		const input: CreateTodoInput = {
			title: title.trim(),
			dueDate: dueDate || undefined,
			subtasks:
				subtasks.length > 0
					? subtasks
							.filter((st) => st.title.trim())
							.map((st) => ({
								title: st.title.trim(),
								completed: false,
							}))
					: undefined,
		};

		addTodo(input);
		setTitle("");
		setDueDate("");
		setSubtasks([]);
		setIsExpanded(false);
		onSuccess?.();
	};

	const addSubtask = () => {
		setSubtasks([...subtasks, { id: crypto.randomUUID(), title: "" }]);
	};

	const removeSubtask = (id: string) => {
		setSubtasks(subtasks.filter((st) => st.id !== id));
	};

	const updateSubtask = (id: string, title: string) => {
		setSubtasks(subtasks.map((st) => (st.id === id ? { ...st, title } : st)));
	};

	return (
		<form
			onSubmit={handleSubmit}
			className={cn("bg-muted/30 transition-all", isExpanded && "bg-muted/50")}
		>
			<div className="p-4">
				<div className="flex items-center gap-2">
					<input
						type="text"
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						onFocus={() => setIsExpanded(true)}
						placeholder="新建待办..."
						className="flex-1 bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
					/>
					{title.trim() && (
						<button
							type="submit"
							className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
						>
							添加
						</button>
					)}
				</div>

				{isExpanded && (
					<div className="mt-3 space-y-3">
						<div>
							<label
								htmlFor="due-date-input"
								className="mb-1 block text-xs font-medium text-muted-foreground"
							>
								截止日期
							</label>
							<input
								id="due-date-input"
								type="date"
								value={dueDate}
								onChange={(e) => setDueDate(e.target.value)}
								className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
							/>
						</div>

						<div>
							<div className="mb-2 flex items-center justify-between">
								<div className="text-xs font-medium text-muted-foreground">
									子任务
								</div>
								<button
									type="button"
									onClick={addSubtask}
									className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted transition-colors"
								>
									<Plus className="h-3 w-3" />
									添加子任务
								</button>
							</div>
							{subtasks.length > 0 && (
								<div className="space-y-2">
									{subtasks.map((subtask) => (
										<div key={subtask.id} className="flex items-center gap-2">
											<input
												type="text"
												value={subtask.title}
												onChange={(e) =>
													updateSubtask(subtask.id, e.target.value)
												}
												placeholder="子任务标题..."
												className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
											/>
											<button
												type="button"
												onClick={() => removeSubtask(subtask.id)}
												className="rounded-md p-1 text-muted-foreground hover:bg-muted transition-colors"
											>
												<X className="h-4 w-4" />
											</button>
										</div>
									))}
								</div>
							)}
						</div>
					</div>
				)}
			</div>
		</form>
	);
}
