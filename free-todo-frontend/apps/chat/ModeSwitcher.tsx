import { ChevronDown } from "lucide-react";
import type { ChatMode } from "@/apps/chat/types";
import { cn } from "@/lib/utils";

type ModeSwitcherProps = {
	chatMode: ChatMode;
	locale: string;
	modeMenuOpen: boolean;
	onToggleMenu: () => void;
	onChangeMode: (mode: ChatMode) => void;
	variant?: "default" | "inline";
};

// Helper function to get mode label
const getModeLabel = (mode: ChatMode, locale: string): string => {
	const labels: Record<ChatMode, { zh: string; en: string }> = {
		ask: { zh: "Ask 模式", en: "Ask" },
		plan: { zh: "Plan 模式", en: "Plan" },
		edit: { zh: "Edit 模式", en: "Edit" },
	};
	return locale === "zh" ? labels[mode].zh : labels[mode].en;
};

// Helper function to get mode description
const getModeDescription = (mode: ChatMode, locale: string): string => {
	const descriptions: Record<ChatMode, { zh: string; en: string }> = {
		ask: { zh: "直接聊天或提问", en: "Chat freely" },
		plan: { zh: "拆解需求并生成待办", en: "Break down and add todos" },
		edit: { zh: "生成内容追加到待办备注", en: "Generate and append to notes" },
	};
	return locale === "zh" ? descriptions[mode].zh : descriptions[mode].en;
};

export function ModeSwitcher({
	chatMode,
	locale,
	modeMenuOpen,
	onToggleMenu,
	onChangeMode,
	variant = "default",
}: ModeSwitcherProps) {
	return (
		<div className="relative">
			<label className="sr-only" htmlFor="chat-mode">
				{locale === "zh" ? "对话模式" : "Chat mode"}
			</label>
			<button
				type="button"
				id="chat-mode"
				onClick={onToggleMenu}
				className={cn(
					"flex items-center gap-2 rounded-(--radius) border border-border px-3 text-sm text-foreground",
					"hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
					variant === "inline" ? "h-10 bg-background/80" : "h-11 bg-muted/60",
				)}
				aria-label={
					locale === "zh"
						? "切换 Ask/Plan/Edit 模式"
						: "Toggle Ask/Plan/Edit mode"
				}
			>
				<span>{getModeLabel(chatMode, locale)}</span>
				<ChevronDown className="h-4 w-4 text-muted-foreground" />
			</button>
			{modeMenuOpen && (
				<div className="absolute z-20 mb-2 w-36 overflow-hidden rounded-lg border border-border bg-background shadow-lg bottom-full">
					{(["ask", "plan", "edit"] as const).map((mode) => (
						<button
							key={mode}
							type="button"
							onClick={() => onChangeMode(mode)}
							className={cn(
								"flex w-full items-center justify-between px-3 py-2 text-sm transition-colors",
								mode === chatMode
									? "bg-foreground/5 text-foreground"
									: "text-foreground hover:bg-foreground/5",
							)}
						>
							<span>{getModeLabel(mode, locale)}</span>
							{mode === chatMode && (
								<span className="text-xs text-primary">
									{locale === "zh" ? "当前" : "Active"}
								</span>
							)}
						</button>
					))}
				</div>
			)}
			{variant === "default" && (
				<p className="mt-1 text-[11px] text-muted-foreground">
					{getModeDescription(chatMode, locale)}
				</p>
			)}
		</div>
	);
}
