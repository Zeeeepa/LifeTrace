"use client";

import { useCallback, useEffect, useState } from "react";
import {
	calculateSegmentOffset,
	formatDateTime,
	getDateString,
	getSegmentDate,
	parseLocalDate,
} from "../utils/timeUtils";

type TodoItem = {
	id?: string;
	dedupe_key?: string;
	title: string;
	description?: string;
	deadline?: string;
	source_text?: string;
	linked?: boolean;
	linked_todo_id?: number | null;
};

type ScheduleItem = {
	id?: string;
	dedupe_key?: string;
	title: string;
	time?: string;
	description?: string;
	source_text?: string;
	linked?: boolean;
	linked_todo_id?: number | null;
};

export function useAudioData(
	selectedDate: Date,
	activeTab: "original" | "optimized",
	setTranscriptionText: (text: string) => void,
	setOptimizedText: (text: string) => void,
	isRecording?: boolean, // 是否正在录音，用于避免清空文本
) {
	const [selectedRecordingId, setSelectedRecordingId] = useState<number | null>(null);
	const [selectedRecordingDurationSec, setSelectedRecordingDurationSec] = useState<number>(0);
	const [recordingDurations, setRecordingDurations] = useState<Record<number, number>>({});
	const [segmentOffsetsSec, setSegmentOffsetsSec] = useState<number[]>([]);
	const [segmentRecordingIds, setSegmentRecordingIds] = useState<number[]>([]);
	const [segmentTimeLabels, setSegmentTimeLabels] = useState<string[]>([]);
	const [segmentTimesSec, setSegmentTimesSec] = useState<number[]>([]);
	const [extractionsByRecordingId, setExtractionsByRecordingId] = useState<
		Record<number, { todos?: TodoItem[]; schedules?: ScheduleItem[] }>
	>({});
	const [optimizedExtractionsByRecordingId, setOptimizedExtractionsByRecordingId] = useState<
		Record<number, { todos?: TodoItem[]; schedules?: ScheduleItem[] }>
	>({});

	const loadRecordings = useCallback(async (opts?: { forceSelectLatest?: boolean }) => {
		try {
			const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8100";
			const dateStr = getDateString(selectedDate);
			const response = await fetch(`${apiBaseUrl}/api/audio/recordings?date=${dateStr}`);
			const data = await response.json();
			if (data.recordings) {
				const recordings: Array<{ id: number; durationSeconds?: number }> = data.recordings;
				if (recordings.length > 0) {
					const latest = recordings[recordings.length - 1];
					const hasSelected =
						selectedRecordingId && recordings.some((r) => r.id === selectedRecordingId);
					if (opts?.forceSelectLatest || !hasSelected) {
						setSelectedRecordingId(latest.id);
						setSelectedRecordingDurationSec(Number(latest.durationSeconds ?? 0));
					}
				} else if (opts?.forceSelectLatest) {
					setSelectedRecordingId(null);
					setSelectedRecordingDurationSec(0);
				}
			}
		} catch (error) {
			console.error("Failed to load recordings:", error);
		}
	}, [selectedDate, selectedRecordingId]);

	const loadTimeline = useCallback(async (onLoadingChange?: (loading: boolean) => void) => {
		try {
			// 通知开始加载
			if (onLoadingChange) onLoadingChange(true);

			const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8100";
			const dateStr = getDateString(selectedDate);
			const response = await fetch(
				`${apiBaseUrl}/api/audio/timeline?date=${dateStr}&optimized=${activeTab === "optimized"}`
			);
			const data = await response.json();

			if (Array.isArray(data.timeline)) {
				// 先清空数据，但保持加载状态直到数据处理完成
				setTranscriptionText("");
				setOptimizedText("");
				setSegmentOffsetsSec([]);
				setSegmentRecordingIds([]);
				setSegmentTimeLabels([]);
				setSegmentTimesSec([]);
				const segments: string[] = [];
				const offsets: number[] = [];
				const timeLabels: string[] = [];
				const recIds: number[] = [];
				const durationMap: Record<number, number> = {};

				data.timeline.forEach((item: {
					id: number;
					start_time: string;
					duration: number;
					text: string;
					segment_timestamps?: number[];
				}) => {
					durationMap[item.id] = item.duration;
					const lines = (item.text || "").split("\n").filter((s: string) => s.trim());
					const count = Math.max(1, lines.length);

					// 使用本地时区解析录音开始时间
					const recordingStartTime = parseLocalDate(item.start_time);

					// 如果 API 返回了精确时间戳，使用它们；否则使用均匀分配
					const hasPreciseTimestamps = Array.isArray(item.segment_timestamps) &&
						item.segment_timestamps.length === lines.length;

					lines.forEach((line: string, idx: number) => {
						segments.push(line);
						// 优先使用 API 返回的精确时间戳，否则使用均匀分配
						const offset = hasPreciseTimestamps
							? (item.segment_timestamps?.[idx] ?? 0)
							: calculateSegmentOffset(
									recordingStartTime,
									idx,
									count,
									item.duration
								);
						offsets.push(offset);
						recIds.push(item.id);

						// 计算文本段的绝对时间（处理跨日期情况）
						const segmentDate = getSegmentDate(recordingStartTime, offset, selectedDate);
						const label = formatDateTime(segmentDate);
						timeLabels.push(label);
					});
				});

				const combinedText = segments.join("\n");
				if (activeTab === "original") {
					setTranscriptionText(combinedText);
				} else {
					setOptimizedText(combinedText);
				}
				setSegmentTimesSec(offsets);
				setSegmentOffsetsSec(offsets);
				setSegmentRecordingIds(recIds);
				setSegmentTimeLabels(timeLabels);
				setRecordingDurations(durationMap);
				if (recIds.length > 0) {
					const lastRecId = recIds[recIds.length - 1];
					setSelectedRecordingId(lastRecId);
					if (durationMap[lastRecId]) {
						setSelectedRecordingDurationSec(durationMap[lastRecId]);
					}
				}
			}
		} catch (error) {
			console.error("Failed to load timeline:", error);
		} finally {
			// 通知加载完成
			if (onLoadingChange) onLoadingChange(false);
		}
	}, [activeTab, selectedDate, setTranscriptionText, setOptimizedText]);

	useEffect(() => {
		loadRecordings();
	}, [loadRecordings]);

	useEffect(() => {
		// 如果正在录音，不加载时间线，保留录音时的文本显示
		if (isRecording) {
			return;
		}
		// 停止录音后，延迟加载时间线，给后端时间保存录音
		// 这样避免立即清空文本，让用户看到"获取中"状态
		const timer = setTimeout(() => {
			loadTimeline();
		}, 1000); // 延迟 1 秒，给后端时间保存

		return () => clearTimeout(timer);
	}, [loadTimeline, isRecording]);

	// 按录音ID加载对应的转录提取结果（用于整天时间线所有录音的持久化高亮）
	useEffect(() => {
		const uniqueIds = Array.from(new Set(segmentRecordingIds.filter((id) => id && id > 0)));
		if (uniqueIds.length === 0) return;
		const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8100";
		const controller = new AbortController();
		const isOptimized = activeTab === "optimized";

		(async () => {
			try {
				const results = await Promise.all(
					uniqueIds.map(async (id) => {
						const resp = await fetch(
							`${apiBaseUrl}/api/audio/transcription/${id}?optimized=${isOptimized}`,
							{ signal: controller.signal }
						);
						const data = await resp.json();
						const todos: TodoItem[] = Array.isArray(data.todos) ? data.todos : [];
						const schedules: ScheduleItem[] = Array.isArray(data.schedules) ? data.schedules : [];
						return { id, todos, schedules };
					})
				);
				setExtractionsByRecordingId((prev) => {
					const next = { ...prev };
					for (const r of results) {
						next[r.id] = { todos: r.todos, schedules: r.schedules };
					}
					return next;
				});
			} catch (e) {
				if ((e as Error).name !== "AbortError") {
					console.error("Failed to load transcription extraction:", e);
				}
			}
		})();

		return () => controller.abort();
	}, [segmentRecordingIds, activeTab]);

	// 单独加载优化文本的提取结果，用于"关联到待办"弹窗
	useEffect(() => {
		const uniqueIds = Array.from(new Set(segmentRecordingIds.filter((id) => id && id > 0)));
		if (uniqueIds.length === 0) return;
		const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8100";
		const controller = new AbortController();
		const missingIds = uniqueIds.filter((id) => !optimizedExtractionsByRecordingId[id]);
		if (missingIds.length === 0) return;

		(async () => {
			try {
				const results = await Promise.all(
					missingIds.map(async (id) => {
						const resp = await fetch(`${apiBaseUrl}/api/audio/transcription/${id}?optimized=true`, {
							signal: controller.signal,
						});
						const data = await resp.json();
						const todos: TodoItem[] = Array.isArray(data.todos) ? data.todos : [];
						const schedules: ScheduleItem[] = Array.isArray(data.schedules) ? data.schedules : [];
						return { id, todos, schedules };
					})
				);
				setOptimizedExtractionsByRecordingId((prev) => {
					const next = { ...prev };
					for (const r of results) {
						next[r.id] = { todos: r.todos, schedules: r.schedules };
					}
					return next;
				});
			} catch (e) {
				if ((e as Error).name !== "AbortError") {
					console.error("Failed to load optimized transcription extraction:", e);
				}
			}
		})();

		return () => controller.abort();
	}, [segmentRecordingIds, optimizedExtractionsByRecordingId]);

	return {
		selectedRecordingId,
		setSelectedRecordingId,
		selectedRecordingDurationSec,
		setSelectedRecordingDurationSec,
		recordingDurations,
		setRecordingDurations,
		segmentOffsetsSec,
		setSegmentOffsetsSec,
		segmentRecordingIds,
		setSegmentRecordingIds,
		segmentTimeLabels,
		setSegmentTimeLabels,
		segmentTimesSec,
		setSegmentTimesSec,
		extractionsByRecordingId,
		setExtractionsByRecordingId,
		optimizedExtractionsByRecordingId,
		setOptimizedExtractionsByRecordingId,
		loadRecordings,
		loadTimeline, // 暴露 loadTimeline，允许手动触发
	};
}
