"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { DiaryHeader } from "@/apps/diary/DiaryHeader";
import { DiarySettings } from "@/apps/diary/DiarySettings";
import { DiaryTabs, type JournalTab } from "@/apps/diary/DiaryTabs";
import { resolveBucketRange } from "@/apps/diary/journal-utils";
import type { JournalDraft } from "@/apps/diary/types";
import { Button } from "@/components/ui/button";
import { useJournalMutations, useJournals } from "@/lib/query";
import { useJournalStore } from "@/lib/store/journal-store";
import { useLocaleStore } from "@/lib/store/locale";
import type {
	JournalAutoLinkInput,
	JournalCreateInput,
	JournalGenerateInput,
	JournalUpdateInput,
} from "@/lib/types";

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
		workHoursStart,
		workHoursEnd,
		customTime,
		autoLinkEnabled,
		autoGenerateObjectiveEnabled,
		autoGenerateAiEnabled,
		setRefreshMode,
		setFixedTime,
		setWorkHoursStart,
		setWorkHoursEnd,
		setCustomTime,
		setAutoLinkEnabled,
		setAutoGenerateObjectiveEnabled,
		setAutoGenerateAiEnabled,
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
	useEffect(() => {
		if (isJournalLoading) return;
		const syncKey = `${bucket.bucketStart.toISOString()}-${activeJournal?.id ?? "new"}`;
		if (lastSyncKey.current === syncKey) return;
		lastSyncKey.current = syncKey;

		if (activeJournal) {
			setDraft({
				id: activeJournal.id,
				name: activeJournal.name ?? "",
				userNotes: activeJournal.userNotes ?? "",
				contentObjective: activeJournal.contentObjective ?? "",
				contentAi: activeJournal.contentAi ?? "",
				mood: activeJournal.mood ?? "",
				energy: activeJournal.energy ?? null,
				tags: (activeJournal.tags ?? []).map((tag) => tag.tagName),
				relatedTodoIds: activeJournal.relatedTodoIds ?? [],
				relatedActivityIds: activeJournal.relatedActivityIds ?? [],
				date: new Date(activeJournal.date),
			});
			setSelectedDate(new Date(activeJournal.date));
			setTagInput(
				(activeJournal.tags ?? []).map((tag) => tag.tagName).join(", "),
			);
			setAutoLinkMessage(null);
			setActiveTab("original");
			return;
		}

		setDraft(emptyDraft(selectedDate));
		setTagInput("");
		setAutoLinkMessage(null);
		setActiveTab("original");
	}, [activeJournal, bucket.bucketStart, isJournalLoading, selectedDate]);

	const handleTagsCommit = (value: string) => {
		const tags = parseTags(value);
		setDraft((prev) => ({ ...prev, tags }));
		setTagInput(tags.join(", "));
	};
	const handleDateChange = (value: Date) => {
		setSelectedDate(value);
		setDraft((prev) => ({ ...prev, date: value }));
	};
	const handleAddTodoId = (id: number) => {
		setDraft((prev) => ({
			...prev,
			relatedTodoIds: Array.from(new Set([...prev.relatedTodoIds, id])),
		}));
	};
	const handleRemoveTodoId = (id: number) => {
		setDraft((prev) => ({
			...prev,
			relatedTodoIds: prev.relatedTodoIds.filter((item) => item !== id),
		}));
	};
	const handleAddActivityId = (id: number) => {
		setDraft((prev) => ({
			...prev,
			relatedActivityIds: Array.from(
				new Set([...prev.relatedActivityIds, id]),
			),
		}));
	};
	const handleRemoveActivityId = (id: number) => {
		setDraft((prev) => ({
			...prev,
			relatedActivityIds: prev.relatedActivityIds.filter((item) => item !== id),
		}));
	};

	const buildSavePayload = (tags: string[]): JournalCreateInput => ({
		name: draft.name || undefined,
		userNotes: draft.userNotes,
		date: draft.date.toISOString(),
		contentFormat: "markdown",
		contentObjective: draft.contentObjective || null,
		contentAi: draft.contentAi || null,
		mood: draft.mood || null,
		energy: draft.energy,
		dayBucketStart: bucket.bucketStart.toISOString(),
		tags,
		relatedTodoIds: draft.relatedTodoIds,
		relatedActivityIds: draft.relatedActivityIds,
	});
	const runAutoLink = async (
		journalId: number,
		snapshot?: { title: string; content: string; date: Date },
	) => {
		const payload: JournalAutoLinkInput = {
			journalId,
			title: snapshot?.title ?? draft.name,
			contentOriginal: snapshot?.content ?? draft.userNotes,
			date: (snapshot?.date ?? draft.date).toISOString(),
			dayBucketStart: bucket.bucketStart.toISOString(),
			maxItems: 3,
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
		const payload: JournalGenerateInput = {
			journalId,
			title: snapshot?.title ?? draft.name,
			contentOriginal: snapshot?.content ?? draft.userNotes,
			date: (snapshot?.date ?? draft.date).toISOString(),
			dayBucketStart: bucket.bucketStart.toISOString(),
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
		const payload: JournalGenerateInput = {
			journalId,
			title: snapshot?.title ?? draft.name,
			contentOriginal: snapshot?.content ?? draft.userNotes,
			date: (snapshot?.date ?? draft.date).toISOString(),
			dayBucketStart: bucket.bucketStart.toISOString(),
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
				const updatePayload: JournalUpdateInput = { ...payload };
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
			<div className="border-b border-border px-6 py-4">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<div className="text-lg font-semibold">{t("panelTitle")}</div>
						<div className="text-xs text-muted-foreground">
							{t("panelSubtitle")}
						</div>
					</div>
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={handleSave}
							disabled={isCreating || isUpdating}
						>
							{isCreating || isUpdating
								? t("saving")
								: t("save")}
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => handleDateChange(new Date())}
						>
							{t("jumpToToday")}
						</Button>
					</div>
				</div>
				<div className="mt-4">
					<DiaryHeader
						draft={draft}
						tagInput={tagInput}
						onNameChange={(value) =>
							setDraft((prev) => ({ ...prev, name: value }))
						}
						onDateChange={handleDateChange}
						onMoodChange={(value) =>
							setDraft((prev) => ({ ...prev, mood: value }))
						}
						onEnergyChange={(value) =>
							setDraft((prev) => ({ ...prev, energy: value }))
						}
						onTagInputChange={setTagInput}
						onTagsCommit={handleTagsCommit}
						onAddTodoId={handleAddTodoId}
						onRemoveTodoId={handleRemoveTodoId}
						onAddActivityId={handleAddActivityId}
						onRemoveActivityId={handleRemoveActivityId}
					/>
				</div>
			</div>

			<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-6 py-4">
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

				<DiarySettings
					refreshMode={refreshMode}
					fixedTime={fixedTime}
					workHoursStart={workHoursStart}
					workHoursEnd={workHoursEnd}
					customTime={customTime}
					autoLinkEnabled={autoLinkEnabled}
					autoGenerateObjectiveEnabled={autoGenerateObjectiveEnabled}
					autoGenerateAiEnabled={autoGenerateAiEnabled}
					onRefreshModeChange={setRefreshMode}
					onFixedTimeChange={setFixedTime}
					onWorkHoursStartChange={setWorkHoursStart}
					onWorkHoursEndChange={setWorkHoursEnd}
					onCustomTimeChange={setCustomTime}
					onAutoLinkChange={setAutoLinkEnabled}
					onAutoGenerateObjectiveChange={setAutoGenerateObjectiveEnabled}
					onAutoGenerateAiChange={setAutoGenerateAiEnabled}
				/>
			</div>
		</div>
	);
}
