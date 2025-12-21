"use client";

import { FileText, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { PanelHeader } from "@/components/common/PanelHeader";

interface DetailHeaderProps {
	onToggleComplete: () => void;
	onDelete: () => void;
}

export function DetailHeader({
	onToggleComplete,
	onDelete,
}: DetailHeaderProps) {
	const t = useTranslations("page");
	const tTodoDetail = useTranslations("todoDetail");

	return (
		<PanelHeader
			icon={FileText}
			title={t("todoDetailLabel")}
			actions={
				<>
					<button
						type="button"
						onClick={onToggleComplete}
						className="text-sm text-muted-foreground hover:text-foreground transition-colors"
					>
						{tTodoDetail("markAsComplete")}
					</button>
					<button
						type="button"
						onClick={onDelete}
						className="flex items-center gap-1 rounded-md border border-destructive/40 px-2 py-1 text-sm text-destructive hover:bg-destructive/10 transition-colors"
					>
						<Trash2 className="h-3.5 w-3.5" />
						<span>{tTodoDetail("delete")}</span>
					</button>
				</>
			}
		/>
	);
}
