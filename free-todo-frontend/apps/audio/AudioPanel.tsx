"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { PanelHeader } from "@/components/common/layout/PanelHeader";
import { FEATURE_ICON_MAP } from "@/lib/config/panel-config";
import { AudioHeader } from "./components/AudioHeader";
import { AudioList } from "./components/AudioList";
import { AudioPlayer } from "./components/AudioPlayer";
import { RecordingStatus } from "./components/RecordingStatus";
import { TranscriptionView } from "./components/TranscriptionView";
import { useAudioRecording } from "./hooks/useAudioRecording";

interface AudioRecording {
	id: number;
	date: string;
	time: string;
	duration: string;
	size: string;
	isCurrent?: boolean;
}

export function AudioPanel() {
	const t = useTranslations("page");
	const [is24x7Enabled, setIs24x7Enabled] = useState(true);
	const [activeTab, setActiveTab] = useState<"original" | "optimized">("original");
	const [transcriptionText, setTranscriptionText] = useState("");
	const [optimizedText, setOptimizedText] = useState("");
	const [audioList, setAudioList] = useState<AudioRecording[]>([]);
	const [selectedDate, setSelectedDate] = useState(new Date());
	const [selectedRecordingId, setSelectedRecordingId] = useState<number | null>(null);
	const [todos, setTodos] = useState<Array<{ title: string; description?: string; deadline?: string }>>([]);
	const [schedules, setSchedules] = useState<Array<{ title: string; time?: string; description?: string }>>([]);

	const { isRecording, startRecording, stopRecording } = useAudioRecording();

	const loadRecordings = useCallback(async () => {
		try {
			const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8100";
			const dateStr = selectedDate.toISOString().split("T")[0];
			const response = await fetch(`${apiBaseUrl}/api/audio/recordings?date=${dateStr}`);
			const data = await response.json();
			if (data.recordings) {
				setAudioList(data.recordings);
				// 自动选择第一个录音
				if (data.recordings.length > 0 && !selectedRecordingId) {
					setSelectedRecordingId(data.recordings[0].id);
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
		} else {
			await startRecording(
				(text, isFinal) => {
					// 自动分段：如果是句子结束，添加换行符
					if (isFinal) {
						setTranscriptionText((prev) => {
							// 如果上一段没有换行符，添加换行
							const lastChar = prev.slice(-1);
							if (lastChar && !["\n", "。", "！", "？", ".", "!", "?"].includes(lastChar)) {
								return `${prev}${text}\n`;
							}
							return `${prev}${text}\n`;
						});
						// 注意：优化和提取会在后端自动进行，不需要前端手动触发
					} else {
						setTranscriptionText((prev) => prev + text);
					}
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

			{/* 转录内容区域 */}
			<TranscriptionView
				originalText={transcriptionText}
				optimizedText={optimizedText}
				activeTab={activeTab}
				onTabChange={setActiveTab}
				todos={todos}
				schedules={schedules}
			/>

			{/* 底部：根据录音状态切换显示 */}
			{isRecording ? (
				/* 录音模式：显示录音状态指示器 */
				<RecordingStatus isRecording={isRecording} />
			) : (
				/* 回看模式：显示音频列表和播放器 */
				<div className="border-t border-[oklch(var(--border))] bg-[oklch(var(--muted))]/30">
					<AudioList
						recordings={audioList}
						onPlay={(id) => {
							setSelectedRecordingId(id);
							loadTranscription(id);
						}}
					/>

					<AudioPlayer
						title={formatDate(selectedDate)}
						date={`${formatFullDate(selectedDate)} 00:00`}
					/>
				</div>
			)}
		</div>
	);
}
