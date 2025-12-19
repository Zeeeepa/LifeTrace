import type { Todo, TodoPriority, TodoStatus } from "@/lib/types";

// 格式化优先级
const formatPriority = (priority: TodoPriority, locale: string): string => {
	const priorityMap: Record<TodoPriority, { zh: string; en: string }> = {
		high: { zh: "高", en: "High" },
		medium: { zh: "中", en: "Medium" },
		low: { zh: "低", en: "Low" },
		none: { zh: "无", en: "None" },
	};
	return locale === "zh" ? priorityMap[priority].zh : priorityMap[priority].en;
};

// 格式化状态
const formatStatus = (status: TodoStatus, locale: string): string => {
	const statusMap: Record<TodoStatus, { zh: string; en: string }> = {
		active: { zh: "进行中", en: "Active" },
		completed: { zh: "已完成", en: "Completed" },
		canceled: { zh: "已取消", en: "Canceled" },
		draft: { zh: "草稿", en: "Draft" },
	};
	return locale === "zh" ? statusMap[status].zh : statusMap[status].en;
};

// 查找最高级父待办
export const findRootTodo = (todo: Todo, allTodos: Todo[]): Todo => {
	if (!todo.parentTodoId) {
		return todo;
	}
	const parent = allTodos.find((t) => t.id === todo.parentTodoId);
	if (!parent) {
		return todo;
	}
	return findRootTodo(parent, allTodos);
};

// 递归收集所有子待办（包括子待办的子待办）
export const collectAllDescendants = (todo: Todo, allTodos: Todo[]): Todo[] => {
	const children = allTodos.filter((t) => t.parentTodoId === todo.id);
	const descendants: Todo[] = [...children];
	for (const child of children) {
		descendants.push(...collectAllDescendants(child, allTodos));
	}
	return descendants;
};

// 构建单个待办的详细信息（包含所有参数）
export const buildDetailedTodoInfo = (
	todo: Todo,
	allTodos: Todo[],
	locale: string,
	indent = "",
): string => {
	const lines: string[] = [];

	// ID is critical for AI to reference when recommending target todos
	const idLabel = "ID";
	lines.push(`${indent}${idLabel}: ${todo.id}`);

	const label = locale === "zh" ? "名称" : "Name";
	lines.push(`${indent}${label}: ${todo.name}`);

	if (todo.description) {
		const descLabel = locale === "zh" ? "描述" : "Description";
		lines.push(`${indent}${descLabel}: ${todo.description}`);
	}

	if (todo.userNotes) {
		const notesLabel = locale === "zh" ? "备注" : "Notes";
		lines.push(`${indent}${notesLabel}: ${todo.userNotes}`);
	}

	if (todo.deadline) {
		const ddlLabel = locale === "zh" ? "截止日期" : "Deadline";
		lines.push(`${indent}${ddlLabel}: ${todo.deadline}`);
	}

	const priorityLabel = locale === "zh" ? "优先级" : "Priority";
	lines.push(
		`${indent}${priorityLabel}: ${formatPriority(todo.priority, locale)}`,
	);

	const statusLabel = locale === "zh" ? "状态" : "Status";
	lines.push(`${indent}${statusLabel}: ${formatStatus(todo.status, locale)}`);

	if (todo.tags?.length) {
		const tagsLabel = locale === "zh" ? "标签" : "Tags";
		lines.push(`${indent}${tagsLabel}: ${todo.tags.join(", ")}`);
	}

	// Show parentTodoId as numeric ID for AI reference
	if (todo.parentTodoId) {
		const parentIdLabel = locale === "zh" ? "父待办ID" : "Parent Todo ID";
		lines.push(`${indent}${parentIdLabel}: ${todo.parentTodoId}`);
		// Also show parent name for context
		const parent = allTodos.find((t) => t.id === todo.parentTodoId);
		if (parent) {
			const parentNameLabel = locale === "zh" ? "父待办名称" : "Parent Name";
			lines.push(`${indent}${parentNameLabel}: ${parent.name}`);
		}
	}

	return lines.join("\n");
};

// 构建简洁的待办行（用于列表展示）
export const buildTodoLine = (todo: Todo, locale: string) => {
	const parts: string[] = [todo.name];
	if (todo.description) {
		parts.push(todo.description);
	}
	if (todo.deadline) {
		parts.push(
			locale === "zh" ? `截止: ${todo.deadline}` : `Due: ${todo.deadline}`,
		);
	}
	if (todo.tags?.length) {
		parts.push(`${locale === "zh" ? "标签" : "Tags"}: ${todo.tags.join(", ")}`);
	}
	return `- ${parts.join(" | ")}`;
};

// 构建包含层级结构的完整待办上下文
export const buildHierarchicalTodoContext = (
	selectedTodos: Todo[],
	allTodos: Todo[],
	locale: string,
): string => {
	if (!selectedTodos.length) {
		return locale === "zh"
			? "当前没有待办，聊天上下文为空。"
			: "No todos available; chat context is empty.";
	}

	const sections: string[] = [];

	for (const selectedTodo of selectedTodos) {
		const todoSection: string[] = [];

		// 1. 选中待办的详细信息
		const selectedLabel =
			locale === "zh" ? "【当前选中待办】" : "[Selected Todo]";
		todoSection.push(selectedLabel);
		todoSection.push(buildDetailedTodoInfo(selectedTodo, allTodos, locale));

		// 2. 查找最高级父待办
		const rootTodo = findRootTodo(selectedTodo, allTodos);

		// 如果选中的待办不是根待办，显示根待办信息和完整子树
		if (rootTodo.id !== selectedTodo.id) {
			todoSection.push("");
			const rootLabel =
				locale === "zh" ? "【最高级父待办】" : "[Root Parent Todo]";
			todoSection.push(rootLabel);
			todoSection.push(buildDetailedTodoInfo(rootTodo, allTodos, locale));

			// 3. 收集根待办下的所有子待办
			const allDescendants = collectAllDescendants(rootTodo, allTodos);
			if (allDescendants.length > 0) {
				todoSection.push("");
				const childrenLabel =
					locale === "zh"
						? `【该父待办下的所有子待办】（共 ${allDescendants.length} 条）`
						: `[All Sub-todos] (total ${allDescendants.length})`;
				todoSection.push(childrenLabel);

				for (const child of allDescendants) {
					todoSection.push("");
					todoSection.push(
						buildDetailedTodoInfo(child, allTodos, locale, "  "),
					);
				}
			}
		} else {
			// 选中的就是根待办，显示其所有子待办
			const allDescendants = collectAllDescendants(selectedTodo, allTodos);
			if (allDescendants.length > 0) {
				todoSection.push("");
				const childrenLabel =
					locale === "zh"
						? `【所有子待办】（共 ${allDescendants.length} 条）`
						: `[All Sub-todos] (total ${allDescendants.length})`;
				todoSection.push(childrenLabel);

				for (const child of allDescendants) {
					todoSection.push("");
					todoSection.push(
						buildDetailedTodoInfo(child, allTodos, locale, "  "),
					);
				}
			}
		}

		sections.push(todoSection.join("\n"));
	}

	// 多个选中待办用分隔线分开
	const separator = locale === "zh" ? "\n---\n" : "\n---\n";
	return sections.join(separator);
};

// 保留原有的简单上下文构建函数（向后兼容）
export const buildTodoContextBlock = (
	list: Todo[],
	sourceLabel: string,
	locale: string,
) => {
	if (!list.length) {
		return locale === "zh"
			? "当前没有待办，聊天上下文为空。"
			: "No todos available; chat context is empty.";
	}
	const header =
		locale === "zh"
			? `${sourceLabel}（共 ${list.length} 条）：`
			: `${sourceLabel} (total ${list.length}):`;
	return [header, ...list.map((item) => buildTodoLine(item, locale))].join(
		"\n",
	);
};
