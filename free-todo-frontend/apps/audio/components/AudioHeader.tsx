"use client";

import { Calendar, ChevronLeft, ChevronRight, Mic, Upload } from "lucide-react";
import { useRef } from "react";
import { cn } from "@/lib/utils";

interface AudioHeaderProps {
	isRecording: boolean;
	selectedDate: Date;
	onDateChange: (date: Date) => void;
	onToggleRecording: () => void;
	onUpload?: () => void;
}

export function AudioHeader({
	isRecording,
	selectedDate,
	onDateChange,
	onToggleRecording,
	onUpload,
}: AudioHeaderProps) {
	const dateInputRef = useRef<HTMLInputElement | null>(null);

	const formatDate = (date: Date) => {
		const year = date.getFullYear();
		const month = date.getMonth() + 1;
		const day = date.getDate();
		return `${year}年${month}月${day}日 录音`;
	};

	const handlePrevDay = () => {
		const prevDate = new Date(selectedDate);
		prevDate.setDate(prevDate.getDate() - 1);
		onDateChange(prevDate);
	};

	const handleNextDay = () => {
		const nextDate = new Date(selectedDate);
		nextDate.setDate(nextDate.getDate() + 1);
		onDateChange(nextDate);
	};

	const handleToday = () => {
		// 点击“今天”弹出日历选择器（同时可快速选回今天）
		if (dateInputRef.current) {
			dateInputRef.current.showPicker?.();
			dateInputRef.current.click();
		} else {
			onDateChange(new Date());
		}
	};

	return (
		<div className="flex items-center justify-between px-4 py-3 border-b border-[oklch(var(--border))]">
			<div className="flex items-center gap-2">
				<input
					ref={dateInputRef}
					type="date"
					className="sr-only"
					value={selectedDate.toISOString().slice(0, 10)}
					onChange={(e) => {
						const v = e.target.value; // YYYY-MM-DD
						if (v) onDateChange(new Date(`${v}T00:00:00`));
					}}
				/>
				<button
					type="button"
					className="p-1.5 rounded hover:bg-[oklch(var(--muted))] transition-colors"
					onClick={handlePrevDay}
				>
					<ChevronLeft className="h-4 w-4" />
				</button>
				<button
					type="button"
					className="p-1.5 rounded hover:bg-[oklch(var(--muted))] transition-colors"
					onClick={handleToday}
					title="选择日期"
				>
					<Calendar className="h-4 w-4" />
				</button>
				<button
					type="button"
					className="p-1.5 rounded hover:bg-[oklch(var(--muted))] transition-colors"
					onClick={handleNextDay}
				>
					<ChevronRight className="h-4 w-4" />
				</button>
				<span className="text-sm text-[oklch(var(--muted-foreground))] ml-2">
					{formatDate(selectedDate)}
				</span>
			</div>

			<div className="flex items-center gap-2">
				{onUpload && (
					<button
						type="button"
						className="px-3 py-1.5 text-sm rounded-md hover:bg-[oklch(var(--muted))] transition-colors"
						onClick={onUpload}
					>
						<Upload className="h-4 w-4 inline mr-1" />
						测试音频
					</button>
				)}
				<button
					type="button"
					onClick={onToggleRecording}
					className={cn(
						"px-4 py-2 text-sm font-medium rounded-md transition-colors",
						isRecording
							? "bg-red-500 text-white hover:bg-red-600"
							: "bg-[oklch(var(--primary))] text-white hover:opacity-60"
					)}
				>
					<Mic className="h-4 w-4 inline mr-1" />
					{isRecording ? "停止录音" : "开始录音"}
				</button>
			</div>
		</div>
	);
}
