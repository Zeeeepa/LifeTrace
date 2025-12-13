"use client";

import { FileText, Trash2 } from "lucide-react";
import { PanelHeader } from "@/components/common/PanelHeader";
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
		<PanelHeader
			icon={FileText}
			title={t.page.todoDetailLabel}
			actions={
				<>
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
				</>
			}
		/>
	);
}
