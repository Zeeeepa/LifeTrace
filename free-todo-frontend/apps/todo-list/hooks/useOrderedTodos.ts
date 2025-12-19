import { useMemo } from "react";
import type { Todo } from "@/lib/types";
import { sortTodosByOrder, sortTodosByOriginalOrder } from "@/lib/utils";

export type OrderedTodo = {
	todo: Todo;
	depth: number;
};

export function useOrderedTodos(
	todos: Todo[],
	searchQuery: string,
	collapsedTodoIds?: Set<number>,
) {
	return useMemo(() => {
		let result = todos;

		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			result = result.filter(
				(todo) =>
					todo.name.toLowerCase().includes(query) ||
					todo.description?.toLowerCase().includes(query) ||
					todo.tags?.some((tag) => tag.toLowerCase().includes(query)),
			);
		}

		const orderMap = new Map(result.map((todo, index) => [todo.id, index]));
		const visibleIds = new Set(result.map((todo) => todo.id));
		const childrenMap = new Map<number, Todo[]>();
		const roots: Todo[] = [];

		result.forEach((todo) => {
			const parentId = todo.parentTodoId;
			if (parentId && visibleIds.has(parentId)) {
				const list = childrenMap.get(parentId) ?? [];
				list.push(todo);
				childrenMap.set(parentId, list);
			} else {
				roots.push(todo);
			}
		});

		const ordered: OrderedTodo[] = [];
		const traverse = (
			items: Todo[],
			depth: number,
			isRoot: boolean = false,
		) => {
			// 根任务按原始顺序排序（支持用户拖拽），子任务按order字段排序
			const sortedItems = isRoot
				? sortTodosByOriginalOrder(items, orderMap)
				: sortTodosByOrder(items);
			sortedItems.forEach((item) => {
				ordered.push({ todo: item, depth });
				const children = childrenMap.get(item.id);
				// 如果有子任务且父任务已展开（collapsedTodoIds 为空或未定义时默认展开，否则检查是否不在 Set 中）
				if (children?.length) {
					const isExpanded =
						collapsedTodoIds === undefined || !collapsedTodoIds.has(item.id);
					if (isExpanded) {
						// 子任务优先按order字段排序，其次按创建时间排序
						traverse(children, depth + 1, false);
					}
				}
			});
		};

		traverse(roots, 0, true);

		return { filteredTodos: result, orderedTodos: ordered };
	}, [todos, searchQuery, collapsedTodoIds]);
}
