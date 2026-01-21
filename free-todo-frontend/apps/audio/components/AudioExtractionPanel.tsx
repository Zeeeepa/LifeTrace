"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { MessageTodoExtractionModal } from "@/apps/chat/components/message/MessageTodoExtractionModal";
import { cn } from "@/lib/utils";

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

interface ExtractionPanelProps {
	dateKey: string;
	segmentRecordingIds: number[];
	extractionsByRecordingId: Record<number, { todos?: TodoItem[]; schedules?: ScheduleItem[] }>;
	setExtractionsByRecordingId: React.Dispatch<
		React.SetStateAction<Record<number, { todos?: TodoItem[]; schedules?: ScheduleItem[] }>>
	>;
	parseTimeToIsoWithDate: (raw?: string | null) => string | undefined;
}

export function AudioExtractionPanel({
	dateKey,
	segmentRecordingIds,
	extractionsByRecordingId,
	setExtractionsByRecordingId,
	parseTimeToIsoWithDate,
}: ExtractionPanelProps) {
	const tAudio = useTranslations("audio");
	const [showExtractionModal, setShowExtractionModal] = useState(false);
	const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(new Set());

	type ModalItem = {
		key: string;
		name: string;
		description?: string;
		deadline?: string;
		rawTime?: string;
		tags: string[];
		_meta: { recordingIds: number[]; kind: "todo" | "schedule"; itemKey: string };
	};

	const extractionTodosForModal = useMemo(() => {
		const uniqueIds = Array.from(new Set(segmentRecordingIds.filter((id) => id && id > 0)));
		const aggregated = new Map<string, ModalItem>();

		for (const recId of uniqueIds) {
			const ext = extractionsByRecordingId[recId];
			if (!ext) continue;

			for (const item of ext.todos ?? []) {
				const itemKey = (item.dedupe_key || item.id || "").toString();
				if (!itemKey) continue;
				if (item?.linked || item?.linked_todo_id) {
					aggregated.delete(`todo:${itemKey}`);
					continue;
				}
				const mapKey = `todo:${itemKey}`;
				const existing = aggregated.get(mapKey);
				if (existing) {
					if (!existing._meta.recordingIds.includes(recId)) {
						existing._meta.recordingIds.push(recId);
					}
				} else {
					aggregated.set(mapKey, {
						key: `audio:${dateKey}:${mapKey}`,
						name: item.source_text || item.title,
						description: item.source_text || item.description || undefined,
						deadline: parseTimeToIsoWithDate(item.deadline || null),
						rawTime: item.deadline || item.source_text || undefined,
						tags: [tAudio("linkTodoTag")],
						_meta: { recordingIds: [recId], kind: "todo", itemKey },
					});
				}
			}

			for (const item of ext.schedules ?? []) {
				const itemKey = (item.dedupe_key || item.id || "").toString();
				if (!itemKey) continue;
				if (item?.linked || item?.linked_todo_id) {
					aggregated.delete(`schedule:${itemKey}`);
					continue;
				}
				const mapKey = `schedule:${itemKey}`;
				const existing = aggregated.get(mapKey);
				if (existing) {
					if (!existing._meta.recordingIds.includes(recId)) {
						existing._meta.recordingIds.push(recId);
					}
				} else {
					aggregated.set(mapKey, {
						key: `audio:${dateKey}:${mapKey}`,
						name: item.source_text || item.title || tAudio("scheduleFallbackTitle"),
						description: item.source_text || item.description || item.time || undefined,
						deadline: parseTimeToIsoWithDate(item.time || null),
						rawTime: item.time || item.source_text || undefined,
						tags: [tAudio("scheduleTag")],
						_meta: { recordingIds: [recId], kind: "schedule", itemKey },
					});
				}
			}
		}

		return Array.from(aggregated.values());
	}, [dateKey, segmentRecordingIds, extractionsByRecordingId, parseTimeToIsoWithDate, tAudio]);

	const filteredTodoCount = extractionTodosForModal.filter((x) =>
		x.tags.includes(tAudio("linkTodoTag"))
	).length;
	const filteredScheduleCount = extractionTodosForModal.filter((x) =>
		x.tags.includes(tAudio("scheduleTag"))
	).length;
	const hasExtraction = filteredTodoCount + filteredScheduleCount > 0;

	const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8100";

	return (
		<>
			{hasExtraction ? (
				<div className="flex items-center justify-between px-4 py-2 border-b border-[oklch(var(--border))] bg-[oklch(var(--muted))]/40">
					<div className="text-sm text-[oklch(var(--muted-foreground))]">
						{`待提取 ${filteredTodoCount} 个待办，${filteredScheduleCount} 个日程`}
					</div>
					<button
						type="button"
						onClick={() => {
							setSelectedIndexes(new Set());
							setShowExtractionModal(true);
						}}
						className={cn(
							"px-3 py-1.5 text-sm rounded-md",
							"bg-[oklch(var(--primary))] text-white hover:opacity-90 transition-colors",
						)}
					>
						{tAudio("linkTodo")}
					</button>
				</div>
			) : null}

			<MessageTodoExtractionModal
				isOpen={showExtractionModal}
				onClose={() => setShowExtractionModal(false)}
				todos={extractionTodosForModal}
				parentTodoId={null}
				selectedTodoIndexes={showExtractionModal ? selectedIndexes : undefined}
				onSelectedTodoIndexesChange={(next) => setSelectedIndexes(next)}
				onSuccessWithCreated={async (created) => {
					// 聚合按 recordingId 调用 link API（减少请求次数）
					const byRec = new Map<
						number,
						Array<{ kind: "todo" | "schedule"; item_id: string; todo_id: number }>
					>();
					for (const row of created) {
						const item = extractionTodosForModal[row.index] as unknown as {
							_meta?: { recordingIds: number[]; kind: "todo" | "schedule"; itemKey: string };
						};
						const meta = item?._meta;
						if (!meta?.recordingIds?.length || !meta.itemKey) continue;
						for (const recId of meta.recordingIds) {
							const arr = byRec.get(recId) ?? [];
							arr.push({ kind: meta.kind, item_id: meta.itemKey, todo_id: row.todoId });
							byRec.set(recId, arr);
						}
					}

					await Promise.all(
						Array.from(byRec.entries()).map(async ([recId, links]) => {
							await fetch(`${apiBaseUrl}/api/audio/transcription/${recId}/link`, {
								method: "POST",
								headers: { "Content-Type": "application/json" },
								body: JSON.stringify({ links }),
							});
						}),
					);

					// 前端即时标记 linked，避免再次出现
					setExtractionsByRecordingId((prev) => {
						const next = { ...prev };
						for (const [recId, links] of byRec.entries()) {
							const ext = next[recId];
							if (!ext) continue;

							const todoLinks = links.filter((l) => l.kind === "todo");
							const schedLinks = links.filter((l) => l.kind === "schedule");

							if (todoLinks.length > 0) {
								const keyToTodoId = new Map(todoLinks.map((l) => [l.item_id, l.todo_id]));
								next[recId] = {
									...ext,
									todos: (ext.todos ?? []).map((t) => {
										const k = (t.dedupe_key || t.id || "").toString();
										if (!k) return t;
										const linkedTodoId = keyToTodoId.get(k);
										if (!linkedTodoId) return t;
										return { ...t, linked: true, linked_todo_id: linkedTodoId };
									}),
								};
							}

							if (schedLinks.length > 0) {
								const keyToTodoId = new Map(schedLinks.map((l) => [l.item_id, l.todo_id]));
								next[recId] = {
									...next[recId],
									schedules: (next[recId].schedules ?? []).map((s) => {
										const k = (s.dedupe_key || s.id || "").toString();
										if (!k) return s;
										const linkedTodoId = keyToTodoId.get(k);
										if (!linkedTodoId) return s;
										return { ...s, linked: true, linked_todo_id: linkedTodoId };
									}),
								};
							}
						}
						return next;
					});

					// 兜底：重新拉取，防止状态偏差
					try {
						const refreshed = await Promise.all(
							Array.from(byRec.keys()).map(async (recId) => {
								const resp = await fetch(`${apiBaseUrl}/api/audio/transcription/${recId}`);
								const data = await resp.json();
								return {
									id: recId,
									todos: Array.isArray(data.todos) ? data.todos : [],
									schedules: Array.isArray(data.schedules) ? data.schedules : [],
								};
							}),
						);
						setExtractionsByRecordingId((prev) => {
							const next = { ...prev };
							for (const r of refreshed) {
								next[r.id] = { todos: r.todos, schedules: r.schedules };
							}
							return next;
						});
					} catch {
						// ignore
					}

					setShowExtractionModal(false);
				}}
			/>
		</>
	);
}
