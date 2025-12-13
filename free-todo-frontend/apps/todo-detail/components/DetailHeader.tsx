"use client";

import { FileText, Trash2 } from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import { useLocaleStore } from "@/lib/store/locale";

interface DetailHeaderProps {
	onToggleComplete: () => void;
	onDelete: () => void;
}

export function DetailHeader({
	onToggleComplete,
	onDelete,
}: DetailHeaderProps) {
	const { locale } = useLocaleStore();
	const t = useTranslations(locale);

	return (
		<div className="shrink-0 bg-primary/15">
			<div className="flex items-center justify-between px-4 py-2.5">
				<h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
					<FileText className="h-5 w-5 text-primary" />
					{t.page.todoDetailLabel}
				</h2>
				<div className="flex items-center gap-3">
					<button
						type="button"
						onClick={onToggleComplete}
						className="text-sm text-muted-foreground hover:text-foreground transition-colors"
					>
						Mark as complete
					</button>
					<button
						type="button"
						onClick={onDelete}
						className="flex items-center gap-1 rounded-md border border-destructive/40 px-2 py-1 text-sm text-destructive hover:bg-destructive/10 transition-colors"
					>
						<Trash2 className="h-4 w-4" />
						<span>Delete</span>
					</button>
				</div>
			</div>
		</div>
	);
}
