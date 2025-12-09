"use client";

import { Calendar, Paperclip, Tag as TagIcon, Trash2 } from "lucide-react";
import { useTodoStore } from "@/lib/store/todo-store";
import { cn } from "@/lib/utils";

export function TodoDetail() {
	const {
		todos,
		selectedTodoId,
		updateTodo,
		toggleTodoStatus,
		deleteTodo,
		setSelectedTodoId,
	} = useTodoStore();

	const todo = selectedTodoId
		? todos.find((t) => t.id === selectedTodoId)
		: null;

	if (!todo) {
		return (
			<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
				请选择一个待办事项查看详情
			</div>
		);
	}

	const handleNotesChange = (userNotes: string) => {
		updateTodo(todo.id, { userNotes });
	};

	return (
		<div className="flex h-full flex-col overflow-hidden bg-background">
			{/* 顶部导航栏 */}
			<div className="flex shrink-0 items-center justify-between px-4 py-3">
				{/* 右侧操作按钮 */}
				<div className="flex items-center gap-3">
					<button
						type="button"
						onClick={() => toggleTodoStatus(todo.id)}
						className="text-sm text-muted-foreground hover:text-foreground transition-colors"
					>
						Mark as complete
					</button>
					<button
						type="button"
						onClick={() => {
							deleteTodo(todo.id);
							setSelectedTodoId(null);
						}}
						className="flex items-center gap-1 rounded-md border border-destructive/40 px-2 py-1 text-sm text-destructive hover:bg-destructive/10 transition-colors"
					>
						<Trash2 className="h-4 w-4" />
						<span>Delete</span>
					</button>
				</div>
			</div>

			{/* 内容区域 */}
			<div className="flex-1 overflow-y-auto px-4 py-6">
				{/* 待办标题 */}
				<h1 className="mb-4 text-3xl font-bold text-foreground">{todo.name}</h1>

				{/* 元信息 */}
				<div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
					<span
						className={cn(
							"rounded-full border px-2 py-0.5 text-xs font-medium",
							todo.status === "completed"
								? "border-green-500/50 text-green-600"
								: todo.status === "canceled"
									? "border-gray-500/50 text-gray-500"
									: "border-blue-500/50 text-blue-600",
						)}
					>
						{todo.status}
					</span>
					{todo.deadline && (
						<span className="flex items-center gap-1">
							<Calendar className="h-4 w-4" />
							{new Date(todo.deadline).toLocaleString()}
						</span>
					)}
					{todo.tags && todo.tags.length > 0 && (
						<span className="flex items-center gap-1">
							<TagIcon className="h-4 w-4" />
							{todo.tags.join(", ")}
						</span>
					)}
				</div>

				{/* NOTES 部分 */}
				<div className="mb-8">
					<h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						NOTES
					</h2>
					<textarea
						value={todo.userNotes || ""}
						onChange={(e) => handleNotesChange(e.target.value)}
						placeholder="Insert your notes here"
						className="w-full min-h-[120px] rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
					/>
				</div>

				{/* 描述 */}
				<div className="mb-8">
					<h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						Description
					</h2>
					<div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-sm text-foreground">
						{todo.description || "暂无描述"}
					</div>
				</div>

				{/* ATTACHMENTS 部分 */}
				<div>
					<h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						ATTACHMENTS
					</h2>
					{todo.attachments && todo.attachments.length > 0 ? (
						<div className="space-y-2">
							{todo.attachments.map((file) => (
								<div
									key={file.id}
									className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm"
								>
									<Paperclip className="h-4 w-4 text-muted-foreground" />
									<div className="flex-1 truncate">
										<div className="font-medium text-foreground">
											{file.fileName}
										</div>
										<div className="text-xs text-muted-foreground">
											{file.mimeType || "unknown"}
										</div>
									</div>
								</div>
							))}
						</div>
					) : (
						<div className="flex min-h-[120px] items-center justify-center rounded-md border-2 border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
							暂无附件
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
