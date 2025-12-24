"use client";

import { History, MessageSquare, PlusCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import {
	PanelActionButton,
	PanelHeader,
} from "@/components/common/PanelHeader";

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
	const t = useTranslations("page");

	return (
		<PanelHeader
			icon={MessageSquare}
			title={t("chatLabel")}
			actions={
				<>
					<PanelActionButton
						variant="default"
						icon={History}
						onClick={onToggleHistory}
						aria-label={chatHistoryLabel}
					/>
					<PanelActionButton
						variant="primary"
						icon={PlusCircle}
						onClick={onNewChat}
						iconOverrides={{ color: "text-primary-foreground" }}
						aria-label={newChatLabel}
					/>
				</>
			}
		/>
	);
}
