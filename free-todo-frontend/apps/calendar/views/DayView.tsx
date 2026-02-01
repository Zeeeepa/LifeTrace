/**
 * Day timeline view.
 */

import { useTranslations } from "next-intl";
import type React from "react";
import { useMemo, useState } from "react";
import { useTodoMutations } from "@/lib/query";
import { useTodoStore } from "@/lib/store/todo-store";
import type { Todo } from "@/lib/types";
import { FloatingTodoCard } from "../components/FloatingTodoCard";
import { TimelineColumn } from "../components/TimelineColumn";
import type { TimelineItem } from "../types";
import {
	addMinutes,
	ceilToMinutes,
	clampMinutes,
	DEFAULT_DURATION_MINUTES,
	DEFAULT_WORK_END_MINUTES,
	DEFAULT_WORK_START_MINUTES,
	floorToMinutes,
	formatMinutesLabel,
	formatTimeRangeLabel,
	getMinutesFromDate,
	isSameDay,
	MINUTES_PER_SLOT,
	parseTodoDateTime,
	setMinutesOnDate,
} from "../utils";

const SLOT_HEIGHT = 12;

interface ParsedTodo {
	todo: Todo;
	deadline: Date | null;
	start: Date | null;
	end: Date | null;
}

export function DayView({
	currentDate,
	todos,
	onBlankClick,
	quickCreateSlot,
}: {
	currentDate: Date;
	todos: Todo[];
	onBlankClick?: () => void;
	quickCreateSlot?: React.ReactNode;
}) {
	const t = useTranslations("calendar");
	const { setSelectedTodoId } = useTodoStore();
	const { updateTodo } = useTodoMutations();
	const [workingStart, setWorkingStart] = useState(DEFAULT_WORK_START_MINUTES);
	const [workingEnd, setWorkingEnd] = useState(DEFAULT_WORK_END_MINUTES);
	const pxPerMinute = SLOT_HEIGHT / MINUTES_PER_SLOT;

	const parsedTodos = useMemo<ParsedTodo[]>(
		() =>
			todos.map((todo) => ({
				todo,
				deadline: parseTodoDateTime(todo.deadline),
				start: parseTodoDateTime(todo.startTime),
				end: parseTodoDateTime(todo.endTime),
			})),
		[todos],
	);

	const { timelineItems, floatingTodos } = useMemo(() => {
		const items: TimelineItem[] = [];
		const floating: Todo[] = [];

		for (const entry of parsedTodos) {
			const anchor = entry.start ?? entry.end ?? entry.deadline;
			const hasTime = Boolean(entry.start || entry.end || entry.deadline);
			if (!hasTime) {
				floating.push(entry.todo);
				continue;
			}
			if (!anchor || !isSameDay(anchor, currentDate)) continue;

			if (entry.start || entry.end) {
				const start = entry.start ?? addMinutes(entry.end as Date, -DEFAULT_DURATION_MINUTES);
				const end = entry.end ?? addMinutes(start, DEFAULT_DURATION_MINUTES);
				const startMinutes = getMinutesFromDate(start);
				const endMinutes = Math.max(
					startMinutes + MINUTES_PER_SLOT,
					getMinutesFromDate(end),
				);
				items.push({
					todo: entry.todo,
					kind: "range",
					date: currentDate,
					startMinutes,
					endMinutes,
					timeLabel: formatTimeRangeLabel(startMinutes, endMinutes),
				});
				continue;
			}

			const deadlineMinutes = getMinutesFromDate(entry.deadline as Date);
			items.push({
				todo: entry.todo,
				kind: "deadline",
				date: currentDate,
				startMinutes: deadlineMinutes,
				endMinutes: deadlineMinutes + MINUTES_PER_SLOT,
				timeLabel: `DDL ${formatMinutesLabel(deadlineMinutes)}`,
			});
		}

		items.sort((a, b) => a.startMinutes - b.startMinutes);
		return { timelineItems: items, floatingTodos: floating };
	}, [currentDate, parsedTodos]);

	const { displayStart, displayEnd } = useMemo(() => {
		if (timelineItems.length === 0) {
			return { displayStart: workingStart, displayEnd: workingEnd };
		}
		const minStart = Math.min(...timelineItems.map((item) => item.startMinutes));
		const maxEnd = Math.max(
			...timelineItems.map((item) =>
				item.kind === "range" ? item.endMinutes : item.startMinutes,
			),
		);
		const autoStart = floorToMinutes(minStart);
		const autoEnd = ceilToMinutes(maxEnd);
		return {
			displayStart: Math.min(workingStart, autoStart),
			displayEnd: Math.max(workingEnd, autoEnd),
		};
	}, [timelineItems, workingEnd, workingStart]);

	const slotMinutes = useMemo(() => {
		const total = Math.max(
			1,
			Math.ceil((displayEnd - displayStart) / MINUTES_PER_SLOT),
		);
		return Array.from({ length: total }, (_, idx) => displayStart + idx * MINUTES_PER_SLOT);
	}, [displayEnd, displayStart]);

	const handleResize = async (
		todo: Todo,
		startMinutes: number,
		endMinutes: number,
		date: Date,
	) => {
		const startDate = setMinutesOnDate(date, startMinutes);
		const endDate = setMinutesOnDate(date, endMinutes);
		await updateTodo(todo.id, {
			startTime: startDate.toISOString(),
			endTime: endDate.toISOString(),
		});
	};

	const handleWorkingPointerDown = (
		edge: "start" | "end",
		event: React.PointerEvent<HTMLDivElement>,
	) => {
		event.preventDefault();
		event.stopPropagation();
		const container = event.currentTarget.closest(
			"[data-timeline-container]",
		) as HTMLDivElement | null;
		if (!container) return;

		const handleMove = (moveEvent: PointerEvent) => {
			const rect = container.getBoundingClientRect();
			if (!rect) return;
			const offset = moveEvent.clientY - rect.top;
			const rawMinutes =
				displayStart +
				Math.round((offset / pxPerMinute) / MINUTES_PER_SLOT) * MINUTES_PER_SLOT;
			const minutes = clampMinutes(rawMinutes, 0, 24 * 60);

			if (edge === "start") {
				setWorkingStart(Math.min(minutes, workingEnd - MINUTES_PER_SLOT));
			} else {
				setWorkingEnd(Math.max(minutes, workingStart + MINUTES_PER_SLOT));
			}
		};

		const handleUp = () => {
			window.removeEventListener("pointermove", handleMove);
			window.removeEventListener("pointerup", handleUp);
		};

		window.addEventListener("pointermove", handleMove);
		window.addEventListener("pointerup", handleUp);
	};

	return (
		<div
			className="relative flex flex-col gap-4"
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
			<div className="rounded-xl border border-border bg-card/50 p-3 shadow-sm">
				<div className="mb-3 flex items-center justify-between text-xs font-semibold text-muted-foreground">
					<span>
						{t("allDay")} / {t("floating")}
					</span>
					<span className="text-[11px] text-muted-foreground">
						{floatingTodos.length}
					</span>
				</div>
				<div className="flex flex-wrap gap-2">
					{floatingTodos.length === 0 ? (
						<span className="text-xs text-muted-foreground">
							{t("floatingEmpty")}
						</span>
					) : (
						floatingTodos.map((todo) => (
							<FloatingTodoCard
								key={todo.id}
								todo={todo}
								onSelect={(selected) => setSelectedTodoId(selected.id)}
							/>
						))
					)}
				</div>
			</div>

			<div className="rounded-xl border border-border bg-card/50 p-3 shadow-sm">
				<div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
					<span className="font-semibold">{t("workingHours")}</span>
					<span>
						{formatMinutesLabel(displayStart)}-{formatMinutesLabel(displayEnd)}
					</span>
				</div>
				<div className="flex">
					<div className="relative w-14 shrink-0 pr-2 text-[11px] text-muted-foreground">
						{slotMinutes
							.filter((minutes) => minutes % 60 === 0)
							.map((minutes) => (
								<span
									key={`label-${minutes}`}
									className="absolute left-0"
									style={{
										top: (minutes - displayStart) * pxPerMinute - 6,
									}}
								>
									{formatMinutesLabel(minutes)}
								</span>
							))}
					</div>
					<div
						className="relative flex-1"
						style={{ height: slotMinutes.length * SLOT_HEIGHT }}
						data-timeline-container
					>
						<div
							className="absolute left-0 right-0 z-10 h-1 cursor-row-resize bg-primary/40"
							style={{
								top: (workingStart - displayStart) * pxPerMinute,
							}}
							onPointerDown={(event) =>
								handleWorkingPointerDown("start", event)
							}
						/>
						<div
							className="absolute left-0 right-0 z-10 h-1 cursor-row-resize bg-primary/40"
							style={{
								top: (workingEnd - displayStart) * pxPerMinute,
							}}
							onPointerDown={(event) => handleWorkingPointerDown("end", event)}
						/>
						<TimelineColumn
							date={currentDate}
							items={timelineItems}
							displayStart={displayStart}
							slotMinutes={slotMinutes}
							slotHeight={SLOT_HEIGHT}
							pxPerMinute={pxPerMinute}
							onSelect={(todo) => setSelectedTodoId(todo.id)}
							onResize={handleResize}
							className="border-l border-border/60"
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
