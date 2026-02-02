"use client";

import { Bell, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import {
	type RefObject,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import { ReminderOptions } from "@/components/common/ReminderOptions";
import { normalizeReminderOffsets } from "@/lib/reminders";
import { useLocaleStore } from "@/lib/store/locale";
import type { UpdateTodoInput } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
	buildMonthDays,
	type CalendarDay,
	toDateKey,
	WEEKDAY_KEYS,
	type WeekdayKey,
} from "../utils";
import { SOLAR_TERMS } from "../utils/lunar-utils";

interface DatePickerPopoverProps {
	anchorRef: RefObject<HTMLElement | null>;
	deadline?: string;
	startTime?: string;
	endTime?: string;
	reminderOffsets?: number[] | null;
	onSave: (input: UpdateTodoInput) => void;
	onClose: () => void;
}

const POPOVER_MARGIN = 8;

export function DatePickerPopover({
	anchorRef,
	deadline,
	startTime,
	endTime,
	reminderOffsets,
	onSave,
	onClose,
}: DatePickerPopoverProps) {
	const popoverRef = useRef<HTMLDivElement>(null);
	const { locale } = useLocaleStore();
	const tCalendar = useTranslations("calendar");
	const tDatePicker = useTranslations("datePicker");
	const tReminder = useTranslations("reminder");
	const tTodoDetail = useTranslations("todoDetail");

	const initialDate = useMemo(() => {
		const candidates = [deadline, startTime, endTime];
		for (const value of candidates) {
			if (!value) continue;
			const parsed = new Date(value);
			if (!Number.isNaN(parsed.getTime())) {
				return parsed;
			}
		}
		return null;
	}, [deadline, endTime, startTime]);

	const [currentMonth, setCurrentMonth] = useState<Date>(
		() => initialDate ?? new Date(),
	);
	const [selectedDate, setSelectedDate] = useState<Date | null>(
		() => initialDate,
	);
	const [startTimeInput, setStartTimeInput] = useState<string>(() =>
		toTimeValue(deadline ?? startTime),
	);
	const [endTimeInput, setEndTimeInput] = useState<string>(() =>
		toTimeValue(endTime),
	);
	const [draftReminderOffsets, setDraftReminderOffsets] = useState<number[]>(
		() => normalizeReminderOffsets(reminderOffsets),
	);

	const monthDays = useMemo(
		() => buildMonthDays(currentMonth),
		[currentMonth],
	);
	const showLunar = locale === "zh";

	const updatePosition = useCallback(() => {
		if (typeof window === "undefined") return;
		const anchor = anchorRef.current;
		const popover = popoverRef.current;
		if (!anchor || !popover) return;

		const anchorRect = anchor.getBoundingClientRect();
		const popoverRect = popover.getBoundingClientRect();
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;

		let left = anchorRect.left;
		let top = anchorRect.bottom + POPOVER_MARGIN;

		if (left + popoverRect.width > viewportWidth - POPOVER_MARGIN) {
			left = viewportWidth - popoverRect.width - POPOVER_MARGIN;
		}
		if (left < POPOVER_MARGIN) {
			left = POPOVER_MARGIN;
		}
		if (top + popoverRect.height > viewportHeight - POPOVER_MARGIN) {
			top = anchorRect.top - popoverRect.height - POPOVER_MARGIN;
		}
		if (top < POPOVER_MARGIN) {
			top = POPOVER_MARGIN;
		}

		popover.style.left = `${Math.round(left)}px`;
		popover.style.top = `${Math.round(top)}px`;
	}, [anchorRef]);

	useEffect(() => {
		updatePosition();
		const handleResize = () => updatePosition();
		window.addEventListener("resize", handleResize);
		window.addEventListener("scroll", handleResize, true);

		return () => {
			window.removeEventListener("resize", handleResize);
			window.removeEventListener("scroll", handleResize, true);
		};
	}, [updatePosition]);

	useEffect(() => {
		const raf = window.requestAnimationFrame(updatePosition);
		return () => window.cancelAnimationFrame(raf);
	}, [updatePosition]);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as Node;
			if (popoverRef.current?.contains(target)) {
				return;
			}
			onClose();
		};

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				onClose();
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		document.addEventListener("keydown", handleKeyDown);

		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [onClose]);

	const handlePrevMonth = () => {
		setCurrentMonth((prev) => {
			const next = new Date(prev);
			next.setMonth(next.getMonth() - 1);
			return next;
		});
	};

	const handleNextMonth = () => {
		setCurrentMonth((prev) => {
			const next = new Date(prev);
			next.setMonth(next.getMonth() + 1);
			return next;
		});
	};

	const handleToday = () => {
		const today = new Date();
		setCurrentMonth(today);
		setSelectedDate(today);
	};

	const handleSelectDate = (day: CalendarDay) => {
		setSelectedDate(day.date);
		if (day.date.getMonth() !== currentMonth.getMonth()) {
			setCurrentMonth(day.date);
		}
	};

	const handleStartTimeChange = (value: string) => {
		setStartTimeInput(value);
		if (!value) {
			setEndTimeInput("");
		}
	};

	const handleClear = () => {
		onSave({
			deadline: null,
			startTime: null,
			endTime: null,
			reminderOffsets: draftReminderOffsets,
		});
		onClose();
	};

	const handleSave = () => {
		const payload: UpdateTodoInput = {
			reminderOffsets: draftReminderOffsets,
		};

		if (selectedDate) {
			const deadlineIso = buildIsoWithTime(selectedDate, startTimeInput);
			payload.deadline = deadlineIso;

			const hasExistingStart = Boolean(startTime);
			const hasExistingEnd = Boolean(endTime);
			const wantsTimeRange =
				Boolean(endTimeInput) || hasExistingStart || hasExistingEnd;

			if (startTimeInput && wantsTimeRange) {
				payload.startTime = deadlineIso;
			} else if (hasExistingStart) {
				payload.startTime = null;
			}

			if (endTimeInput) {
				payload.endTime = buildIsoWithTime(selectedDate, endTimeInput);
			} else if (hasExistingEnd) {
				payload.endTime = null;
			}
		}

		onSave(payload);
		onClose();
	};

	if (typeof document === "undefined") {
		return null;
	}

	return createPortal(
		<div className="fixed inset-0 z-[9999] pointer-events-none">
			<div
				ref={popoverRef}
				className={cn(
					"pointer-events-auto w-[360px] max-w-[calc(100vw-16px)] rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl",
				)}
				style={{ position: "absolute", left: -9999, top: -9999 }}
			>
				<MonthNavigation
					currentMonth={currentMonth}
					onPrevMonth={handlePrevMonth}
					onNextMonth={handleNextMonth}
					onToday={handleToday}
					tCalendar={tCalendar}
				/>

				<WeekdayHeader tCalendar={tCalendar} />

				<CalendarGrid
					monthDays={monthDays}
					selectedDate={selectedDate}
					showLunar={showLunar}
					onSelectDate={handleSelectDate}
				/>

				<div className="px-4 py-3">
					<div className="flex items-center gap-2 text-xs text-muted-foreground">
						<Clock className="h-4 w-4" />
						<span>{tDatePicker("timeRange")}</span>
					</div>
					<div className="mt-2 grid grid-cols-2 gap-2">
						<label className="flex flex-col gap-1 text-xs text-muted-foreground">
							<span>{tDatePicker("startTime")}</span>
							<input
								type="time"
								value={startTimeInput}
								onChange={(event) =>
									handleStartTimeChange(event.target.value)
								}
								disabled={!selectedDate}
								className={cn(
									"rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground",
									"focus:outline-none focus:ring-2 focus:ring-primary/30",
									!selectedDate && "cursor-not-allowed opacity-60",
								)}
							/>
						</label>
						<label className="flex flex-col gap-1 text-xs text-muted-foreground">
							<span>{tDatePicker("endTime")}</span>
							<input
								type="time"
								value={endTimeInput}
								onChange={(event) => setEndTimeInput(event.target.value)}
								disabled={!selectedDate || !startTimeInput}
								className={cn(
									"rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground",
									"focus:outline-none focus:ring-2 focus:ring-primary/30",
									(!selectedDate || !startTimeInput) &&
										"cursor-not-allowed opacity-60",
								)}
							/>
						</label>
					</div>
				</div>

				<div className="border-t border-border/70 px-4 py-3">
					<div className="flex items-center justify-between text-xs text-muted-foreground">
						<span className="flex items-center gap-2">
							<Bell className="h-3.5 w-3.5" />
							{tReminder("label")}
						</span>
						{!selectedDate && (
							<span className="text-[11px]">{tReminder("needsDeadline")}</span>
						)}
					</div>
					<div className="mt-2 rounded-lg border border-border/60 bg-background/60 p-2">
						<ReminderOptions
							value={draftReminderOffsets}
							onChange={setDraftReminderOffsets}
							compact
							showClear
						/>
					</div>
				</div>

				<div className="flex items-center gap-2 p-3">
					<button
						type="button"
						onClick={handleClear}
						className="flex-1 rounded-lg border border-border py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
					>
						{tTodoDetail("clear")}
					</button>
					<button
						type="button"
						onClick={handleSave}
						className="flex-1 rounded-lg bg-primary py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
					>
						{tTodoDetail("save")}
					</button>
				</div>
			</div>
		</div>,
		document.body,
	);
}

interface MonthNavigationProps {
	currentMonth: Date;
	onPrevMonth: () => void;
	onNextMonth: () => void;
	onToday: () => void;
	tCalendar: ReturnType<typeof useTranslations<"calendar">>;
}

function MonthNavigation({
	currentMonth,
	onPrevMonth,
	onNextMonth,
	onToday,
	tCalendar,
}: MonthNavigationProps) {
	return (
		<div className="flex items-center justify-between px-4 py-2">
			<span className="text-sm font-medium">
				{tCalendar("yearMonth", {
					year: currentMonth.getFullYear(),
					month: currentMonth.getMonth() + 1,
				})}
			</span>
			<div className="flex items-center gap-1">
				<button
					type="button"
					onClick={onPrevMonth}
					className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
				>
					<ChevronLeft className="h-4 w-4" />
				</button>
				<button
					type="button"
					onClick={onToday}
					className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
				>
					<span className="flex h-4 w-4 items-center justify-center text-xs">
						○
					</span>
				</button>
				<button
					type="button"
					onClick={onNextMonth}
					className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
				>
					<ChevronRight className="h-4 w-4" />
				</button>
			</div>
		</div>
	);
}

interface WeekdayHeaderProps {
	tCalendar: ReturnType<typeof useTranslations<"calendar">>;
}

function WeekdayHeader({ tCalendar }: WeekdayHeaderProps) {
	return (
		<div className="grid grid-cols-7 px-2">
			{WEEKDAY_KEYS.map((key, idx) => (
				<span
					key={key}
					className={cn(
						"py-1 text-center text-xs font-medium",
						idx >= 5 ? "text-muted-foreground/70" : "text-muted-foreground",
					)}
				>
					{tCalendar(`weekdays.${key}` as `weekdays.${WeekdayKey}`)}
				</span>
			))}
		</div>
	);
}

interface CalendarGridProps {
	monthDays: CalendarDay[];
	selectedDate: Date | null;
	showLunar: boolean;
	onSelectDate: (day: CalendarDay) => void;
}

function CalendarGrid({
	monthDays,
	selectedDate,
	showLunar,
	onSelectDate,
}: CalendarGridProps) {
	return (
		<div className="grid grid-cols-7 gap-0.5 px-2 pb-2">
			{monthDays.map((day, idx) => {
				const isSelected =
					selectedDate && toDateKey(day.date) === toDateKey(selectedDate);
				const dayOfWeek = (idx % 7) + 1;
				const isWeekend = dayOfWeek >= 6;

				return (
					<button
						key={toDateKey(day.date)}
						type="button"
						onClick={() => onSelectDate(day)}
						className={cn(
							"relative flex flex-col items-center rounded-lg py-1 transition-colors",
							!day.inCurrentMonth && "opacity-40",
							isSelected
								? "bg-primary text-primary-foreground"
								: day.isToday
									? "bg-primary/10 text-primary"
									: "hover:bg-muted/50",
						)}
					>
						<span
							className={cn(
								"text-sm font-medium",
								isWeekend && !isSelected && "text-muted-foreground/80",
							)}
						>
							{day.date.getDate()}
						</span>
						<span
							className={cn(
								"text-[10px] leading-tight",
								isSelected
									? "text-primary-foreground/80"
									: day.lunarText.includes("月") ||
											SOLAR_TERMS.includes(
												day.lunarText as (typeof SOLAR_TERMS)[number],
											)
										? "text-orange-500"
										: "text-muted-foreground/60",
							)}
						>
							{showLunar ? day.lunarText : ""}
						</span>
						{day.holiday?.isHoliday !== undefined && (
							<span
								className={cn(
									"absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-sm text-[8px] font-bold",
									day.holiday.isHoliday
										? "bg-green-500 text-white"
										: "bg-orange-500 text-white",
								)}
							>
								{day.holiday.isHoliday ? "休" : "班"}
							</span>
						)}
					</button>
				);
			})}
		</div>
	);
}

const toTimeValue = (value?: string): string => {
	if (!value) return "";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	const hh = `${date.getHours()}`.padStart(2, "0");
	const mm = `${date.getMinutes()}`.padStart(2, "0");
	return `${hh}:${mm}`;
};

const buildIsoWithTime = (date: Date, time: string): string => {
	const result = new Date(date);
	if (time) {
		const [hh, mm] = time.split(":").map((n) => Number.parseInt(n, 10));
		result.setHours(hh || 0, mm || 0, 0, 0);
	} else {
		result.setHours(0, 0, 0, 0);
	}
	return result.toISOString();
};
