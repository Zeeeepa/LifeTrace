"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";

interface TranscriptionViewProps {
	originalText: string;
	optimizedText: string;
	partialText?: string;
	activeTab: "original" | "optimized";
	onTabChange: (tab: "original" | "optimized") => void;
	todos?: Array<{ title: string; description?: string; deadline?: string }>;
	schedules?: Array<{ title: string; time?: string; description?: string }>;
	onContentClick?: () => void;
}

interface TextSegment {
	text: string;
	highlight?: "todo" | "schedule";
}

export function TranscriptionView({
	originalText,
	optimizedText,
	partialText = "",
	activeTab,
	onTabChange,
	todos = [],
	schedules = [],
	onContentClick,
}: TranscriptionViewProps) {
	const transcriptionRef = useRef<HTMLDivElement>(null);

	// 高亮显示待办和日程，并自动分段
	const highlightedContent = useMemo(() => {
		const text = activeTab === "original" ? originalText : optimizedText;
		if (!text) {
			return [];
		}

		// 自动分段：按换行符分段，如果没有换行符则按句子结束标记分段
		const segments = text.split("\n").filter((s) => s.trim());
		if (segments.length === 0) {
			// 如果没有换行符，尝试按句子结束标记分段
			const sentenceEndings = /[。！？.!?]/g;
			const parts = text.split(sentenceEndings);
			segments.push(...parts.filter((s) => s.trim()));
		}

		// 为每个段落创建高亮
		return segments.map((segment) => {
			const highlights: Array<{ start: number; end: number; type: "todo" | "schedule" }> = [];

			// 高亮待办事项
			todos.forEach((todo) => {
				const searchText = todo.title;
				let index = segment.indexOf(searchText);
				while (index !== -1) {
					highlights.push({
						start: index,
						end: index + searchText.length,
						type: "todo",
					});
					index = segment.indexOf(searchText, index + searchText.length);
				}
			});

			// 高亮日程安排
			schedules.forEach((schedule) => {
				const searchText = schedule.title;
				let index = segment.indexOf(searchText);
				while (index !== -1) {
					highlights.push({
						start: index,
						end: index + searchText.length,
						type: "schedule",
					});
					index = segment.indexOf(searchText, index + searchText.length);
				}
			});

			// 按位置排序并合并重叠
			highlights.sort((a, b) => a.start - b.start);
			const merged: typeof highlights = [];
			for (const h of highlights) {
				if (merged.length === 0 || merged[merged.length - 1].end < h.start) {
					merged.push(h);
				} else {
					merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, h.end);
				}
			}

			// 将文本转换为带高亮的片段数组
			const textSegments: TextSegment[] = [];
			let lastIndex = 0;

			for (const h of merged) {
				// 添加高亮前的文本
				if (h.start > lastIndex) {
					textSegments.push({ text: segment.substring(lastIndex, h.start) });
				}
				// 添加高亮文本
				textSegments.push({
					text: segment.substring(h.start, h.end),
					highlight: h.type,
				});
				lastIndex = h.end;
			}

			// 添加剩余文本
			if (lastIndex < segment.length) {
				textSegments.push({ text: segment.substring(lastIndex) });
			}

			return textSegments.length > 0 ? textSegments : [{ text: segment }];
		});
	}, [originalText, optimizedText, activeTab, todos, schedules]);

	// 自动滚动到底部
	useLayoutEffect(() => {
		if (transcriptionRef.current) {
			transcriptionRef.current.scrollTop = transcriptionRef.current.scrollHeight;
		}
	});

	const currentText = activeTab === "original" ? originalText : optimizedText;
	const hasContent = currentText.length > 0 || (activeTab === "original" && partialText.length > 0);

	return (
		<div className="flex-1 flex flex-col min-h-0">
			{/* 标签页 */}
			<div className="flex border-b border-[oklch(var(--border))]">
				<button
					type="button"
					onClick={() => onTabChange("original")}
					className={cn(
						"px-4 py-2 text-sm font-medium transition-colors",
						activeTab === "original"
							? "text-[oklch(var(--primary))] border-b-2 border-[oklch(var(--primary))]"
							: "text-[oklch(var(--muted-foreground))] hover:text-[oklch(var(--foreground))]"
					)}
				>
					原文
				</button>
				<button
					type="button"
					onClick={() => onTabChange("optimized")}
					className={cn(
						"px-4 py-2 text-sm font-medium transition-colors",
						activeTab === "optimized"
							? "text-[oklch(var(--primary))] border-b-2 border-[oklch(var(--primary))]"
							: "text-[oklch(var(--muted-foreground))] hover:text-[oklch(var(--foreground))]"
					)}
				>
					智能优化
				</button>
			</div>

			{/* 转录内容区域 */}
			<div ref={transcriptionRef} className="flex-1 overflow-auto p-4">
				{hasContent ? (
					<button
						type="button"
						className={cn(
							"h-full w-full text-left text-sm leading-relaxed bg-transparent border-none outline-none",
							onContentClick ? "cursor-pointer" : "",
						)}
						onClick={onContentClick}
					>
						{highlightedContent.map((paragraph, paragraphIndex) => {
							const paragraphKey = `${paragraphIndex}-${paragraph.map((s) => s.text).join("").slice(0, 20)}`;
							return (
								<p key={paragraphKey} className="mb-2">
									{paragraph.map((segment, segmentIndex) => {
										const segmentKey = `${paragraphIndex}-${segmentIndex}-${segment.text.slice(0, 10)}`;
										if (segment.highlight) {
											const className =
												segment.highlight === "todo"
													? "bg-yellow-200 dark:bg-yellow-900 px-1 rounded"
													: "bg-blue-200 dark:bg-blue-900 px-1 rounded";
											return (
												<span key={segmentKey} className={className}>
													{segment.text}
												</span>
											);
										}
										return <span key={segmentKey}>{segment.text}</span>;
									})}
								</p>
							);
						})}
						{/* 实时未完成文本：用斜体/弱化显示，仅在原文页显示 */}
						{activeTab === "original" && partialText ? (
							<p className="mb-2 text-[oklch(var(--muted-foreground))] italic">
								{partialText}
							</p>
						) : null}
					</button>
				) : (
					<div className="flex flex-col items-center justify-center h-full text-center">
						<div className="mb-4 text-[oklch(var(--muted-foreground))]">
							<svg
								className="w-16 h-16 mx-auto mb-2"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
								role="img"
								aria-label="文档图标"
							>
								<title>文档图标</title>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={1.5}
									d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
								/>
							</svg>
						</div>
						<p className="text-sm text-[oklch(var(--muted-foreground))] mb-2">暂无转录内容</p>
						<p className="text-xs text-[oklch(var(--muted-foreground))]">
							当前日期没有转录记录。如果这是已录制的音频，可能需要：
						</p>
						<ul className="text-xs text-[oklch(var(--muted-foreground))] mt-2 list-disc list-inside">
							<li>等待转录完成</li>
							<li>检查音频是否已上传并处理</li>
							<li>确认日期选择是否正确</li>
						</ul>
					</div>
				)}
			</div>
		</div>
	);
}
