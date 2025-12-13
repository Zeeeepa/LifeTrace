import { History, MessageSquare, PlusCircle } from "lucide-react";
import { PanelHeader } from "@/components/common/PanelHeader";
import { useTranslations } from "@/lib/i18n";
import { useLocaleStore } from "@/lib/store/locale";
import { cn } from "@/lib/utils";

type HeaderBarProps = {
	chatHistoryLabel: string;
	newChatLabel: string;
	onToggleHistory: () => void;
	onNewChat: () => void;
};

export function HeaderBar({
	chatHistoryLabel,
	newChatLabel,
	onToggleHistory,
	onNewChat,
}: HeaderBarProps) {
	const { locale } = useLocaleStore();
	const t = useTranslations(locale);

	return (
		<PanelHeader
			icon={MessageSquare}
			title={t.page.chatLabel}
			actions={
				<>
					<button
						type="button"
						onClick={onToggleHistory}
						className={cn(
							"flex h-9 w-9 items-center justify-center rounded-md",
							"border border-border text-muted-foreground transition-colors",
							"hover:bg-foreground/5 hover:text-foreground",
							"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
						)}
						aria-label={chatHistoryLabel}
					>
						<History className="h-4 w-4" />
					</button>
					<button
						type="button"
						onClick={onNewChat}
						className={cn(
							"flex h-9 w-9 items-center justify-center rounded-md",
							"bg-primary text-primary-foreground transition-colors",
							"hover:bg-primary/90",
							"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
						)}
						aria-label={newChatLabel}
					>
						<PlusCircle className="h-4 w-4" />
					</button>
				</>
			}
		/>
	);
}
