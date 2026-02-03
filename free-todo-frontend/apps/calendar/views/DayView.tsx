/**
 * 日视图组件
 */

import { useTranslations } from "next-intl";
import type React from "react";
import { TodoContextMenu } from "@/components/common/context-menu/TodoContextMenu";
import { useTodoStore } from "@/lib/store/todo-store";
import { cn } from "@/lib/utils";
import type { CalendarTodo } from "../types";
import { getScheduleSeverity, getStatusStyle } from "../types";
import { formatTimeLabel, toDateKey } from "../utils";

export function DayView({
	currentDate,
	todos,
	onBlankClick,
	quickCreateSlot,
}: {
	currentDate: Date;
	todos: CalendarTodo[];
	onBlankClick?: () => void;
	quickCreateSlot?: React.ReactNode;
}) {
	const t = useTranslations("calendar");
	const { setSelectedTodoId } = useTodoStore();
	const key = toDateKey(currentDate);
	const todaysTodos = todos.filter((item) => item.dateKey === key);

	return (
		<div
			className="relative flex flex-col gap-3"
			onClick={(event) => {
				if (
					(event.target as HTMLElement | null)?.closest(
						"[data-quick-create]",
					)
				) {
					return;
				}
				onBlankClick?.();
			}}
			onKeyDown={(event) => {
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					if (
						(event.target as HTMLElement | null)?.closest(
							"[data-quick-create]",
						)
					) {
						return;
					}
					onBlankClick?.();
				}
			}}
			role="button"
			tabIndex={0}
		>
			{quickCreateSlot}
			<div className="flex flex-col gap-3">
				{todaysTodos.length === 0 ? (
					<div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
						{t("noTodosDue")}
					</div>
				) : (
					todaysTodos.map((item) => (
						<TodoContextMenu
							key={`${item.todo.id}-${item.dateKey}`}
							todoId={item.todo.id}
						>
							<div
								className={cn(
									"group relative flex flex-col gap-1 rounded-xl border p-3 text-xs shadow-sm transition-all duration-200 ease-out",
									"cursor-pointer hover:-translate-y-[1px] hover:ring-1 hover:ring-primary/20 hover:shadow-[0_14px_28px_-20px_oklch(var(--primary)/0.45)]",
									"active:translate-y-0 active:scale-[0.995]",
									"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
									getStatusStyle(item.todo.status),
								)}
								onClick={(event) => {
									event.stopPropagation();
									setSelectedTodoId(item.todo.id);
								}}
								onKeyDown={(e) => {
									if (e.key === "Enter" || e.key === " ") {
										e.preventDefault();
										e.stopPropagation();
										setSelectedTodoId(item.todo.id);
									}
								}}
								role="button"
								tabIndex={0}
							>
								<div className="flex items-center justify-between gap-2">
									<p className="truncate text-base font-semibold transition-colors group-hover:text-foreground">
										{item.todo.name}
									</p>
									<span
										className={cn(
											"shrink-0 text-sm font-medium transition-colors",
											getScheduleSeverity(item.startTime) === "overdue"
												? "text-red-600"
												: getScheduleSeverity(item.startTime) === "soon"
													? "text-amber-600"
													: "text-muted-foreground",
										)}
									>
										{formatTimeLabel(
											item.isAllDay ? null : item.startTime,
											t("allDay"),
										)}
									</span>
								</div>
								{item.todo.tags && item.todo.tags.length > 0 && (
									<div className="flex flex-wrap gap-1">
										{item.todo.tags.map((tag) => (
											<span
												key={tag}
												className="rounded-full bg-white/50 px-2 py-0.5 text-xs text-muted-foreground"
											>
												{tag}
											</span>
										))}
									</div>
								)}
							</div>
						</TodoContextMenu>
					))
				)}
			</div>
		</div>
	);
}
