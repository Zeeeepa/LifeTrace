import { Activity, Search } from "lucide-react";
import { PanelHeader } from "@/components/common/PanelHeader";
import { useTranslations } from "@/lib/i18n";
import { useLocaleStore } from "@/lib/store/locale";

interface ActivityHeaderProps {
	searchValue: string;
	onSearchChange: (value: string) => void;
}

export function ActivityHeader({
	searchValue,
	onSearchChange,
}: ActivityHeaderProps) {
	const { locale } = useLocaleStore();
	const t = useTranslations(locale);

	return (
		<PanelHeader
			icon={Activity}
			title={t.page.activityLabel}
			actions={
				<div className="relative">
					<Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<input
						value={searchValue}
						onChange={(e) => onSearchChange(e.target.value)}
						placeholder="Find activities..."
						className="h-7 w-48 rounded-md border border-primary/20 px-8 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
					/>
				</div>
			}
		/>
	);
}
