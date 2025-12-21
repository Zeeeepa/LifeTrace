"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ChangeEvent } from "react";

interface NotesEditorProps {
	value: string;
	show: boolean;
	onToggle: () => void;
	onChange: (value: string) => void;
	onBlur?: () => void;
	notesRef: React.RefObject<HTMLTextAreaElement | null>;
	adjustHeight: () => void;
}

export function NotesEditor({
	value,
	show,
	onToggle,
	onChange,
	onBlur,
	notesRef,
	adjustHeight,
}: NotesEditorProps) {
	const t = useTranslations("todoDetail");
	const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
		onChange(event.target.value);
		requestAnimationFrame(adjustHeight);
	};

	const handleBlur = () => {
		onBlur?.();
	};

	return (
		<div className="mb-8">
			<div className="mb-2 flex items-center justify-between">
				<h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
					{t("notesLabel")}
				</h2>
				<button
					type="button"
					onClick={onToggle}
					aria-pressed={show}
					aria-label={show ? "折叠" : "展开"}
					className="rounded-md px-2 py-1 transition-colors hover:bg-muted/40 text-muted-foreground"
				>
					{show ? (
						<ChevronUp className="h-4 w-4" />
					) : (
						<ChevronDown className="h-4 w-4" />
					)}
				</button>
			</div>
			{show && (
				<textarea
					ref={notesRef}
					value={value}
					onChange={handleChange}
					onBlur={handleBlur}
					placeholder={t("notesPlaceholder")}
					className="w-full min-h-[120px] resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
				/>
			)}
		</div>
	);
}
