"use client";

import { Calendar, Flag, Plus, Tag as TagIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { TodoContextMenu } from "@/components/common/TodoContextMenu";
import type { Todo } from "@/lib/types";
import { getPriorityLabel, sortTodosByOrder } from "@/lib/utils";
import {
	formatDateTime,
	getChildProgress,
	getPriorityIconColor,
} from "../helpers";

interface ChildTodoSectionProps {
	childTodos: Todo[];
	allTodos: Todo[];
	onSelectTodo: (id: number) => void;
	onCreateChild: (name: string) => void;
}

export function ChildTodoSection({
	childTodos,
	allTodos,
	onSelectTodo,
	onCreateChild,
}: ChildTodoSectionProps) {
	const tCommon = useTranslations("common");
	const tTodoDetail = useTranslations("todoDetail");
	const [isAddingChild, setIsAddingChild] = useState(false);
	const [childName, setChildName] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);

	// 使用与 TodoList 相同的排序逻辑：按 order 字段排序，如果 order 相同则按创建时间排序
	const sortedChildTodos = useMemo(
		() => sortTodosByOrder(childTodos),
		[childTodos],
	);

	useEffect(() => {
		if (isAddingChild) {
			inputRef.current?.focus();
		}
	}, [isAddingChild]);

	const handleSubmit = (event?: React.FormEvent) => {
		if (event) event.preventDefault();
		const name = childName.trim();
		if (!name) return;
		onCreateChild(name);
		setChildName("");
	};

	const handleAddChildFromMenu = () => {
		setIsAddingChild(true);
		setChildName("");
	};

	return (
		<div className="mb-4">
			<div className="mb-2 flex items-center justify-between">
				<div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
					{tTodoDetail("childTodos")}
					{sortedChildTodos.length > 0 && (
						<span className="ml-1">
							{sortedChildTodos.filter((c) => c.status === "completed").length}/
							{sortedChildTodos.length}
						</span>
					)}
				</div>
			</div>

			<div className="space-y-1">
				{sortedChildTodos.map((child) => {
					const { completed, total } = getChildProgress(allTodos, child.id);
					return (
						<TodoContextMenu
							key={child.id}
							todoId={child.id}
							onAddChild={handleAddChildFromMenu}
						>
							<button
								type="button"
								onClick={() => onSelectTodo(child.id)}
								className="flex w-full items-center justify-between gap-3 rounded-lg px-1 py-2 text-left transition-colors hover:bg-muted/40"
							>
								<div className="flex flex-col gap-1">
									<div className="flex items-center gap-2">
										<span className="inline-flex h-4 w-4 items-center justify-center rounded-md border-2 border-muted-foreground/60" />
										<Flag
											className={getPriorityIconColor(child.priority ?? "none")}
											fill="currentColor"
											aria-label={tTodoDetail("priorityLabel", {
												priority: getPriorityLabel(
													child.priority ?? "none",
													tCommon,
												),
											})}
										/>
										<span className="text-sm font-semibold text-foreground">
											{child.name}
										</span>
									</div>
									<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
										{child.deadline && (
											<div className="flex items-center gap-1 rounded-md bg-muted/40 px-2 py-1">
												<Calendar className="h-3 w-3" />
												<span>{formatDateTime(child.deadline)}</span>
											</div>
										)}
										{child.tags && child.tags.length > 0 && (
											<div className="flex items-center gap-1">
												<TagIcon className="h-3 w-3" />
												<div className="flex flex-wrap items-center gap-1">
													{child.tags.map((tag) => (
														<span
															key={tag}
															className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground"
														>
															{tag}
														</span>
													))}
												</div>
											</div>
										)}
									</div>
								</div>
								{total > 0 && (
									<span className="text-xs text-muted-foreground">
										{completed}/{total}
									</span>
								)}
							</button>
						</TodoContextMenu>
					);
				})}
			</div>

			{isAddingChild ? (
				<form
					onSubmit={handleSubmit}
					className="mt-2 flex flex-wrap items-center gap-2"
				>
					<input
						ref={inputRef}
						type="text"
						value={childName}
						onChange={(e) => setChildName(e.target.value)}
						placeholder={tTodoDetail("addChildPlaceholder")}
						className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
					/>
					<button
						type="submit"
						className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
					>
						<Plus className="h-4 w-4" />
						{tTodoDetail("add")}
					</button>
					<button
						type="button"
						onClick={() => {
							setIsAddingChild(false);
							setChildName("");
						}}
						className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted/60 transition-colors"
					>
						{tTodoDetail("cancel")}
					</button>
				</form>
			) : (
				<button
					type="button"
					onClick={() => {
						setIsAddingChild(true);
						setChildName("");
					}}
					className="mt-2 flex w-full items-center gap-2 rounded-lg px-1 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/40"
				>
					<Plus className="h-4 w-4" />
					<span>{tTodoDetail("addChild")}</span>
				</button>
			)}
		</div>
	);
}
