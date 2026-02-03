"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { formatDateTimeLocal, parseDateTimeLocal } from "@/apps/diary/journal-utils";
import type { JournalDraft } from "@/apps/diary/types";

interface DiaryHeaderProps {
	draft: JournalDraft;
	tagInput: string;
	onNameChange: (value: string) => void;
	onDateChange: (value: Date) => void;
	onMoodChange: (value: string) => void;
	onEnergyChange: (value: number | null) => void;
	onTagInputChange: (value: string) => void;
	onTagsCommit: (value: string) => void;
	onAddTodoId: (id: number) => void;
	onRemoveTodoId: (id: number) => void;
	onAddActivityId: (id: number) => void;
	onRemoveActivityId: (id: number) => void;
}

interface RelationEditorProps {
	label: string;
	values: number[];
	placeholder: string;
	onAdd: (id: number) => void;
	onRemove: (id: number) => void;
}

function RelationEditor({
	label,
	values,
	placeholder,
	onAdd,
	onRemove,
}: RelationEditorProps) {
	const inputId = useId();
	const [inputValue, setInputValue] = useState("");

	const handleAdd = () => {
		const nextValue = Number(inputValue);
		if (!Number.isNaN(nextValue) && nextValue > 0) {
			onAdd(nextValue);
			setInputValue("");
		}
	};

	return (
		<div className="space-y-2">
			<label
				htmlFor={inputId}
				className="text-xs font-medium text-muted-foreground"
			>
				{label}
			</label>
			<div className="flex flex-wrap gap-2">
				{values.length === 0 && (
					<span className="text-xs text-muted-foreground">-</span>
				)}
				{values.map((value) => (
					<span
						key={value}
						className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/30 px-2 py-0.5 text-xs"
					>
						#{value}
						<button
							type="button"
							onClick={() => onRemove(value)}
							className="text-muted-foreground hover:text-foreground"
						>
							x
						</button>
					</span>
				))}
			</div>
			<div className="flex items-center gap-2">
				<input
					id={inputId}
					value={inputValue}
					onChange={(event) => setInputValue(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter") {
							event.preventDefault();
							handleAdd();
						}
					}}
					placeholder={placeholder}
					className="h-7 w-32 rounded-md border border-border bg-background px-2 text-xs"
				/>
				<button
					type="button"
					onClick={handleAdd}
					className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
				>
					+
				</button>
			</div>
		</div>
	);
}

export function DiaryHeader({
	draft,
	tagInput,
	onNameChange,
	onDateChange,
	onMoodChange,
	onEnergyChange,
	onTagInputChange,
	onTagsCommit,
	onAddTodoId,
	onRemoveTodoId,
	onAddActivityId,
	onRemoveActivityId,
}: DiaryHeaderProps) {
	const t = useTranslations("journalPanel");
	const titleId = useId();
	const dateId = useId();
	const moodId = useId();
	const energyId = useId();
	const tagsId = useId();

	return (
		<div className="grid gap-3">
			<div className="grid gap-3 md:grid-cols-3">
				<div className="space-y-1">
					<label
						htmlFor={titleId}
						className="text-xs font-medium text-muted-foreground"
					>
						{t("titleLabel")}
					</label>
					<input
						id={titleId}
						value={draft.name}
						onChange={(event) => onNameChange(event.target.value)}
						placeholder={t("titlePlaceholder")}
						className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
					/>
				</div>
				<div className="space-y-1">
					<label
						htmlFor={dateId}
						className="text-xs font-medium text-muted-foreground"
					>
						{t("dateLabel")}
					</label>
					<input
						id={dateId}
						type="datetime-local"
						value={formatDateTimeLocal(draft.date)}
						onChange={(event) =>
							onDateChange(parseDateTimeLocal(event.target.value))
						}
						className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
					/>
				</div>
				<div className="grid grid-cols-2 gap-3">
					<div className="space-y-1">
						<label
							htmlFor={moodId}
							className="text-xs font-medium text-muted-foreground"
						>
							{t("moodLabel")}
						</label>
						<select
							id={moodId}
							value={draft.mood}
							onChange={(event) => onMoodChange(event.target.value)}
							className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
						>
							<option value="">{t("moodPlaceholder")}</option>
							<option value="calm">{t("moodCalm")}</option>
							<option value="focused">{t("moodFocused")}</option>
							<option value="tired">{t("moodTired")}</option>
							<option value="energized">{t("moodEnergized")}</option>
							<option value="anxious">{t("moodAnxious")}</option>
						</select>
					</div>
					<div className="space-y-1">
						<label
							htmlFor={energyId}
							className="text-xs font-medium text-muted-foreground"
						>
							{t("energyLabel")}
						</label>
						<select
							id={energyId}
							value={draft.energy === null ? "" : String(draft.energy)}
							onChange={(event) => {
								const value = event.target.value;
								onEnergyChange(value ? Number(value) : null);
							}}
							className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
						>
							<option value="">{t("energyPlaceholder")}</option>
							<option value="2">{t("energyLow")}</option>
							<option value="5">{t("energyMid")}</option>
							<option value="8">{t("energyHigh")}</option>
						</select>
					</div>
				</div>
			</div>
			<div className="grid gap-3 md:grid-cols-3">
				<div className="space-y-1 md:col-span-1">
					<label
						htmlFor={tagsId}
						className="text-xs font-medium text-muted-foreground"
					>
						{t("tagsLabel")}
					</label>
				<input
					id={tagsId}
					value={tagInput}
					onChange={(event) => onTagInputChange(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter") {
							event.preventDefault();
							onTagsCommit(event.currentTarget.value);
						}
					}}
					onBlur={(event) => onTagsCommit(event.target.value)}
					placeholder={t("tagsPlaceholder")}
					className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
				/>
					{draft.tags.length > 0 && (
						<div className="flex flex-wrap gap-2">
							{draft.tags.map((tag) => (
								<span
									key={tag}
									className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground"
								>
									{tag}
								</span>
							))}
						</div>
					)}
				</div>
				<div className="grid gap-3 md:col-span-2 md:grid-cols-2">
					<RelationEditor
						label={t("relatedTodosLabel")}
						values={draft.relatedTodoIds}
						placeholder={t("relatedTodosPlaceholder")}
						onAdd={onAddTodoId}
						onRemove={onRemoveTodoId}
					/>
					<RelationEditor
						label={t("relatedActivitiesLabel")}
						values={draft.relatedActivityIds}
						placeholder={t("relatedActivitiesPlaceholder")}
						onAdd={onAddActivityId}
						onRemove={onRemoveActivityId}
					/>
				</div>
			</div>
		</div>
	);
}
