"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { PanelHeader } from "@/components/common/layout/PanelHeader";
import { FEATURE_ICON_MAP } from "@/lib/config/panel-config";
import { AudioHeader } from "./components/AudioHeader";
import { AudioPlayer } from "./components/AudioPlayer";
import { RecordingStatus } from "./components/RecordingStatus";
import { TranscriptionView } from "./components/TranscriptionView";
import { useAudioRecording } from "./hooks/useAudioRecording";

export function AudioPanel() {
	const t = useTranslations("page");
	const [is24x7Enabled, setIs24x7Enabled] = useState(true);
	const [activeTab, setActiveTab] = useState<"original" | "optimized">("original");
	const [transcriptionText, setTranscriptionText] = useState("");
	const [partialText, setPartialText] = useState("");
	const [optimizedText, setOptimizedText] = useState("");
	const [selectedDate, setSelectedDate] = useState(new Date());
	const [selectedRecordingId, setSelectedRecordingId] = useState<number | null>(null);
	const [todos, setTodos] = useState<Array<{ title: string; description?: string; deadline?: string }>>([]);
	const [schedules, setSchedules] = useState<Array<{ title: string; time?: string; description?: string }>>([]);

	const { isRecording, startRecording, stopRecording } = useAudioRecording();
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);
	const [duration, setDuration] = useState(0);

	const loadRecordings = useCallback(async (opts?: { forceSelectLatest?: boolean }) => {
		try {
			const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8100";
			const dateStr = selectedDate.toISOString().split("T")[0];
			const response = await fetch(`${apiBaseUrl}/api/audio/recordings?date=${dateStr}`);
			const data = await response.json();
			if (data.recordings) {
				const recordings: Array<{ id: number }> = data.recordings;
				if (recordings.length > 0) {
					// 默认：如果未选中则选第一个；停止录音后：强制选最新一个
					if (opts?.forceSelectLatest) {
						setSelectedRecordingId(recordings[recordings.length - 1].id);
					} else if (!selectedRecordingId) {
						setSelectedRecordingId(recordings[0].id);
					}
				} else if (opts?.forceSelectLatest) {
					setSelectedRecordingId(null);
				}
			}
		} catch (error) {
			console.error("Failed to load recordings:", error);
		}
	}, [selectedDate, selectedRecordingId]);

	const loadTranscription = useCallback(async (recordingId: number) => {
		try {
			const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8100";
			// 同时加载原文和优化文本
			const [originalResponse, optimizedResponse] = await Promise.all([
				fetch(`${apiBaseUrl}/api/audio/transcription/${recordingId}?optimized=false`),
				fetch(`${apiBaseUrl}/api/audio/transcription/${recordingId}?optimized=true`),
			]);

			const originalData = await originalResponse.json();
			const optimizedData = await optimizedResponse.json();

			// 设置原文
			if (originalData.text) {
				setTranscriptionText(originalData.text);
			}
			// 设置优化文本
			if (optimizedData.text) {
				setOptimizedText(optimizedData.text);
			}

			// 设置待办和日程（从任一响应中获取）
			if (originalData.todos || optimizedData.todos) {
				setTodos(originalData.todos || optimizedData.todos || []);
			}
			if (originalData.schedules || optimizedData.schedules) {
				setSchedules(originalData.schedules || optimizedData.schedules || []);
			}
		} catch (error) {
			console.error("Failed to load transcription:", error);
		}
	}, []);

	// 加载录音列表
	useEffect(() => {
		loadRecordings();
	}, [loadRecordings]);

	// 加载转录文本
	useEffect(() => {
		if (selectedRecordingId) {
			loadTranscription(selectedRecordingId);
		}
	}, [selectedRecordingId, loadTranscription]);

	// 定期刷新转录文本（用于获取自动优化和提取的结果）
	useEffect(() => {
		if (!selectedRecordingId) return;

		const interval = setInterval(() => {
			loadTranscription(selectedRecordingId);
		}, 3000); // 每3秒刷新一次，直到优化和提取完成

		return () => clearInterval(interval);
	}, [selectedRecordingId, loadTranscription]);

	const handleToggleRecording = async () => {
		if (isRecording) {
			stopRecording();
			// 停止后后端才会落库录音记录：稍等一下再刷新列表并选中最新录音，确保播放器出现
			setTimeout(() => {
				loadRecordings({ forceSelectLatest: true });
			}, 600);
		} else {
			// 重置文本
			setTranscriptionText("");
			setPartialText("");
			setOptimizedText("");
			await startRecording(
				(text, isFinal) => {
					// 规则：
					// - final=false：作为“未完成文本”斜体显示（不落盘）
					// - final=true：替换掉未完成文本，并把最终句追加到正文
					if (isFinal) {
						setTranscriptionText((prev) => `${prev}${text}\n`);
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
		}
	};


	const formatDate = (date: Date) => {
		const month = date.getMonth() + 1;
		const day = date.getDate();
		return `${month}月${day}日 录音`;
	};

	const formatFullDate = (date: Date) => {
		return date.toLocaleDateString("zh-CN", {
			year: "numeric",
			month: "long",
			day: "numeric",
		});
	};

	const Icon = FEATURE_ICON_MAP.audio;

	const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8100";

	const handlePlayFromTranscription = useCallback(() => {
		if (!selectedRecordingId) return;
		const audioUrl = `${apiBaseUrl}/api/audio/recording/${selectedRecordingId}/file`;
		if (!audioRef.current) {
			const audio = new Audio(audioUrl);
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
		} else if (audioRef.current.src !== audioUrl) {
			audioRef.current.src = audioUrl;
			audioRef.current.load();
		}

		if (audioRef.current.paused) {
			audioRef.current.play().catch((e) => console.error("Failed to play audio:", e));
		} else {
			audioRef.current.pause();
		}
	}, [apiBaseUrl, selectedRecordingId]);

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

	return (
		<div className="flex h-full flex-col bg-[oklch(var(--background))] overflow-hidden">
			<PanelHeader icon={Icon} title={t("audioLabel")} />

			<AudioHeader
				isRecording={isRecording}
				selectedDate={selectedDate}
				onDateChange={setSelectedDate}
				onToggleRecording={handleToggleRecording}
			/>

			{/* 7x24小时录制开关 */}
			<div className="px-4 py-2 border-b border-[oklch(var(--border))] bg-[oklch(var(--muted))]/30">
				<label className="flex items-center gap-2 cursor-pointer">
					<input
						type="checkbox"
						checked={is24x7Enabled}
						onChange={(e) => setIs24x7Enabled(e.target.checked)}
						className="w-4 h-4 rounded border-[oklch(var(--border))]"
					/>
					<span className="text-sm">7x24小时录制（默认开启）</span>
				</label>
			</div>

			{/* 转录内容区域（回看模式下点击即可播放对应录音） */}
			<TranscriptionView
				originalText={transcriptionText}
				partialText={isRecording ? partialText : ""}
				optimizedText={optimizedText}
				activeTab={activeTab}
				onTabChange={setActiveTab}
				todos={todos}
				schedules={schedules}
				onContentClick={isRecording ? undefined : handlePlayFromTranscription}
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
						date={formatFullDate(selectedDate)}
						currentTime={formatTime(currentTime)}
						totalTime={formatTime(duration)}
						isPlaying={isPlaying}
						onPlay={handlePlayPause}
					/>
				)
			)}
		</div>
	);
}
