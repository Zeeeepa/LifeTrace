"use client";

import { BookOpen, CalendarDays, Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DiaryHeader } from "@/apps/diary/DiaryHeader";
import { DiaryTabs, type JournalTab } from "@/apps/diary/DiaryTabs";
import { JournalHistory } from "@/apps/diary/JournalHistory";
import { resolveBucketRange } from "@/apps/diary/journal-utils";
import type { JournalDraft } from "@/apps/diary/types";
import {
	PanelActionButton,
	PanelHeader,
} from "@/components/common/layout/PanelHeader";
import { Button } from "@/components/ui/button";
import type {
	JournalAutoLinkRequest,
	JournalCreate,
	JournalGenerateRequest,
} from "@/lib/generated/schemas";
import {
	type JournalView,
	useJournalMutations,
	useJournals,
} from "@/lib/query";
import { useJournalStore } from "@/lib/store/journal-store";
import { useLocaleStore } from "@/lib/store/locale";

const emptyDraft = (date: Date): JournalDraft => ({
	id: null,
	name: "",
	userNotes: "",
	contentObjective: "",
	contentAi: "",
	mood: "",
	energy: null,
	tags: [],
	relatedTodoIds: [],
	relatedActivityIds: [],
	date,
});

const parseTags = (input: string) =>
	input.split(",").map((tag) => tag.trim()).filter((tag) => tag.length > 0);

export function DiaryPanel() {
	const t = useTranslations("journalPanel");
	const { locale } = useLocaleStore();
	const [selectedDate, setSelectedDate] = useState(() => new Date());
	const [draft, setDraft] = useState<JournalDraft>(() => emptyDraft(new Date()));
	const [tagInput, setTagInput] = useState("");
	const [activeTab, setActiveTab] = useState<JournalTab>("original");
	const [autoLinkMessage, setAutoLinkMessage] = useState<string | null>(null);
	const lastSyncKey = useRef<string | null>(null);
	const {
		refreshMode,
		fixedTime,
		workHoursEnd,
		customTime,
		autoLinkEnabled,
		autoGenerateObjectiveEnabled,
		autoGenerateAiEnabled,
	} = useJournalStore();
	const bucket = useMemo(
		() =>
			resolveBucketRange(
				selectedDate,
				refreshMode,
				fixedTime,
				workHoursEnd,
				customTime,
			),
		[selectedDate, refreshMode, fixedTime, workHoursEnd, customTime],
	);
	const {
		data: journalResponse,
		isLoading: isJournalLoading,
		error: journalError,
	} = useJournals({
		limit: 1,
		offset: 0,
		startDate: bucket.bucketStart.toISOString(),
		endDate: bucket.bucketEnd.toISOString(),
	});
	const activeJournal = useMemo(
		() => journalResponse?.journals?.[0] ?? null,
		[journalResponse?.journals],
	);
	const {
		data: historyResponse,
		isLoading: isHistoryLoading,
	} = useJournals({ limit: 30, offset: 0 });
	const historyJournals = useMemo(() => {
		const journals = historyResponse?.journals ?? [];
		return [...journals].sort(
			(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
		);
	}, [historyResponse?.journals]);
	const historyFormatter = useMemo(
		() =>
			new Intl.DateTimeFormat(locale, {
				month: "short",
				day: "numeric",
				hour: "2-digit",
				minute: "2-digit",
			}),
		[locale],
	);
	const {
		createJournal,
		updateJournal,
		autoLinkJournal,
		generateObjective,
		generateAiView,
		isCreating,
		isUpdating,
		isAutoLinking,
		isGeneratingObjective,
		isGeneratingAi,
	} = useJournalMutations();
	const syncDraftFromJournal = useCallback(
		(journal: JournalView) => {
			setDraft({
				id: journal.id,
				name: journal.name ?? "",
				userNotes: journal.userNotes ?? "",
				contentObjective: journal.contentObjective ?? "",
				contentAi: journal.contentAi ?? "",
				mood: journal.mood ?? "",
				energy: journal.energy ?? null,
				tags: (journal.tags ?? []).map((tag) => tag.tagName),
				relatedTodoIds: journal.relatedTodoIds ?? [],
				relatedActivityIds: journal.relatedActivityIds ?? [],
				date: new Date(journal.date),
			});
			setSelectedDate(new Date(journal.date));
			setTagInput((journal.tags ?? []).map((tag) => tag.tagName).join(", "));
			setAutoLinkMessage(null);
			setActiveTab("original");
		},
		[],
	);
	useEffect(() => {
		if (isJournalLoading) return;
		const syncKey = `${bucket.bucketStart.toISOString()}-${activeJournal?.id ?? "new"}`;
		if (lastSyncKey.current === syncKey) return;
		lastSyncKey.current = syncKey;

		if (activeJournal) {
			syncDraftFromJournal(activeJournal);
			return;
		}

		setDraft(emptyDraft(selectedDate));
		setTagInput("");
		setAutoLinkMessage(null);
		setActiveTab("original");
	}, [
		activeJournal,
		bucket.bucketStart,
		isJournalLoading,
		selectedDate,
		syncDraftFromJournal,
	]);

	const handleTagsCommit = (value: string) => {
		const tags = parseTags(value);
		setDraft((prev) => ({ ...prev, tags }));
		setTagInput(tags.join(", "));
	};
	const handleDateChange = (value: Date) => {
		setSelectedDate(value);
		setDraft((prev) => ({ ...prev, date: value }));
	};
	const handleHistorySelect = (journal: JournalView) => {
		const journalDate = new Date(journal.date);
		const nextBucket = resolveBucketRange(
			journalDate,
			refreshMode,
			fixedTime,
			workHoursEnd,
			customTime,
		);
		lastSyncKey.current = `${nextBucket.bucketStart.toISOString()}-${journal.id}`;
		syncDraftFromJournal(journal);
	};

	const buildSavePayload = (tags: string[]): JournalCreate => ({
		name: draft.name || undefined,
		user_notes: draft.userNotes,
		date: draft.date.toISOString(),
		content_format: "markdown",
		content_objective: draft.contentObjective || null,
		content_ai: draft.contentAi || null,
		mood: draft.mood || null,
		energy: draft.energy,
		day_bucket_start: bucket.bucketStart.toISOString(),
		tags,
		related_todo_ids: draft.relatedTodoIds,
		related_activity_ids: draft.relatedActivityIds,
	});
	const runAutoLink = async (
		journalId: number,
		snapshot?: { title: string; content: string; date: Date },
	) => {
		const payload: JournalAutoLinkRequest = {
			journal_id: journalId,
			title: snapshot?.title ?? draft.name,
			content_original: snapshot?.content ?? draft.userNotes,
			date: (snapshot?.date ?? draft.date).toISOString(),
			day_bucket_start: bucket.bucketStart.toISOString(),
			max_items: 3,
		};
		const result = await autoLinkJournal(payload);
		setDraft((prev) => ({
			...prev,
			relatedTodoIds: result.relatedTodoIds,
			relatedActivityIds: result.relatedActivityIds,
		}));
		setAutoLinkMessage(
			t("autoLinkSuccess", {
				todoCount: result.relatedTodoIds.length,
				activityCount: result.relatedActivityIds.length,
			}),
		);
	};
	const runObjectiveGeneration = async (
		journalId: number,
		snapshot?: { title: string; content: string; date: Date },
	) => {
		const payload: JournalGenerateRequest = {
			journal_id: journalId,
			title: snapshot?.title ?? draft.name,
			content_original: snapshot?.content ?? draft.userNotes,
			date: (snapshot?.date ?? draft.date).toISOString(),
			day_bucket_start: bucket.bucketStart.toISOString(),
			language: locale,
		};
		const result = await generateObjective(payload);
		setDraft((prev) => ({ ...prev, contentObjective: result.content }));
		setActiveTab("objective");
	};
	const runAiGeneration = async (
		journalId: number,
		snapshot?: { title: string; content: string; date: Date },
	) => {
		const payload: JournalGenerateRequest = {
			journal_id: journalId,
			title: snapshot?.title ?? draft.name,
			content_original: snapshot?.content ?? draft.userNotes,
			date: (snapshot?.date ?? draft.date).toISOString(),
			day_bucket_start: bucket.bucketStart.toISOString(),
			language: locale,
		};
		const result = await generateAiView(payload);
		setDraft((prev) => ({ ...prev, contentAi: result.content }));
		setActiveTab("ai");
	};
	const handleSave = async () => {
		const tags = parseTags(tagInput);
		setDraft((prev) => ({ ...prev, tags }));
		const payload = buildSavePayload(tags);

		let saved = null;
		try {
			if (draft.id) {
				const { uid: _uid, ...updatePayload } = payload;
				saved = await updateJournal(draft.id, updatePayload);
			} else {
				saved = await createJournal(payload);
			}
		} catch (_error) {
			setAutoLinkMessage(t("saveFailed"));
			return;
		}

		if (!saved) return;

		setDraft({
			id: saved.id,
			name: saved.name ?? "",
			userNotes: saved.userNotes ?? "",
			contentObjective: saved.contentObjective ?? "",
			contentAi: saved.contentAi ?? "",
			mood: saved.mood ?? "",
			energy: saved.energy ?? null,
			tags: (saved.tags ?? []).map((tag) => tag.tagName),
			relatedTodoIds: saved.relatedTodoIds ?? [],
			relatedActivityIds: saved.relatedActivityIds ?? [],
			date: new Date(saved.date),
		});
		setSelectedDate(new Date(saved.date));
		setTagInput((saved.tags ?? []).map((tag) => tag.tagName).join(", "));
		setAutoLinkMessage(t("saveSuccess"));

		const snapshot = {
			title: saved.name ?? "",
			content: saved.userNotes ?? "",
			date: new Date(saved.date),
		};

		if (autoLinkEnabled) {
			try {
				await runAutoLink(saved.id, snapshot);
			} catch (_error) {
				setAutoLinkMessage(t("autoLinkFailed"));
			}
		}
		if (autoGenerateObjectiveEnabled && !saved.contentObjective) {
			try {
				await runObjectiveGeneration(saved.id, snapshot);
			} catch (_error) {
				setAutoLinkMessage(t("generateFailed"));
			}
		}
		if (autoGenerateAiEnabled && !saved.contentAi) {
			try {
				await runAiGeneration(saved.id, snapshot);
			} catch (_error) {
				setAutoLinkMessage(t("generateFailed"));
			}
		}
	};
	const handleCopyToOriginal = (content: string) => {
		setDraft((prev) => ({ ...prev, userNotes: content }));
		setActiveTab("original");
	};
	const handleGenerateObjectiveClick = async () => {
		if (!draft.id) return;
		try {
			await runObjectiveGeneration(draft.id);
		} catch (_error) {
			setAutoLinkMessage(t("generateFailed"));
		}
	};
	const handleGenerateAiClick = async () => {
		if (!draft.id) return;
		try {
			await runAiGeneration(draft.id);
		} catch (_error) {
			setAutoLinkMessage(t("generateFailed"));
		}
	};

	if (journalError) {
		const errorMessage =
			journalError instanceof Error
				? journalError.message
				: String(journalError);
		return (
			<div className="flex h-full items-center justify-center text-destructive">
				{t("loadFailed", { error: errorMessage })}
			</div>
		);
	}

	return (
		<div className="flex h-full flex-col overflow-hidden bg-background">
			<PanelHeader
				icon={BookOpen}
				title={t("panelTitle")}
				actions={
					<>
						<PanelActionButton
							variant="primary"
							icon={Save}
							onClick={handleSave}
							disabled={isCreating || isUpdating}
							aria-label={isCreating || isUpdating ? t("saving") : t("save")}
							title={isCreating || isUpdating ? t("saving") : t("save")}
						/>
						<PanelActionButton
							icon={CalendarDays}
							onClick={() => handleDateChange(new Date())}
							aria-label={t("jumpToToday")}
							title={t("jumpToToday")}
						/>
					</>
				}
			/>

			<div className="flex min-h-0 flex-1 flex-col md:flex-row">
				<JournalHistory
					title={t("historyTitle")}
					loadingLabel={t("historyLoading")}
					emptyLabel={t("historyEmpty")}
					untitledLabel={t("untitled")}
					journals={historyJournals}
					isLoading={isHistoryLoading}
					activeId={draft.id}
					onSelect={handleHistorySelect}
					formatDate={(date) => historyFormatter.format(date)}
				/>

				<div className="flex min-h-0 flex-1 flex-col">
					<div className="border-b border-border px-4 py-4">
						<DiaryHeader
							draft={draft}
							tagInput={tagInput}
							onNameChange={(value) =>
								setDraft((prev) => ({ ...prev, name: value }))
							}
							onDateChange={handleDateChange}
							onTagInputChange={setTagInput}
							onTagsCommit={handleTagsCommit}
						/>
					</div>

					<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-4 py-4">
						<div className="flex flex-wrap items-center justify-between gap-3">
							<DiaryTabs activeTab={activeTab} onChange={setActiveTab} />
							<div className="flex items-center gap-2">
								<Button
									variant="outline"
									size="sm"
									onClick={handleGenerateObjectiveClick}
									disabled={!draft.id || isGeneratingObjective}
								>
									{isGeneratingObjective
										? t("generatingObjective")
										: t("generateObjective")}
								</Button>
								<Button
									variant="outline"
									size="sm"
									onClick={handleGenerateAiClick}
									disabled={!draft.id || isGeneratingAi}
								>
									{isGeneratingAi ? t("generatingAi") : t("generateAi")}
								</Button>
								<Button
									variant="ghost"
									size="sm"
									onClick={async () => {
										if (!draft.id || isAutoLinking) return;
										try {
											await runAutoLink(draft.id);
										} catch (_error) {
											setAutoLinkMessage(t("autoLinkFailed"));
										}
									}}
									disabled={!draft.id || isAutoLinking}
								>
									{isAutoLinking ? t("autoLinking") : t("autoLink")}
								</Button>
							</div>
						</div>

						<div className="flex min-h-0 flex-1 flex-col gap-3">
							{activeTab === "original" && (
								<textarea
									value={draft.userNotes}
									onChange={(event) =>
										setDraft((prev) => ({
											...prev,
											userNotes: event.target.value,
										}))
									}
									placeholder={t("contentPlaceholder")}
									className="min-h-[260px] flex-1 rounded-xl border border-border bg-background p-4 text-sm leading-relaxed shadow-sm"
								/>
							)}
							{activeTab === "objective" && (
								<div className="flex min-h-0 flex-1 flex-col gap-2">
									<textarea
										value={draft.contentObjective}
										readOnly
										placeholder={t("objectivePlaceholder")}
										className="min-h-[240px] flex-1 rounded-xl border border-border bg-muted/20 p-4 text-sm leading-relaxed"
									/>
									{draft.contentObjective && (
										<Button
											variant="outline"
											size="sm"
											onClick={() =>
												handleCopyToOriginal(draft.contentObjective)
											}
										>
											{t("copyToOriginal")}
										</Button>
									)}
								</div>
							)}
							{activeTab === "ai" && (
								<div className="flex min-h-0 flex-1 flex-col gap-2">
									<textarea
										value={draft.contentAi}
										readOnly
										placeholder={t("aiPlaceholder")}
										className="min-h-[240px] flex-1 rounded-xl border border-border bg-muted/20 p-4 text-sm leading-relaxed"
									/>
									{draft.contentAi && (
										<Button
											variant="outline"
											size="sm"
											onClick={() => handleCopyToOriginal(draft.contentAi)}
										>
											{t("copyToOriginal")}
										</Button>
									)}
								</div>
							)}
							{autoLinkMessage && (
								<div className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
									{autoLinkMessage}
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
