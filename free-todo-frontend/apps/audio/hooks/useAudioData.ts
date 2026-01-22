"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDateTime } from "../utils/parseTimeToIsoWithDate";

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
			const dateStr = selectedDate.toISOString().split("T")[0];
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

	const loadTimeline = useCallback(async () => {
		try {
			const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8100";
			const dateStr = selectedDate.toISOString().split("T")[0];
			const response = await fetch(
				`${apiBaseUrl}/api/audio/timeline?date=${dateStr}&optimized=${activeTab === "optimized"}`
			);
			const data = await response.json();
			if (Array.isArray(data.timeline)) {
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

				data.timeline.forEach((item: { id: number; start_time: string; duration: number; text: string }) => {
					durationMap[item.id] = item.duration;
					const lines = (item.text || "").split("\n").filter((s: string) => s.trim());
					const count = Math.max(1, lines.length);
					const per = item.duration > 0 ? item.duration / count : 0;
					lines.forEach((line: string, idx: number) => {
						segments.push(line);
						const offset = per * idx;
						offsets.push(offset);
						recIds.push(item.id);
						const start = new Date(item.start_time);
						const labelDate = new Date(start.getTime() + offset * 1000);
						const label = formatDateTime(labelDate);
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
		}
	}, [activeTab, selectedDate, setTranscriptionText, setOptimizedText]);

	useEffect(() => {
		loadRecordings();
	}, [loadRecordings]);

	useEffect(() => {
		loadTimeline();
	}, [loadTimeline]);

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
	};
}
