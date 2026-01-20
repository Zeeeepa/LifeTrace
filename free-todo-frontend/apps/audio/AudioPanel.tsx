"use client";

import { Download, Edit } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { PanelActionButton, PanelHeader } from "@/components/common/layout/PanelHeader";
import { FEATURE_ICON_MAP } from "@/lib/config/panel-config";
import { useConfig } from "@/lib/query";
import { AudioHeader } from "./components/AudioHeader";
import { AudioPlayer } from "./components/AudioPlayer";
import { RecordingStatus } from "./components/RecordingStatus";
import { TranscriptionView } from "./components/TranscriptionView";
import { useAudioRecording } from "./hooks/useAudioRecording";

export function AudioPanel() {
	const t = useTranslations("page");
	const { data: config } = useConfig();
	const is24x7Enabled = (config?.audioIs24x7 as boolean | undefined) ?? true;
	const [activeTab, setActiveTab] = useState<"original" | "optimized">("original");
	const [transcriptionText, setTranscriptionText] = useState("");
	const [partialText, setPartialText] = useState("");
	const [optimizedText, setOptimizedText] = useState("");
	const [selectedDate, setSelectedDate] = useState(new Date());
	const [selectedRecordingId, setSelectedRecordingId] = useState<number | null>(null);
	const [selectedRecordingDurationSec, setSelectedRecordingDurationSec] = useState<number>(0);
	const [recordingDurations, setRecordingDurations] = useState<Record<number, number>>({});
	const [segmentOffsetsSec, setSegmentOffsetsSec] = useState<number[]>([]);
	const [segmentRecordingIds, setSegmentRecordingIds] = useState<number[]>([]);
	const [segmentTimeLabels, setSegmentTimeLabels] = useState<string[]>([]);
	const [segmentTimesSec, setSegmentTimesSec] = useState<number[]>([]);
	const [todos, setTodos] = useState<
		Array<{ title: string; description?: string; deadline?: string; source_text?: string }>
	>([]);
	const [schedules, setSchedules] = useState<
		Array<{ title: string; time?: string; description?: string; source_text?: string }>
	>([]);

	const { isRecording, startRecording, stopRecording } = useAudioRecording();
	const [showStopConfirm, setShowStopConfirm] = useState(false);
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const recordingStartedAtMsRef = useRef<number>(0);
	const recordingStartedAtRef = useRef<Date | null>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);
	const [duration, setDuration] = useState(0);

	const formatDateTime = useCallback((date: Date) => {
		return date.toLocaleString("zh-CN", {
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour12: false,
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		});
	}, []);

	const loadRecordings = useCallback(async (opts?: { forceSelectLatest?: boolean }) => {
		try {
			const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8100";
			const dateStr = selectedDate.toISOString().split("T")[0];
			const response = await fetch(`${apiBaseUrl}/api/audio/recordings?date=${dateStr}`);
			const data = await response.json();
			if (data.recordings) {
				const recordings: Array<{ id: number; durationSeconds?: number }> = data.recordings;
				if (recordings.length > 0) {
					// 默认选最新一个（更符合“回看最近录音”，也避免选到旧的不可播放文件）
					const latest = recordings[recordings.length - 1];
					const hasSelected = selectedRecordingId && recordings.some((r) => r.id === selectedRecordingId);
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
						// start_time + offset -> 完整时间标签（含日期、时分秒）
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
				// 默认选最新录音
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
	}, [activeTab, selectedDate, formatDateTime]);

	// 加载录音列表
	useEffect(() => {
		loadRecordings();
	}, [loadRecordings]);

	// 加载时间线（当天所有录音按时间顺序拼接）
	useEffect(() => {
		loadTimeline();
		// 注意：这里不再依赖 isRecording，避免“停止录音后”立刻用旧数据覆盖掉刚才实时看到的文本
	}, [loadTimeline]);

	const handleToggleRecording = async () => {
		if (isRecording) {
			setShowStopConfirm(true);
			return;
		}
		// 录制开始：保留当天已有文本，在末尾追加新内容；并记录起始时间用于段落时间标签
		recordingStartedAtMsRef.current = performance.now();
		recordingStartedAtRef.current = new Date();
		// 保持已有时间标签/偏移，后续新句子在末尾追加
		setPartialText("");
		await startRecording(
			(text, isFinal) => {
				// 规则：
				// - final=false：作为“未完成文本”斜体显示（不落盘）
				// - final=true：替换掉未完成文本，并把最终句追加到正文
				if (isFinal) {
					const elapsedSec = (performance.now() - recordingStartedAtMsRef.current) / 1000;
					setTranscriptionText((prev) => {
						const needsGap = prev && !prev.endsWith("\n");
						return `${prev}${needsGap ? "\n" : ""}${text}\n`;
					});
					setSegmentTimesSec((prev) => [...prev, elapsedSec]);
					setSegmentOffsetsSec((prev) => [...prev, elapsedSec]);
					setSegmentRecordingIds((prev) => [...prev, selectedRecordingId ?? -1]);
					setSegmentTimeLabels((prev) => {
						const start = recordingStartedAtRef.current ?? new Date();
						const labelDate = new Date(start.getTime() + elapsedSec * 1000);
						return [...prev, formatDateTime(labelDate)];
					});
					setPartialText("");
				} else {
					setPartialText(text);
				}
			},
			(data) => {
				// 录制中实时优化/提取推送
				if (typeof data.optimizedText === "string") setOptimizedText(data.optimizedText);
				if (Array.isArray(data.todos)) setTodos(data.todos);
				if (Array.isArray(data.schedules)) setSchedules(data.schedules);
			},
			(error) => {
				console.error("Recording error:", error);
			},
			is24x7Enabled
		);
	};

	const handleConfirmStop = () => {
		setShowStopConfirm(false);
		stopRecording();
		// 停止后后端才会落库录音记录：稍等一下再刷新列表并选中最新录音，确保播放器出现
		setTimeout(() => {
			loadRecordings({ forceSelectLatest: true });
		}, 600);
	};


	const formatDate = (date: Date) => {
		// 只保留“年月日 录音”这一种格式，避免底部播放器出现两个日期
		return `${date.toLocaleDateString("zh-CN", {
			year: "numeric",
			month: "long",
			day: "numeric",
		})} 录音`;
	};

	const Icon = FEATURE_ICON_MAP.audio;

	const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8100";

	const ensureAudio = useCallback(
		(url: string) => {
			if (!audioRef.current) {
				const audio = new Audio(url);
				audio.addEventListener("loadedmetadata", () => {
					setDuration(audio.duration);
				});
				audio.addEventListener("timeupdate", () => {
					setCurrentTime(audio.currentTime);
				});
				audio.addEventListener("ended", () => {
					setIsPlaying(false);
					setCurrentTime(0);
				});
				audio.addEventListener("play", () => setIsPlaying(true));
				audio.addEventListener("pause", () => setIsPlaying(false));
				audioRef.current = audio;
			} else if (audioRef.current.src !== url) {
				audioRef.current.src = url;
				audioRef.current.load();
			}
		},
		[]
	);

	const handlePlayFromTranscription = useCallback(() => {
		if (!selectedRecordingId) return;
		const audioUrl = `${apiBaseUrl}/api/audio/recording/${selectedRecordingId}/file`;
		ensureAudio(audioUrl);
		const audio = audioRef.current;
		if (!audio) return;

		if (audio.paused) {
			audio.play().catch((e) => console.error("Failed to play audio:", e));
		} else {
			audio.pause();
		}
	}, [apiBaseUrl, selectedRecordingId, ensureAudio]);

	const handleSeekToSegment = useCallback(
		(index: number) => {
			const recId = segmentRecordingIds[index] ?? selectedRecordingId;
			if (!recId) return;
			const audioUrl = `${apiBaseUrl}/api/audio/recording/${recId}/file`;
			ensureAudio(audioUrl);
			const audio = audioRef.current;
			if (!audio) return;

			// 优先用“实时录制时采集到的时间戳”；否则用录音总时长做均匀估算
			const direct = segmentOffsetsSec[index];
			const segmentsCount = Math.max(1, segmentOffsetsSec.length);
			const duration = recordingDurations[recId] ?? selectedRecordingDurationSec;
			const fallback = duration > 0 ? (index / segmentsCount) * duration : 0;
			const target = Number.isFinite(direct) ? direct : fallback;

			try {
				audio.currentTime = Math.max(0, target);
				audio.play().catch(() => {});
				setSelectedRecordingId(recId);
				if (duration) {
					setSelectedRecordingDurationSec(duration);
				}
			} catch (e) {
				console.error("Failed to seek audio:", e);
			}
		},
		[
			apiBaseUrl,
			ensureAudio,
			selectedRecordingId,
			segmentRecordingIds,
			segmentOffsetsSec,
			selectedRecordingDurationSec,
			recordingDurations,
		]
	);

	const handlePlayPause = useCallback(() => {
		if (!audioRef.current) {
			handlePlayFromTranscription();
		} else {
			if (audioRef.current.paused) {
				audioRef.current.play().catch((e) => console.error("Failed to play audio:", e));
			} else {
				audioRef.current.pause();
			}
		}
	}, [handlePlayFromTranscription]);

	const formatTime = useCallback((seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, "0")}`;
	}, []);

	const handleEdit = useCallback(() => {
		console.log("TODO: 编辑");
	}, []);

	const handleExport = useCallback(() => {
		console.log("TODO: 导出");
	}, []);

	return (
		<div className="flex h-full flex-col bg-[oklch(var(--background))] overflow-hidden">
			<PanelHeader
				icon={Icon}
				title={t("audioLabel")}
				actions={
					<>
						<PanelActionButton
							aria-label="编辑"
							icon={Edit}
							onClick={handleEdit}
						/>
						<PanelActionButton
							aria-label="导出"
							icon={Download}
							onClick={handleExport}
						/>
					</>
				}
			/>

			<AudioHeader
				isRecording={isRecording}
				selectedDate={selectedDate}
				onDateChange={setSelectedDate}
				onToggleRecording={handleToggleRecording}
				onEdit={handleEdit}
				onExport={handleExport}
			/>

			{/* 转录内容区域（回看模式下点击即可播放对应录音） */}
			<TranscriptionView
				originalText={transcriptionText}
				partialText={isRecording ? partialText : ""}
				optimizedText={optimizedText}
				activeTab={activeTab}
				onTabChange={setActiveTab}
				todos={todos}
				schedules={schedules}
				isRecording={isRecording}
				segmentTimesSec={segmentTimesSec}
				segmentTimeLabels={segmentTimeLabels}
				onSegmentClick={isRecording ? undefined : handleSeekToSegment}
			/>

			{/* 底部：根据录音状态切换显示 */}
			{isRecording ? (
				/* 录音模式：显示录音状态指示器 */
				<RecordingStatus isRecording={isRecording} />
			) : (
				/* 回看模式：显示播放器 */
				selectedRecordingId && (
					<AudioPlayer
						title={formatDate(selectedDate)}
						date=""
						currentTime={formatTime(currentTime)}
						totalTime={formatTime(duration)}
						isPlaying={isPlaying}
						onPlay={handlePlayPause}
					/>
				)
			)}

			{showStopConfirm ? (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
					<div className="bg-[oklch(var(--background))] border border-[oklch(var(--border))] rounded-lg shadow-lg w-[320px] p-4 space-y-4">
						<div className="text-base font-semibold text-[oklch(var(--foreground))]">停止录音？</div>
						<p className="text-sm text-[oklch(var(--muted-foreground))]">
							确定要停止当前录音吗？停止后将保存当前音频并结束实时转写。
						</p>
						<div className="flex justify-end gap-2">
							<button
								type="button"
								className="px-3 py-1.5 rounded-md text-sm border border-[oklch(var(--border))] text-[oklch(var(--foreground))] hover:bg-[oklch(var(--muted))/50]"
								onClick={() => setShowStopConfirm(false)}
							>
								取消
							</button>
							<button
								type="button"
								className="px-3 py-1.5 rounded-md text-sm bg-[oklch(var(--primary))] text-white shadow hover:opacity-90"
								onClick={handleConfirmStop}
							>
								停止
							</button>
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
}
