"use client";

import { Pause, Play } from "lucide-react";

interface AudioPlayerProps {
	title: string;
	date: string;
	currentTime?: string;
	totalTime?: string;
	isPlaying?: boolean;
	onPlay?: () => void;
}

export function AudioPlayer({ title, date, currentTime = "0:00", totalTime = "0:00", isPlaying = false, onPlay }: AudioPlayerProps) {
	return (
		<div className="px-4 py-2 flex items-center gap-3 border-t border-[oklch(var(--border))] bg-[oklch(var(--muted))]/30">
			<button
				type="button"
				className="p-1.5 rounded-full bg-[oklch(var(--primary))] text-white hover:bg-[oklch(var(--primary-hover))]"
				onClick={onPlay}
			>
				{isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
			</button>
			<div className="flex-1">
				<div className="text-xs font-medium">{title}</div>
				<div className="text-xs text-[oklch(var(--muted-foreground))]">{date}</div>
				<div className="flex items-center gap-2 mt-1">
					<span className="text-xs text-[oklch(var(--muted-foreground))]">{currentTime}</span>
					<div className="flex-1 h-1 bg-[oklch(var(--muted))] rounded-full"></div>
					<span className="text-xs text-[oklch(var(--muted-foreground))]">{totalTime}</span>
				</div>
			</div>
			<select className="text-xs px-2 py-1 rounded border border-[oklch(var(--border))] bg-[oklch(var(--background))]">
				<option>1x</option>
				<option>1.5x</option>
				<option>2x</option>
			</select>
		</div>
	);
}
