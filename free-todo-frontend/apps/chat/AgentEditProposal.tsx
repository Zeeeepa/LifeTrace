/**
 * AgentEditProposal - Agent 编辑提议组件
 *
 * 显示 AI 建议的编辑内容，提供确认/拒绝按钮
 */

import { Check, Pencil, X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { AgentEditProposal as EditProposalType } from "@/apps/chat/types";
import { cn } from "@/lib/utils";

interface AgentEditProposalProps {
	proposal: EditProposalType;
	onConfirm: () => void;
	onReject: () => void;
	isLoading?: boolean;
}

const fieldLabels: Record<string, { zh: string; en: string }> = {
	name: { zh: "任务名称", en: "Task Name" },
	description: { zh: "任务描述", en: "Description" },
	userNotes: { zh: "备注", en: "Notes" },
	user_notes: { zh: "备注", en: "Notes" },
};

export function AgentEditProposal({
	proposal,
	onConfirm,
	onReject,
	isLoading = false,
}: AgentEditProposalProps) {
	const t = useTranslations("chat.agent");

	const fieldLabel =
		fieldLabels[proposal.field]?.zh || proposal.field;

	return (
		<div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
			{/* 标题 */}
			<div className="flex items-center gap-2 text-primary">
				<Pencil className="h-4 w-4" />
				<span className="font-medium">{t("editProposalTitle")}</span>
			</div>

			{/* 字段和原因 */}
			<div className="space-y-2 text-sm">
				<div className="flex items-center gap-2">
					<span className="text-muted-foreground">修改字段:</span>
					<span className="font-medium">{fieldLabel}</span>
				</div>
				{proposal.reason && (
					<div className="text-muted-foreground">
						<span>原因: </span>
						<span>{proposal.reason}</span>
					</div>
				)}
			</div>

			{/* 对比展示 */}
			<div className="grid gap-2">
				{proposal.currentValue && (
					<div className="rounded-md bg-muted/50 p-3">
						<div className="text-xs text-muted-foreground mb-1">当前值</div>
						<div className="text-sm line-through opacity-60">
							{proposal.currentValue}
						</div>
					</div>
				)}
				<div className="rounded-md bg-green-500/10 border border-green-500/20 p-3">
					<div className="text-xs text-green-600 dark:text-green-400 mb-1">
						建议值
					</div>
					<div className="text-sm text-green-700 dark:text-green-300">
						{proposal.proposedValue}
					</div>
				</div>
			</div>

			{/* 操作按钮 */}
			<div className="flex justify-end gap-2 pt-2">
				<button
					type="button"
					onClick={onReject}
					disabled={isLoading}
					className={cn(
						"flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium transition-colors",
						isLoading
							? "cursor-not-allowed opacity-50"
							: "hover:bg-muted",
					)}
				>
					<X className="h-3 w-3" />
					{t("rejectEdit")}
				</button>
				<button
					type="button"
					onClick={onConfirm}
					disabled={isLoading}
					className={cn(
						"flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors",
						isLoading
							? "cursor-not-allowed opacity-50"
							: "hover:bg-primary/90",
					)}
				>
					<Check className="h-3 w-3" />
					{t("confirmEdit")}
				</button>
			</div>
		</div>
	);
}

