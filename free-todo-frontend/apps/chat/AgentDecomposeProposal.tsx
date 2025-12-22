/**
 * AgentDecomposeProposal - Agent 拆解提议组件
 *
 * 显示 AI 建议的子任务拆解，提供确认/拒绝按钮
 */

import { Check, ListTree, X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { AgentDecomposeProposal as DecomposeProposalType } from "@/apps/chat/types";
import { cn } from "@/lib/utils";

interface AgentDecomposeProposalProps {
	proposal: DecomposeProposalType;
	onConfirm: () => void;
	onReject: () => void;
	isLoading?: boolean;
}

export function AgentDecomposeProposal({
	proposal,
	onConfirm,
	onReject,
	isLoading = false,
}: AgentDecomposeProposalProps) {
	const t = useTranslations("chat.agent");

	return (
		<div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 space-y-3">
			{/* 标题 */}
			<div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
				<ListTree className="h-4 w-4" />
				<span className="font-medium">{t("decomposeProposalTitle")}</span>
			</div>

			{/* 原因 */}
			{proposal.reason && (
				<div className="text-sm text-muted-foreground">
					{proposal.reason}
				</div>
			)}

			{/* 子任务列表 */}
			<div className="space-y-2">
				{proposal.subtasks.map((subtask, index) => (
					<div
						key={`subtask-${index}`}
						className="flex items-start gap-3 rounded-md bg-background/60 p-3"
					>
						<span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-xs font-medium text-blue-600 dark:text-blue-400">
							{index + 1}
						</span>
						<div className="flex-1 min-w-0">
							<div className="font-medium text-sm">{subtask.name}</div>
							{subtask.description && (
								<div className="text-xs text-muted-foreground mt-1">
									{subtask.description}
								</div>
							)}
						</div>
					</div>
				))}
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
					{t("rejectDecompose")}
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
					{t("confirmDecompose")}
				</button>
			</div>
		</div>
	);
}

