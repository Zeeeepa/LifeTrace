"use client";

import { Calendar, Flag, Tag as TagIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import {
	formatReminderSummary,
	normalizeReminderOffsets,
} from "@/lib/reminders";
import type { Todo, TodoPriority, TodoStatus, UpdateTodoInput } from "@/lib/types";
import { cn, getPriorityLabel, getStatusLabel } from "@/lib/utils";
import {
	formatDeadline,
	getPriorityClassNames,
	getStatusClassNames,
	priorityOptions,
	statusOptions,
} from "../helpers";
import { DatePickerPopover } from "./DatePickerPopover";

interface MetaSectionProps {
	todo: Todo;
	onStatusChange: (status: TodoStatus) => void;
	onPriorityChange: (priority: TodoPriority) => void;
	onTagsChange: (tags: string[]) => void;
	onScheduleChange: (input: UpdateTodoInput) => void;
}

export function MetaSection({
	todo,
	onStatusChange,
	onPriorityChange,
	onTagsChange,
	onScheduleChange,
}: MetaSectionProps) {
	const tCommon = useTranslations("common");
	const tTodoDetail = useTranslations("todoDetail");
	const tReminder = useTranslations("reminder");
	const statusMenuRef = useRef<HTMLDivElement | null>(null);
	const priorityMenuRef = useRef<HTMLDivElement | null>(null);
	const deadlineButtonRef = useRef<HTMLButtonElement | null>(null);

	const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
	const [isPriorityMenuOpen, setIsPriorityMenuOpen] = useState(false);
	const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
	const [isEditingTags, setIsEditingTags] = useState(false);
	const [tagsInput, setTagsInput] = useState(todo.tags?.join(", ") ?? "");

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as Node;
			if (statusMenuRef.current && !statusMenuRef.current.contains(target)) {
				setIsStatusMenuOpen(false);
			}
			if (
				priorityMenuRef.current &&
				!priorityMenuRef.current.contains(target)
			) {
				setIsPriorityMenuOpen(false);
			}
		};

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setIsStatusMenuOpen(false);
				setIsPriorityMenuOpen(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		document.addEventListener("keydown", handleKeyDown);

		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, []);

	useEffect(() => {
		setIsStatusMenuOpen(false);
		setIsPriorityMenuOpen(false);
		setIsDatePickerOpen(false);
		setIsEditingTags(false);
		setTagsInput(todo.tags?.join(", ") ?? "");
	}, [todo.tags]);

	const handleTagsSave = () => {
		const parsedTags = tagsInput
			.split(",")
			.map((t) => t.trim())
			.filter(Boolean);
		onTagsChange(parsedTags);
		setIsEditingTags(false);
	};

	const handleTagsClear = () => {
		onTagsChange([]);
		setTagsInput("");
		setIsEditingTags(false);
	};

	const savedReminderOffsets = normalizeReminderOffsets(todo.reminderOffsets);
	const reminderSummary = formatReminderSummary(
		tReminder,
		savedReminderOffsets,
		tReminder("noReminder"),
	);
	const timeRangeSummary = formatTimeRange(todo.startTime, todo.endTime);
	const scheduleSummaryParts = [
		todo.deadline ? formatDeadline(todo.deadline) : tTodoDetail("addDeadline"),
		timeRangeSummary,
		savedReminderOffsets.length ? reminderSummary : "",
	].filter(Boolean);
	const scheduleSummary = scheduleSummaryParts.join(" · ");

	return (
		<div className="mb-6 text-sm text-muted-foreground">
			<div className="flex flex-wrap items-center gap-3">
				<div className="relative flex items-center" ref={statusMenuRef}>
					<button
						type="button"
						onClick={() => setIsStatusMenuOpen((prev) => !prev)}
						className={cn(
							getStatusClassNames(todo.status),
							"transition-colors hover:bg-muted/40",
						)}
						aria-expanded={isStatusMenuOpen}
						aria-haspopup="listbox"
					>
						{getStatusLabel(todo.status, tCommon)}
					</button>
					{isStatusMenuOpen && (
						<div className="pointer-events-auto absolute left-0 top-full z-120 mt-2 min-w-[170px] rounded-md border border-border bg-background shadow-lg">
							<div className="py-1" role="listbox">
								{statusOptions.map((status) => (
									<button
										key={status}
										type="button"
										onClick={() => {
											if (status !== todo.status) {
												onStatusChange(status);
											}
											setIsStatusMenuOpen(false);
										}}
										className={cn(
											"flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors",
											status === todo.status
												? "bg-muted/60 text-foreground"
												: "text-foreground hover:bg-muted/70",
										)}
										role="option"
										aria-selected={status === todo.status}
									>
										<span className={getStatusClassNames(status)}>
											{getStatusLabel(status, tCommon)}
										</span>
										{status === todo.status && (
											<span className="text-[11px] text-primary">
												{tTodoDetail("current")}
											</span>
										)}
									</button>
								))}
							</div>
						</div>
					)}
				</div>

				<div className="relative flex items-center" ref={priorityMenuRef}>
					<button
						type="button"
						onClick={() => setIsPriorityMenuOpen((prev) => !prev)}
						className={cn(
							getPriorityClassNames(todo.priority ?? "none"),
							"transition-colors hover:bg-muted/40",
						)}
						aria-expanded={isPriorityMenuOpen}
						aria-haspopup="listbox"
					>
						<Flag className="h-3 w-3" fill="currentColor" aria-hidden />
						{getPriorityLabel(todo.priority ?? "none", tCommon)}
					</button>
					{isPriorityMenuOpen && (
						<div className="pointer-events-auto absolute left-0 top-full z-120 mt-2 min-w-[170px] rounded-md border border-border bg-background shadow-lg">
							<div className="py-1" role="listbox">
								{priorityOptions.map((priority) => (
									<button
										key={priority}
										type="button"
										onClick={() => {
											if (priority !== (todo.priority ?? "none")) {
												onPriorityChange(priority);
											}
											setIsPriorityMenuOpen(false);
										}}
										className={cn(
											"flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors",
											priority === (todo.priority ?? "none")
												? "bg-muted/60 text-foreground"
												: "text-foreground hover:bg-muted/70",
										)}
										role="option"
										aria-selected={priority === (todo.priority ?? "none")}
									>
										<span className={getPriorityClassNames(priority)}>
											<Flag
												className="h-3.5 w-3.5"
												fill="currentColor"
												aria-hidden
											/>
											{getPriorityLabel(priority, tCommon)}
										</span>
										{priority === (todo.priority ?? "none") && (
											<span className="text-[11px] text-primary">
												{tTodoDetail("current")}
											</span>
										)}
									</button>
								))}
							</div>
						</div>
					)}
				</div>

				<div className="relative flex items-center">
					<button
						ref={deadlineButtonRef}
						type="button"
						onClick={() => setIsDatePickerOpen((prev) => !prev)}
						className="flex items-center gap-1 rounded-md border border-transparent px-2 py-1 text-xs transition-colors hover:border-border hover:bg-muted/40"
						aria-expanded={isDatePickerOpen}
						aria-haspopup="dialog"
					>
						<Calendar className="h-3 w-3" />
						<span className="truncate">{scheduleSummary}</span>
					</button>
					{isDatePickerOpen && (
						<DatePickerPopover
							anchorRef={deadlineButtonRef}
							deadline={todo.deadline}
							startTime={todo.startTime}
							endTime={todo.endTime}
							reminderOffsets={todo.reminderOffsets}
							onSave={(input) => onScheduleChange(input)}
							onClose={() => setIsDatePickerOpen(false)}
						/>
					)}
				</div>

				<button
					type="button"
					onClick={() => {
						setTagsInput(todo.tags?.join(", ") ?? "");
						setIsEditingTags(true);
					}}
					className="flex items-center gap-1 rounded-md border border-transparent px-2 py-1 text-xs transition-colors hover:border-border hover:bg-muted/40"
				>
					<TagIcon className="h-3 w-3" />
					<span className="truncate">
						{todo.tags && todo.tags.length > 0
							? todo.tags.join(", ")
							: tTodoDetail("addTags")}
					</span>
				</button>

			</div>

			{isEditingTags && (
				<div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-foreground">
					<input
						type="text"
						value={tagsInput}
						onChange={(e) => setTagsInput(e.target.value)}
						placeholder={tTodoDetail("tagsPlaceholder")}
						className="min-w-[240px] rounded-md border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
					/>
					<button
						type="button"
						onClick={handleTagsSave}
						className="rounded-md bg-primary px-2 py-1 text-sm text-primary-foreground transition-colors hover:bg-primary/90"
					>
						{tTodoDetail("save")}
					</button>
					<button
						type="button"
						onClick={() => {
							setIsEditingTags(false);
							setTagsInput(todo.tags?.join(", ") ?? "");
						}}
						className="rounded-md border border-border px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted/40"
					>
						{tTodoDetail("cancel")}
					</button>
					<button
						type="button"
						onClick={handleTagsClear}
						className="rounded-md border border-destructive/40 px-2 py-1 text-sm text-destructive transition-colors hover:bg-destructive/10"
					>
						{tTodoDetail("clear")}
					</button>
				</div>
			)}
		</div>
	);
}

const formatTimeRange = (startTime?: string, endTime?: string): string => {
	if (!endTime) return "";
	const start = toTimeDisplay(startTime);
	const end = toTimeDisplay(endTime);
	if (start && end) return `${start}-${end}`;
	return end;
};

const toTimeDisplay = (value?: string): string => {
	if (!value) return "";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};
