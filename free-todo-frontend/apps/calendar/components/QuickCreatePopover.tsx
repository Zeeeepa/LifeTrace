"use client";

/**
 * 日历内就地创建 Popover
 */

import { Calendar, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { formatHumanDate } from "../utils";

export function QuickCreatePopover({
	targetDate,
	value,
	time,
	onChange,
	onTimeChange,
	onConfirm,
	onCancel,
}: {
	targetDate: Date | null;
	value: string;
	time: string;
	onChange: (v: string) => void;
	onTimeChange: (v: string) => void;
	onConfirm: () => void;
	onCancel: () => void;
}) {
	const t = useTranslations("calendar");
	const containerRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (targetDate) {
			inputRef.current?.focus();
		}
	}, [targetDate]);

	useEffect(() => {
		if (!targetDate) return;

		const handlePointerDown = (event: MouseEvent) => {
			if (!containerRef.current) return;
			if (!containerRef.current.contains(event.target as Node)) {
				onCancel();
			}
		};

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				onCancel();
			}
		};

		document.addEventListener("mousedown", handlePointerDown);
		document.addEventListener("keydown", handleKeyDown);

		return () => {
			document.removeEventListener("mousedown", handlePointerDown);
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [onCancel, targetDate]);

	if (!targetDate) return null;

	return (
		<div
			ref={containerRef}
			onClick={(event) => event.stopPropagation()}
			onKeyDown={(event) => {
				if (event.key === "Enter" || event.key === " ") {
					event.stopPropagation();
				}
			}}
			role="button"
			tabIndex={0}
			className="flex flex-col gap-3 rounded-xl border bg-background/95 p-4 shadow-xl backdrop-blur"
		>
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2 text-sm text-muted-foreground">
					<Calendar className="h-4 w-4" />
					<span>{t("createOnDate", { date: formatHumanDate(targetDate) })}</span>
				</div>
				<button
					type="button"
					onClick={onCancel}
					className="rounded-md p-1 text-muted-foreground hover:bg-muted/50"
					aria-label={t("closeCreate")}
				>
					<X className="h-4 w-4" />
				</button>
			</div>
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
				<input
					ref={inputRef}
					value={value}
					onChange={(e) => onChange(e.target.value)}
					placeholder={t("inputTodoTitle")}
					className="flex-1 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
				/>
				<div className="flex items-center gap-2">
					<input
						type="time"
						value={time}
						onChange={(e) => onTimeChange(e.target.value)}
						className="rounded-md border px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
					/>
					<button
						type="button"
						onClick={onConfirm}
						disabled={!value.trim()}
						className={cn(
							"inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors",
							!value.trim() && "opacity-60",
						)}
					>
						<Plus className="h-4 w-4" />
						{t("create")}
					</button>
				</div>
			</div>
		</div>
	);
}
