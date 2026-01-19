"use client";

import { Calendar, ChevronLeft, ChevronRight, Download, Edit, Mic, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

interface AudioHeaderProps {
	isRecording: boolean;
	selectedDate: Date;
	onDateChange: (date: Date) => void;
	onToggleRecording: () => void;
	onEdit?: () => void;
	onExport?: () => void;
	onUpload?: () => void;
}

export function AudioHeader({
	isRecording,
	selectedDate,
	onDateChange,
	onToggleRecording,
	onEdit,
	onExport,
	onUpload,
}: AudioHeaderProps) {
	const formatDate = (date: Date) => {
		const month = date.getMonth() + 1;
		const day = date.getDate();
		return `${month}月${day}日 录音`;
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
		onDateChange(new Date());
	};

	return (
		<div className="flex items-center justify-between px-4 py-3 border-b border-[oklch(var(--border))]">
			<div className="flex items-center gap-2">
				<button
					type="button"
					className="p-1.5 rounded hover:bg-[oklch(var(--muted))] transition-colors"
					onClick={handlePrevDay}
				>
					<ChevronLeft className="h-4 w-4" />
				</button>
				<button
					type="button"
					className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-[oklch(var(--muted))] transition-colors"
					onClick={handleToday}
				>
					<Calendar className="h-4 w-4" />
					<span className="text-sm">今天</span>
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
				{onEdit && (
					<button
						type="button"
						className="px-3 py-1.5 text-sm rounded-md hover:bg-[oklch(var(--muted))] transition-colors"
						onClick={onEdit}
					>
						<Edit className="h-4 w-4 inline mr-1" />
						编辑
					</button>
				)}
				{onExport && (
					<button
						type="button"
						className="px-3 py-1.5 text-sm rounded-md hover:bg-[oklch(var(--muted))] transition-colors"
						onClick={onExport}
					>
						<Download className="h-4 w-4 inline mr-1" />
						导出
					</button>
				)}
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
							? "bg-red-500 hover:bg-red-600 text-white"
							: "bg-[oklch(var(--primary))] hover:bg-[oklch(var(--primary-hover))] text-white"
					)}
				>
					<Mic className="h-4 w-4 inline mr-1" />
					{isRecording ? "停止录音" : "开始录音"}
				</button>
			</div>
		</div>
	);
}
