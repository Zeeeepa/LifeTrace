/**
 * Timeline droppable slot (15 min).
 */

import { useDroppable } from "@dnd-kit/core";
import { useMemo } from "react";
import type { DropData } from "@/lib/dnd";
import { cn } from "@/lib/utils";
import { toDateKey } from "../utils";

export function TimelineSlot({
	date,
	minutes,
	height,
	isHour,
	onSlotPointerDown,
}: {
	date: Date;
	minutes: number;
	height: number;
	isHour: boolean;
	onSlotPointerDown?: (args: {
		date: Date;
		minutes: number;
		anchorRect: DOMRect;
		clientX: number;
		clientY: number;
	}) => void;
}) {
	const dateKey = toDateKey(date);
	const dropData: DropData = useMemo(
		() => ({
			type: "CALENDAR_TIMELINE_SLOT" as const,
			metadata: {
				date,
				dateKey,
				minutes,
			},
		}),
		[date, dateKey, minutes],
	);

	const { isOver, setNodeRef } = useDroppable({
		id: `timeline-${dateKey}-${minutes}`,
		data: dropData,
	});

	return (
		<div
			ref={setNodeRef}
			className={cn(
				"relative w-full",
				isHour ? "border-t border-border/60" : "border-t border-transparent",
				isOver && "bg-primary/10",
			)}
			style={{ height }}
			onPointerDown={(event) => {
				if (!onSlotPointerDown) return;
				if ((event.target as HTMLElement | null)?.closest("[data-timeline-item]")) {
					return;
				}
				event.preventDefault();
				event.stopPropagation();
				onSlotPointerDown({
					date,
					minutes,
					anchorRect: (event.currentTarget as HTMLDivElement).getBoundingClientRect(),
					clientX: event.clientX,
					clientY: event.clientY,
				});
			}}
		/>
	);
}
