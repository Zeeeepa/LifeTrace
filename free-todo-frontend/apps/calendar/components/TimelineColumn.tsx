/**
 * Timeline column with slots + items.
 */

import type React from "react";
import { useMemo, useRef, useState } from "react";
import type { Todo } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { TimelineItem } from "../types";
import {
	clampMinutes,
	DEFAULT_DURATION_MINUTES,
	formatMinutesLabel,
	formatTimeRangeLabel,
	MINUTES_PER_SLOT,
} from "../utils";
import { TimelineSlot } from "./TimelineSlot";
import { TimelineTodoCard } from "./TimelineTodoCard";

const MIN_ITEM_HEIGHT = 24;
const DEADLINE_HEIGHT = 20;

interface ResizePreview {
	id: number;
	startMinutes: number;
	endMinutes: number;
}

export function TimelineColumn({
	date,
	items,
	displayStart,
	slotMinutes,
	slotHeight,
	pxPerMinute,
	onSelect,
	onResize,
	className,
}: {
	date: Date;
	items: TimelineItem[];
	displayStart: number;
	slotMinutes: number[];
	slotHeight: number;
	pxPerMinute: number;
	onSelect: (todo: Todo) => void;
	onResize: (todo: Todo, startMinutes: number, endMinutes: number, date: Date) => void;
	className?: string;
}) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const [resizePreview, setResizePreview] = useState<ResizePreview | null>(null);
	const previewRef = useRef<ResizePreview | null>(null);

	const normalizedItems = useMemo(() => {
		return items.map((item) => {
			const preview =
				resizePreview && resizePreview.id === item.todo.id
					? resizePreview
					: null;
			const startMinutes = preview?.startMinutes ?? item.startMinutes;
			const endMinutes = preview?.endMinutes ?? item.endMinutes;
			const top = (startMinutes - displayStart) * pxPerMinute;
			const rawHeight = (endMinutes - startMinutes) * pxPerMinute;
			const height =
				item.kind === "range"
					? Math.max(MIN_ITEM_HEIGHT, rawHeight)
					: Math.max(DEADLINE_HEIGHT, slotHeight * 1.5);
			const timeLabel =
				item.kind === "range"
					? formatTimeRangeLabel(startMinutes, endMinutes)
					: `DDL ${formatMinutesLabel(startMinutes)}`;

			return {
				...item,
				startMinutes,
				endMinutes,
				top,
				height,
				timeLabel,
			};
		});
	}, [
		displayStart,
		items,
		pxPerMinute,
		resizePreview,
		slotHeight,
	]);

	const startResize = (
		item: TimelineItem,
		edge: "start" | "end",
		event: React.PointerEvent<HTMLButtonElement>,
	) => {
		event.preventDefault();
		event.stopPropagation();
		const initial = {
			id: item.todo.id,
			startMinutes: item.startMinutes,
			endMinutes:
				item.endMinutes > item.startMinutes
					? item.endMinutes
					: item.startMinutes + DEFAULT_DURATION_MINUTES,
		};
		setResizePreview(initial);
		previewRef.current = initial;

		const handleMove = (moveEvent: PointerEvent) => {
			const rect = containerRef.current?.getBoundingClientRect();
			if (!rect) return;
			const offset = moveEvent.clientY - rect.top;
			const minutes = clampMinutes(
				displayStart +
					Math.round((offset / pxPerMinute) / MINUTES_PER_SLOT) *
						MINUTES_PER_SLOT,
				0,
				24 * 60,
			);
			setResizePreview((prev) => {
				if (!prev || prev.id !== item.todo.id) return prev;
				const next =
					edge === "start"
						? {
								...prev,
								startMinutes: Math.min(minutes, prev.endMinutes - MINUTES_PER_SLOT),
							}
						: {
								...prev,
								endMinutes: Math.max(minutes, prev.startMinutes + MINUTES_PER_SLOT),
							};
				previewRef.current = next;
				return next;
			});
		};

		const handleUp = () => {
			const preview = previewRef.current;
			if (preview && preview.id === item.todo.id) {
				onResize(item.todo, preview.startMinutes, preview.endMinutes, date);
			}
			setResizePreview(null);
			previewRef.current = null;
			window.removeEventListener("pointermove", handleMove);
			window.removeEventListener("pointerup", handleUp);
		};

		window.addEventListener("pointermove", handleMove);
		window.addEventListener("pointerup", handleUp);
	};

	return (
		<div
			ref={containerRef}
			className={cn("relative h-full w-full", className)}
		>
			<div className="absolute inset-0">
				{slotMinutes.map((minutes) => (
					<TimelineSlot
						key={`${date.toDateString()}-${minutes}`}
						date={date}
						minutes={minutes}
						height={slotHeight}
						isHour={minutes % 60 === 0}
					/>
				))}
			</div>
			<div className="absolute inset-0">
				{normalizedItems.map((item) => (
					<TimelineTodoCard
						key={item.todo.id}
						todo={item.todo}
						top={item.top}
						height={item.height}
						timeLabel={item.timeLabel}
						variant={item.kind}
						onSelect={onSelect}
						onResizeStart={
							item.kind === "range"
								? (event) => startResize(item, "start", event)
								: undefined
						}
						onResizeEnd={
							item.kind === "range"
								? (event) => startResize(item, "end", event)
								: undefined
						}
					/>
				))}
			</div>
		</div>
	);
}
