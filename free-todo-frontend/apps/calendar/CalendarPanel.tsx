"use client";

/**
 * 日历面板组件
 * 使用全局 DndContext，支持从其他面板拖拽 Todo 到日期
 */

import { Calendar, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PanelHeader } from "@/components/common/layout/PanelHeader";
import { useCreateTodo, useTodos } from "@/lib/query";
import { useTodoStore } from "@/lib/store/todo-store";
import type { Todo } from "@/lib/types";
import { cn } from "@/lib/utils";
import { QuickCreatePopover } from "./components/QuickCreatePopover";
import type { CalendarTodo, CalendarView } from "./types";
import {
	addDays,
	addMonths,
	DEFAULT_NEW_TIME,
	endOfDay,
	getWeekOfYear,
	parseDeadline,
	startOfDay,
	startOfMonth,
	startOfWeek,
	toDateKey,
} from "./utils";
import { DayView } from "./views/DayView";
import { MonthScroller } from "./views/MonthScroller";
import { WeekView } from "./views/WeekView";

export function CalendarPanel() {
	const t = useTranslations("calendar");

	// 从 TanStack Query 获取 todos 数据
	const { data: todos = [] } = useTodos();

	// 从 TanStack Query 获取创建 todo 的 mutation
	const createTodoMutation = useCreateTodo();

	// 从 Zustand 获取 UI 状态
	const { setSelectedTodoId } = useTodoStore();

	const [view, setView] = useState<CalendarView>("month");
	const [currentDate, setCurrentDate] = useState<Date>(startOfDay(new Date()));
	const [quickTargetDate, setQuickTargetDate] = useState<Date | null>(null);
	const [quickTitle, setQuickTitle] = useState("");
	const [quickTime, setQuickTime] = useState(DEFAULT_NEW_TIME);
	const [quickAnchorRect, setQuickAnchorRect] = useState<DOMRect | null>(null);
	const [monthItems, setMonthItems] = useState<Date[]>(() => {
		const base = startOfMonth(new Date());
		return [
			addMonths(base, -2),
			addMonths(base, -1),
			base,
			addMonths(base, 1),
			addMonths(base, 2),
		];
	});
	const monthItemsCount = monthItems.length;
	const monthScrollRef = useRef<HTMLDivElement>(null);
	const pendingScrollAdjust = useRef<{
		prevHeight: number;
		prevScrollTop: number;
	} | null>(null);
	const pendingScrollToMonth = useRef<Date | null>(null);

	const VIEW_OPTIONS: { id: CalendarView; label: string }[] = [
		{ id: "month", label: t("monthView") },
		{ id: "week", label: t("weekView") },
		{ id: "day", label: t("dayView") },
	];

	const WEEKDAY_LABELS = [
		t("weekdays.monday"),
		t("weekdays.tuesday"),
		t("weekdays.wednesday"),
		t("weekdays.thursday"),
		t("weekdays.friday"),
		t("weekdays.saturday"),
		t("weekdays.sunday"),
	];

	const range = useMemo(() => {
		if (view === "month") {
			if (monthItems.length > 0) {
				const first = monthItems[0];
				const last = monthItems[monthItems.length - 1];
				const start = startOfWeek(startOfMonth(first));
				const end = endOfDay(addDays(startOfWeek(startOfMonth(last)), 41));
				return { start, end };
			}
			const start = startOfWeek(startOfMonth(currentDate));
			const end = endOfDay(addDays(start, 41));
			return { start, end };
		}
		if (view === "week") {
			const start = startOfWeek(currentDate);
			const end = endOfDay(addDays(start, 6));
			return { start, end };
		}
		const start = startOfDay(currentDate);
		const end = endOfDay(currentDate);
		return { start, end };
	}, [currentDate, monthItems, view]);

	const todosWithDeadline: CalendarTodo[] = useMemo(() => {
		return todos
			.map((todo: Todo) => {
				const parsed = parseDeadline(todo.deadline);
				if (!parsed) return null;
				return {
					todo,
					deadline: parsed,
					dateKey: toDateKey(parsed),
				};
			})
			.filter((item): item is CalendarTodo => item !== null)
			.sort(
				(a: CalendarTodo, b: CalendarTodo) =>
					a.deadline.getTime() - b.deadline.getTime(),
			);
	}, [todos]);

	const todosInRange = useMemo(
		() =>
			todosWithDeadline.filter(
				(item) =>
					item.deadline.getTime() >= range.start.getTime() &&
					item.deadline.getTime() <= range.end.getTime(),
			),
		[range.end, range.start, todosWithDeadline],
	);

	const groupedByDay = useMemo(() => {
		const map = new Map<string, CalendarTodo[]>();
		for (const item of todosInRange) {
			const key = item.dateKey;
			if (!map.has(key)) {
				map.set(key, [item]);
			} else {
				map.get(key)?.push(item);
			}
		}
		return map;
	}, [todosInRange]);

	useEffect(() => {
		if (view !== "month") return;
		setMonthItems((prev) => {
			const target = startOfMonth(currentDate);
			if (prev.length === 0) {
				return [
					addMonths(target, -2),
					addMonths(target, -1),
					target,
					addMonths(target, 1),
					addMonths(target, 2),
				];
			}

			const hasTarget = prev.some(
				(item) =>
					item.getFullYear() === target.getFullYear() &&
					item.getMonth() === target.getMonth(),
			);
			if (hasTarget) return prev;

			const first = prev[0];
			const last = prev[prev.length - 1];
			const targetIndex = target.getFullYear() * 12 + target.getMonth();
			const firstIndex = first.getFullYear() * 12 + first.getMonth();
			const lastIndex = last.getFullYear() * 12 + last.getMonth();

			if (targetIndex < firstIndex) {
				const monthsToAdd: Date[] = [];
				let cursor = startOfMonth(first);
				while (
					cursor.getFullYear() * 12 + cursor.getMonth() > targetIndex
				) {
					cursor = addMonths(cursor, -1);
					monthsToAdd.unshift(cursor);
				}
				return [...monthsToAdd, ...prev];
			}

			if (targetIndex > lastIndex) {
				const monthsToAdd: Date[] = [];
				let cursor = startOfMonth(last);
				while (
					cursor.getFullYear() * 12 + cursor.getMonth() < targetIndex
				) {
					cursor = addMonths(cursor, 1);
					monthsToAdd.push(cursor);
				}
				return [...prev, ...monthsToAdd];
			}

			return prev;
		});
	}, [currentDate, view]);

	useEffect(() => {
		if (monthItemsCount === 0) return;
		if (!pendingScrollAdjust.current) return;
		const container = monthScrollRef.current;
		if (!container) return;
		const { prevHeight, prevScrollTop } = pendingScrollAdjust.current;
		pendingScrollAdjust.current = null;
		requestAnimationFrame(() => {
			const nextHeight = container.scrollHeight;
			container.scrollTop = prevScrollTop + (nextHeight - prevHeight);
		});
	}, [monthItemsCount]);

	useEffect(() => {
		if (view !== "month") return;
		if (!pendingScrollToMonth.current) return;
		const key = `${pendingScrollToMonth.current.getFullYear()}-${pendingScrollToMonth.current.getMonth()}`;
		const el = document.querySelector(`[data-month-key="${key}"]`);
		if (!el) return;
		(el as HTMLElement).scrollIntoView({ block: "start" });
		pendingScrollToMonth.current = null;
	}, [view]);

	const handleNavigate = (direction: "prev" | "next" | "today") => {
		if (direction === "today") {
			const today = startOfDay(new Date());
			if (view === "month") {
				const target = startOfMonth(today);
				pendingScrollToMonth.current = target;
				setCurrentDate(target);
			} else {
				setCurrentDate(today);
			}
			return;
		}

		if (view === "month") {
			const nextMonth =
				direction === "prev"
					? addMonths(startOfMonth(currentDate), -1)
					: addMonths(startOfMonth(currentDate), 1);
			pendingScrollToMonth.current = nextMonth;
			setCurrentDate(nextMonth);
			return;
		}

		const delta = view === "week" ? 7 : 1;
		const offset = direction === "prev" ? -delta : delta;
		setCurrentDate((prev) => startOfDay(addDays(prev, offset)));
	};

	const handleSelectDay = (
		date: Date,
		anchorEl?: HTMLDivElement | null,
		inCurrentMonth?: boolean,
	) => {
		const target = startOfDay(date);
		setQuickTargetDate(target);
		setQuickAnchorRect(anchorEl?.getBoundingClientRect() ?? null);
		if (view === "month" && inCurrentMonth === false) {
			return;
		}
		setCurrentDate(target);
	};

	const handleQuickCreate = async () => {
		if (!quickTargetDate || !quickTitle.trim()) return;
		const [hh, mm] = quickTime.split(":").map((n) => Number.parseInt(n, 10));
		const deadline = startOfDay(quickTargetDate);
		deadline.setHours(hh || 0, mm || 0, 0, 0);
		try {
			await createTodoMutation.mutateAsync({
				name: quickTitle.trim(),
				deadline: deadline.toISOString(),
				status: "active",
			});
			setQuickTitle("");
			setQuickTargetDate(null);
			setQuickAnchorRect(null);
		} catch (err) {
			console.error("Failed to create todo:", err);
		}
	};

	const renderQuickCreate = (date: Date, _className: string) => {
		if (!quickTargetDate) return null;
		if (toDateKey(date) !== toDateKey(quickTargetDate)) return null;
		const top = quickAnchorRect ? quickAnchorRect.top + 28 : 120;
		const left = quickAnchorRect ? quickAnchorRect.left + 4 : 16;
		const closePopover = () => {
			setQuickTargetDate(null);
			setQuickTitle("");
			setQuickAnchorRect(null);
		};

		return createPortal(
			<>
				<div
					className="fixed inset-0 z-40"
					aria-hidden
					onPointerDown={(event) => {
						event.preventDefault();
						event.stopPropagation();
						closePopover();
					}}
				/>
				<div
					className="fixed z-[9999] w-72 max-w-[90vw] pointer-events-auto"
					style={{ top, left }}
					data-quick-create
				>
					<QuickCreatePopover
						targetDate={quickTargetDate}
						value={quickTitle}
						time={quickTime}
						onChange={setQuickTitle}
						onTimeChange={setQuickTime}
						onConfirm={handleQuickCreate}
						onCancel={closePopover}
					/>
				</div>
			</>,
			document.body,
		);
	};

	const handleLoadMoreMonths = (direction: "prev" | "next") => {
		if (direction === "prev" && monthScrollRef.current) {
			pendingScrollAdjust.current = {
				prevHeight: monthScrollRef.current.scrollHeight,
				prevScrollTop: monthScrollRef.current.scrollTop,
			};
		}
		setMonthItems((prev) => {
			if (prev.length === 0) return prev;
			if (direction === "prev") {
				const first = prev[0];
				return [addMonths(first, -1), ...prev];
			}
			const last = prev[prev.length - 1];
			return [...prev, addMonths(last, 1)];
		});
	};

	const handleActiveMonthChange = useCallback(
		(month: Date) => {
			if (view !== "month") return;
			const currentMonth = startOfMonth(currentDate);
			if (
				currentMonth.getFullYear() === month.getFullYear() &&
				currentMonth.getMonth() === month.getMonth()
			) {
				return;
			}
			setCurrentDate(month);
		},
		[currentDate, view],
	);

	return (
		<div className="flex h-full flex-col overflow-hidden bg-background">
			{/* 顶部标题栏 */}
			<PanelHeader icon={Calendar} title={t("title")} />
			{/* 顶部工具栏 */}
			<div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
				<span className="text-sm font-medium text-foreground">
					{view === "month" &&
						t("yearMonth", {
							year: currentDate.getFullYear(),
							month: `${currentDate.getMonth() + 1}`.padStart(2, "0"),
						})}
					{view === "week" &&
						t("yearMonthWeek", {
							year: currentDate.getFullYear(),
							month: `${currentDate.getMonth() + 1}`.padStart(2, "0"),
							week: getWeekOfYear(currentDate),
						})}
					{view === "day" &&
						t("yearMonthDay", {
							year: currentDate.getFullYear(),
							month: `${currentDate.getMonth() + 1}`.padStart(2, "0"),
							day: `${currentDate.getDate()}`.padStart(2, "0"),
						})}
				</span>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() => handleNavigate("prev")}
						className="inline-flex h-9 w-9 items-center justify-center rounded-md border bg-card text-muted-foreground hover:bg-muted/60"
						aria-label={t("previous")}
					>
						<ChevronLeft className="h-4 w-4" />
					</button>
					<button
						type="button"
						onClick={() => handleNavigate("today")}
						className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/60"
					>
						<RotateCcw className="h-4 w-4" />
						{t("today")}
					</button>
					<button
						type="button"
						onClick={() => handleNavigate("next")}
						className="inline-flex h-9 w-9 items-center justify-center rounded-md border bg-card text-muted-foreground hover:bg-muted/60"
						aria-label={t("next")}
					>
						<ChevronRight className="h-4 w-4" />
					</button>
				</div>
				<div className="flex items-center gap-2">
					{VIEW_OPTIONS.map((option) => (
						<button
							key={option.id}
							type="button"
							onClick={() => setView(option.id)}
							className={cn(
								"rounded-md px-3 py-2 text-sm font-medium transition-colors",
								view === option.id
									? "bg-primary text-primary-foreground shadow-sm"
									: "bg-card text-muted-foreground hover:bg-muted/60",
							)}
						>
							{option.label}
						</button>
					))}
					{/* <button
						type="button"
						onClick={() => {
							setQuickTargetDate(startOfDay(currentDate));
							setQuickAnchorRect(null);
						}}
						className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
					>
						<Plus className="h-4 w-4" />
						{t("create")}
					</button> */}
				</div>
			</div>

			{/* 视图主体 */}
			<div
				ref={monthScrollRef}
				className="flex-1 overflow-y-auto bg-background p-3"
			>
					{view === "month" && (
						<div className="grid grid-cols-7">
							{WEEKDAY_LABELS.map((label) => (
								<span
								key={label}
								className="py-2 text-center text-xs font-medium text-muted-foreground"
							>
								{t("weekPrefix")}
								{label}
							</span>
						))}
					</div>
				)}
				<div>
					{view === "month" && (
						<MonthScroller
							months={
								monthItems.length > 0
									? monthItems
									: [startOfMonth(currentDate)]
							}
							activeMonth={startOfMonth(currentDate)}
							groupedByDay={groupedByDay}
							onSelectDay={handleSelectDay}
							onSelectTodo={(todo) => setSelectedTodoId(todo.id)}
							todayText={t("today")}
							renderQuickCreate={(date) =>
								renderQuickCreate(date, "absolute left-1 top-7 z-20 w-72 max-w-[90vw]")
							}
							onLoadMore={handleLoadMoreMonths}
							onActiveMonthChange={handleActiveMonthChange}
							scrollRef={monthScrollRef}
						/>
					)}
					{view === "week" && (
						<WeekView
							currentDate={currentDate}
							todos={todos}
							onSelectDay={handleSelectDay}
							onSelectTodo={(todo) => setSelectedTodoId(todo.id)}
							todayText={t("today")}
							renderQuickCreate={(date) =>
								renderQuickCreate(date, "absolute left-1 top-7 z-20 w-72 max-w-[90vw]")
							}
						/>
					)}
					{view === "day" && (
						<DayView
							currentDate={currentDate}
							todos={todos}
							onBlankClick={() => {
								setQuickTargetDate(startOfDay(currentDate));
								setQuickAnchorRect(null);
							}}
							quickCreateSlot={renderQuickCreate(
								currentDate,
								"absolute right-3 top-3 z-20 w-96 max-w-[90vw]",
							)}
						/>
					)}
				</div>
			</div>
		</div>
	);
}
