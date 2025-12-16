"use client";

import {
	closestCenter,
	DndContext,
	type DndContextProps,
	type DragEndEvent,
	DragOverlay,
	type DragStartEvent,
	type UniqueIdentifier,
} from "@dnd-kit/core";
import {
	SortableContext,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type React from "react";
import { createPortal } from "react-dom";
import type { OrderedTodo } from "./hooks/useOrderedTodos";
import { TodoCard } from "./TodoCard";

interface TodoTreeListProps {
	orderedTodos: OrderedTodo[];
	activeId: UniqueIdentifier | null;
	selectedTodoIds: string[];
	sensors: DndContextProps["sensors"];
	onDragStart: (event: DragStartEvent) => void;
	onDragEnd: (event: DragEndEvent) => void;
	onDragCancel: () => void;
	onSelect: (todoId: string, event: React.MouseEvent<HTMLDivElement>) => void;
	onSelectSingle: (todoId: string) => void;
}

export function TodoTreeList({
	orderedTodos,
	activeId,
	selectedTodoIds,
	sensors,
	onDragStart,
	onDragEnd,
	onDragCancel,
	onSelect,
	onSelectSingle,
}: TodoTreeListProps) {
	const activeTodoEntry = activeId
		? orderedTodos.find(({ todo }) => todo.id === activeId)
		: null;
	const activeTodo = activeTodoEntry?.todo ?? null;

	return (
		<DndContext
			sensors={sensors}
			collisionDetection={closestCenter}
			onDragStart={onDragStart}
			onDragEnd={onDragEnd}
			onDragCancel={onDragCancel}
		>
			<SortableContext
				items={orderedTodos.map(({ todo }) => todo.id)}
				strategy={verticalListSortingStrategy}
			>
				<div className="px-4 pb-6 flex flex-col gap-0">
					{orderedTodos.map(({ todo, depth }) => (
						<div
							key={todo.id}
							style={{ marginLeft: depth * 16 }}
							className={depth > 0 ? "relative" : undefined}
						>
							<TodoCard
								todo={todo}
								isDragging={activeId === todo.id}
								selected={selectedTodoIds.includes(todo.id)}
								onSelect={(event) => onSelect(todo.id, event)}
								onSelectSingle={() => onSelectSingle(todo.id)}
							/>
						</div>
					))}
				</div>
			</SortableContext>

			{/* 使用 Portal 将 DragOverlay 渲染到 body，避免父容器 transform 导致的坐标偏移 */}
			{typeof document !== "undefined" &&
				createPortal(
					<DragOverlay dropAnimation={null}>
						{activeTodo ? (
							<div
								className="opacity-80 pointer-events-none"
								style={{ marginLeft: (activeTodoEntry?.depth ?? 0) * 16 }}
							>
								<TodoCard
									todo={activeTodo}
									isDragging
									selected={selectedTodoIds.includes(activeTodo.id)}
									onSelect={(event) => onSelect(activeTodo.id, event)}
									onSelectSingle={() => onSelectSingle(activeTodo.id)}
									isOverlay
								/>
							</div>
						) : null}
					</DragOverlay>,
					document.body,
				)}
		</DndContext>
	);
}
