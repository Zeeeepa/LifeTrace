"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PanelHeader } from "@/components/common/layout/PanelHeader";
import { FEATURE_ICON_MAP } from "@/lib/config/panel-config";
import { useConfig } from "@/lib/query";
import { useAudioRecordingStore } from "@/lib/store/audio-recording-store";
import { toastError } from "@/lib/toast";
import { AudioExtractionPanel } from "./components/AudioExtractionPanel";
import { AudioHeader } from "./components/AudioHeader";
import { AudioPlayer } from "./components/AudioPlayer";
import { RecordingStatus } from "./components/RecordingStatus";
import { StopRecordingConfirm } from "./components/StopRecordingConfirm";
import { TranscriptionView } from "./components/TranscriptionView";
import { useAudioData } from "./hooks/useAudioData";
import { useAudioPlayback } from "./hooks/useAudioPlayback";
import { useAudioRecording } from "./hooks/useAudioRecording";
import { parseTimeToIsoWithDate as parseTimeToIsoWithDateUtil } from "./utils/parseTimeToIsoWithDate";
import {
	formatDateTime,
	formatTime,
	getSegmentDate,
} from "./utils/timeUtils";

export function AudioPanel() {
	const t = useTranslations("page");
	const { data: config } = useConfig();
	const is24x7Enabled = (config?.audioIs24x7 as boolean | undefined) ?? true;
	const [activeTab, setActiveTab] = useState<"original" | "optimized">("original");
	const [selectedDate, setSelectedDate] = useState(new Date());

	// 先初始化 useAudioRecording，因为 useAudioData 需要 isRecording
	const { isRecording, startRecording, stopRecording } = useAudioRecording();

	// 从全局 store 获取实时录音数据（用于面板切换时保持状态）
	const storeTranscriptionText = useAudioRecordingStore((state) => state.transcriptionText);
	const storePartialText = useAudioRecordingStore((state) => state.partialText);
	const storeOptimizedText = useAudioRecordingStore((state) => state.optimizedText);
	const storeSegmentTimesSec = useAudioRecordingStore((state) => state.segmentTimesSec);
	const storeSegmentTimeLabels = useAudioRecordingStore((state) => state.segmentTimeLabels);
	const storeSegmentRecordingIds = useAudioRecordingStore((state) => state.segmentRecordingIds);
	const storeSegmentOffsetsSec = useAudioRecordingStore((state) => state.segmentOffsetsSec);
	const storeLiveTodos = useAudioRecordingStore((state) => state.liveTodos);
	const storeLiveSchedules = useAudioRecordingStore((state) => state.liveSchedules);

	// 从全局 store 获取更新方法
	const updateLastFinalEnd = useAudioRecordingStore((state) => state.updateLastFinalEnd);
	const appendTranscriptionText = useAudioRecordingStore((state) => state.appendTranscriptionText);
	const setStorePartialText = useAudioRecordingStore((state) => state.setPartialText);
	const setStoreOptimizedText = useAudioRecordingStore((state) => state.setOptimizedText);
	const appendSegmentData = useAudioRecordingStore((state) => state.appendSegmentData);
	const setStoreLiveTodos = useAudioRecordingStore((state) => state.setLiveTodos);
	const setStoreLiveSchedules = useAudioRecordingStore((state) => state.setLiveSchedules);
	const clearSessionData = useAudioRecordingStore((state) => state.clearSessionData);

	// 本地状态：用于回看模式（从后端加载的历史数据）
	const [localTranscriptionText, setLocalTranscriptionText] = useState("");
	const [localOptimizedText, setLocalOptimizedText] = useState("");

	// 根据录音状态选择数据源：录音中使用 store 数据，回看使用本地数据
	const transcriptionText = isRecording ? storeTranscriptionText : localTranscriptionText;
	const partialText = isRecording ? storePartialText : "";
	const optimizedText = isRecording ? storeOptimizedText : localOptimizedText;

	const {
		selectedRecordingId,
		setSelectedRecordingId,
		selectedRecordingDurationSec,
		setSelectedRecordingDurationSec,
		recordingDurations,
		segmentOffsetsSec: dataSegmentOffsetsSec,
		setSegmentOffsetsSec: setDataSegmentOffsetsSec,
		segmentRecordingIds: dataSegmentRecordingIds,
		setSegmentRecordingIds: setDataSegmentRecordingIds,
		segmentTimeLabels: dataSegmentTimeLabels,
		setSegmentTimeLabels: setDataSegmentTimeLabels,
		segmentTimesSec: dataSegmentTimesSec,
		setSegmentTimesSec: setDataSegmentTimesSec,
		extractionsByRecordingId,
		optimizedExtractionsByRecordingId,
		setOptimizedExtractionsByRecordingId,
		loadRecordings,
		loadTimeline,
	} = useAudioData(selectedDate, activeTab, setLocalTranscriptionText, setLocalOptimizedText, isRecording);

	// 根据录音状态选择段落数据源
	const segmentTimesSec = isRecording ? storeSegmentTimesSec : dataSegmentTimesSec;
	const segmentTimeLabels = isRecording ? storeSegmentTimeLabels : dataSegmentTimeLabels;
	const segmentRecordingIds = isRecording ? storeSegmentRecordingIds : dataSegmentRecordingIds;
	const segmentOffsetsSec = isRecording ? storeSegmentOffsetsSec : dataSegmentOffsetsSec;
	const liveTodos = isRecording ? storeLiveTodos : [];
	const liveSchedules = isRecording ? storeLiveSchedules : [];

	// 当前回看模式下选中的文本段索引，用于给点击过的段落加选中态
	const [selectedSegmentIndex, setSelectedSegmentIndex] = useState<number | null>(null);
	const [showStopConfirm, setShowStopConfirm] = useState(false);
	const [isExtracting, setIsExtracting] = useState(false); // 后端正在提取中（用于提取区域）
	const [isLoadingTimeline, setIsLoadingTimeline] = useState(false); // 正在加载时间线（用于文本区域）

	const {
		audioRef,
		isPlaying,
		currentTime,
		duration,
		playbackRate,
		ensureAudio,
		playPause,
		seekByRatio,
		setPlaybackRate,
	} = useAudioPlayback();

	const handleToggleRecording = async () => {
		if (isRecording) {
			setShowStopConfirm(true);
			return;
		}
		// 检查当前日期，如果与选择的日期不同，自动切换到当前日期
		const now = new Date();
		const selectedDateStr = selectedDate.toISOString().split("T")[0];
		const nowDateStr = now.toISOString().split("T")[0];
		if (selectedDateStr !== nowDateStr) {
			// 日期不一致，切换到当前日期
			setSelectedDate(now);
			// 清空本地状态
			setLocalTranscriptionText("");
			setLocalOptimizedText("");
			setDataSegmentOffsetsSec([]);
			setDataSegmentRecordingIds([]);
			setDataSegmentTimeLabels([]);
			setDataSegmentTimesSec([]);
		}
		// 录制开始：清空全局 store 的会话数据
		// 注意：录音开始时间由全局 store 自动管理
		setSelectedSegmentIndex(null);
		clearSessionData();

		await startRecording(
			(text, isFinal) => {
				// 规则：
				// - final=false：作为"未完成文本"斜体显示（不落盘）
				// - final=true：替换掉未完成文本，并把最终句追加到正文
				if (isFinal) {
					// 从全局 store 获取时间戳数据
					const storeState = useAudioRecordingStore.getState();
					const currentRecordingStartedAt = storeState.recordingStartedAt ?? Date.now();
					const currentLastFinalEndMs = storeState.lastFinalEndMs;

					// 使用前一个 final 文本的结束时间作为当前文本的开始时间
					// 对于第一段文本，使用录音开始时间
					const segmentStartMs = currentLastFinalEndMs ?? currentRecordingStartedAt;
					const elapsedSec = (segmentStartMs - currentRecordingStartedAt) / 1000;

					// 记录当前 final 文本的结束时间，作为下一段文本的开始时间
					updateLastFinalEnd(Date.now());

					// 使用全局 store 更新转录数据
					appendTranscriptionText(text);
					const start = storeState.recordingStartedDate ?? new Date();
					const segmentDate = getSegmentDate(start, elapsedSec, selectedDate);
					appendSegmentData({
						timeSec: elapsedSec,
						timeLabel: formatDateTime(segmentDate),
						recordingId: 0, // 当前录音会话的临时段落
						offsetSec: elapsedSec,
					});
					setStorePartialText("");
				} else {
					setStorePartialText(text);
				}
			},
			(data) => {
				// 录制中实时优化/提取推送（使用全局 store）
				if (typeof data.optimizedText === "string") setStoreOptimizedText(data.optimizedText);
				if (Array.isArray(data.todos)) setStoreLiveTodos(data.todos);
				if (Array.isArray(data.schedules)) setStoreLiveSchedules(data.schedules);
			},
			(error) => {
				console.error("Recording error:", error);
				// 显示用户友好的错误提示
				const errorMessage = error instanceof Error ? error.message : "录音过程中发生错误";
				toastError(errorMessage, { duration: 5000 });
			},
			is24x7Enabled
		);
	};

	const handleConfirmStop = () => {
		setShowStopConfirm(false);
		// 从 store 获取时间戳数组
		const storeState = useAudioRecordingStore.getState();
		const timestamps = storeState.segmentTimesSec;
		stopRecording(timestamps.length > 0 ? timestamps : undefined);

		// 停止后后端才会落库录音记录：轮询检查直到新录音出现
		// 显示"获取中"状态，让用户知道后端正在处理
		setIsExtracting(true); // 提取区域显示"提取中"
		setIsLoadingTimeline(true); // 文本区域显示"获取中"

		// 记录停止前的录音数量，用于判断是否有新录音
		let previousRecordingCount = 0;
		let pollCount = 0;
		const maxPolls = 15; // 最多轮询 15 次（约 7.5 秒）

		const checkNewRecording = async () => {
			pollCount++;
			try {
				const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8100";
				const dateStr = selectedDate.toISOString().split("T")[0];
				const response = await fetch(`${apiBaseUrl}/api/audio/recordings?date=${dateStr}`);
				const data = await response.json();
				if (data.recordings) {
					const recordings: Array<{ id: number; durationSeconds?: number }> = data.recordings;
					const currentCount = recordings.length;

					// 首次记录数量
					if (previousRecordingCount === 0) {
						previousRecordingCount = currentCount;
					}

					// 如果有新录音，加载最新录音和时间线
					if (currentCount > previousRecordingCount) {
						// 先加载录音列表
						await loadRecordings({ forceSelectLatest: true });
						// 然后加载时间线（这会更新文本显示，包含新录音的内容）
						await loadTimeline((loading) => {
							setIsLoadingTimeline(loading);
						});

						// 延迟清除状态，给后端更多时间完成提取
						setTimeout(() => {
							setIsExtracting(false);
							setIsLoadingTimeline(false);
						}, 1500);
						return; // 停止轮询
					}

					// 如果已经轮询了足够多次，仍然加载（可能后端处理较慢）
					if (pollCount >= maxPolls) {
						await loadRecordings({ forceSelectLatest: true });
						await loadTimeline((loading) => {
							setIsLoadingTimeline(loading);
						});
						setTimeout(() => {
							setIsExtracting(false);
							setIsLoadingTimeline(false);
						}, 1000);
						return; // 停止轮询
					}
				}
			} catch (error) {
				console.error("Failed to check new recording:", error);
				// 出错时也停止轮询
				if (pollCount >= maxPolls) {
					setIsExtracting(false);
					return;
				}
			}

			// 继续轮询
			setTimeout(checkNewRecording, 500);
		};

		// 首次延迟 800ms 后开始轮询
		setTimeout(checkNewRecording, 800);
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

	const handlePlayFromTranscription = useCallback(() => {
		if (!selectedRecordingId) return;
		const audioUrl = `${apiBaseUrl}/api/audio/recording/${selectedRecordingId}/file`;
		playPause(audioUrl);
	}, [apiBaseUrl, selectedRecordingId, playPause]);

	const handleSeekToSegment = useCallback(
		(index: number) => {
			const recId = segmentRecordingIds[index] ?? selectedRecordingId;
			if (!recId) return;
			const audioUrl = `${apiBaseUrl}/api/audio/recording/${recId}/file`;
			ensureAudio(audioUrl);
			const audio = audioRef.current;
			if (!audio) return;

			// 优先用"实时录制时采集到的时间戳"；否则用录音总时长做均匀估算
			const direct = segmentOffsetsSec[index];
			const segmentsCount = Math.max(1, segmentOffsetsSec.length);
			const duration = recordingDurations[recId] ?? selectedRecordingDurationSec;
			const fallback = duration > 0 ? (index / segmentsCount) * duration : 0;
			// 加 1 秒补偿，因为之前往前偏移了 1 秒
			const target = (Number.isFinite(direct) ? direct : fallback) + 1;

			try {
				audio.currentTime = Math.max(0, target);
				audio.play().catch(() => {});
				setSelectedRecordingId(recId);
				setSelectedSegmentIndex(index);
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
			audioRef,
			setSelectedRecordingId,
			setSelectedRecordingDurationSec,
		]
	);

	const handlePlayPause = useCallback(() => {
		if (!audioRef.current) {
			handlePlayFromTranscription();
		} else {
			playPause();
		}
	}, [handlePlayFromTranscription, playPause, audioRef]);

	const handleSeekInPlayer = useCallback(
		(ratio: number) => {
			seekByRatio(ratio);
		},
		[seekByRatio]
	);

	// 每一条文本段对应的高亮数据：按 recordingId 映射，录音中的临时段 (id=0) 使用实时 highligh 数据
	const segmentTodos = useMemo(() => {
		return segmentRecordingIds.map((recId) => {
			// 录音中的新增段落用实时高亮（recId=0），录音结束后在时间线刷新前继续使用这份高亮
			if (recId === 0) return liveTodos;
			const ext = recId != null ? extractionsByRecordingId[recId] : undefined;
			return ext?.todos ?? [];
		});
	}, [segmentRecordingIds, liveTodos, extractionsByRecordingId]);

	const segmentSchedules = useMemo(() => {
		return segmentRecordingIds.map((recId) => {
			if (recId === 0) return liveSchedules;
			const ext = recId != null ? extractionsByRecordingId[recId] : undefined;
			return ext?.schedules ?? [];
		});
	}, [segmentRecordingIds, liveSchedules, extractionsByRecordingId]);

	const currentSegmentText = useMemo(() => {
		if (selectedSegmentIndex == null) return "";
		const baseText = activeTab === "original" ? transcriptionText : optimizedText;
		const lines = baseText.split("\n").filter((s) => s.trim());
		return lines[selectedSegmentIndex] ?? "";
	}, [selectedSegmentIndex, transcriptionText, optimizedText, activeTab]);

	// 根据当前播放时间自动更新选中的文本段（仅回看模式）
	useEffect(() => {
		if (isRecording) return;
		if (!selectedRecordingId) return;
		if (!segmentRecordingIds.length) return;

		const indicesForRec: number[] = [];
		for (let i = 0; i < segmentRecordingIds.length; i++) {
			if (segmentRecordingIds[i] === selectedRecordingId) {
				indicesForRec.push(i);
			}
		}
		if (indicesForRec.length === 0) return;

		// 选取“offset <= currentTime”中最接近 currentTime 的段落；如果都在未来，则选第一段
		let bestIndex = indicesForRec[0];
		let bestDiff = Number.POSITIVE_INFINITY;
		for (const idx of indicesForRec) {
			const offset = segmentOffsetsSec[idx] ?? 0;
			const diff = currentTime - offset;
			// 允许一点点负误差（例如 currentTime 比 offset 略小）
			if (diff >= -0.5 && diff < bestDiff) {
				bestDiff = diff;
				bestIndex = idx;
			}
		}
		if (selectedSegmentIndex !== bestIndex) {
			setSelectedSegmentIndex(bestIndex);
		}
	}, [
		isRecording,
		selectedRecordingId,
		currentTime,
		segmentRecordingIds,
		segmentOffsetsSec,
		selectedSegmentIndex,
	]);

	// currentExtraction 仍用于 segment 级高亮（保持原逻辑），但"关联到待办"改为当天汇总 dayExtraction
	// NOTE: "关联到待办"使用 dayExtraction；当前高亮仍使用 segmentTodos/segmentSchedules（来自 live/extractionsByRecordingId）

	// ============ 关联待办（按"当天"汇总 + 以 source_text 为主） ============
	const dateKey = useMemo(() => selectedDate.toISOString().split("T")[0], [selectedDate]);

	const parseTimeToIsoWithDate = useCallback(
		(raw?: string | null) => parseTimeToIsoWithDateUtil(raw, selectedDate),
		[selectedDate],
	);

	return (
		<div className="flex h-full flex-col bg-[oklch(var(--background))] overflow-hidden">
			<PanelHeader icon={Icon} title={t("audioLabel")} />

			<AudioHeader
				isRecording={isRecording}
				selectedDate={selectedDate}
				onDateChange={setSelectedDate}
				onToggleRecording={handleToggleRecording}
			/>

			<AudioExtractionPanel
				dateKey={dateKey}
				segmentRecordingIds={segmentRecordingIds}
				extractionsByRecordingId={optimizedExtractionsByRecordingId}
				setExtractionsByRecordingId={setOptimizedExtractionsByRecordingId}
				parseTimeToIsoWithDate={parseTimeToIsoWithDate}
				liveTodos={liveTodos}
				liveSchedules={liveSchedules}
				isRecording={isRecording}
				isExtracting={isExtracting}
			/>

			{/* 转录内容区域（回看模式下点击即可播放对应录音） */}
			<TranscriptionView
				originalText={transcriptionText}
				partialText={isRecording ? partialText : ""}
				optimizedText={optimizedText}
				activeTab={activeTab}
				onTabChange={(tab) => {
					setActiveTab(tab);
					// 切换 tab 时显示加载状态
					setIsLoadingTimeline(true);
					// 手动触发 loadTimeline，传入加载状态回调
					loadTimeline((loading) => {
						setIsLoadingTimeline(loading);
					});
				}}
				segmentTodos={segmentTodos}
				segmentSchedules={segmentSchedules}
				isRecording={isRecording}
				segmentTimesSec={segmentTimesSec}
				segmentTimeLabels={segmentTimeLabels}
				selectedSegmentIndex={selectedSegmentIndex}
				onSegmentClick={isRecording ? undefined : handleSeekToSegment}
				isLoadingTimeline={isLoadingTimeline}
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
						progress={duration > 0 ? currentTime / duration : 0}
						onSeek={handleSeekInPlayer}
						currentSegmentText={currentSegmentText}
						playbackRate={playbackRate}
						onPlaybackRateChange={setPlaybackRate}
					/>
				)
			)}

			<StopRecordingConfirm
				isOpen={showStopConfirm}
				onCancel={() => setShowStopConfirm(false)}
				onConfirm={handleConfirmStop}
			/>
		</div>
	);
}
