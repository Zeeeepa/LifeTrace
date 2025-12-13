import { Activity, Search } from "lucide-react";
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
		<div className="shrink-0 bg-primary/15">
			<div className="flex items-center justify-between px-4 py-2.5">
				<h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
					<Activity className="h-5 w-5 text-primary" />
					{t.page.activityLabel}
				</h2>
				<div className="flex items-center gap-2">
					<div className="relative">
						<Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<input
							value={searchValue}
							onChange={(e) => onSearchChange(e.target.value)}
							placeholder="Find activities..."
							className="w-48 rounded-md border border-primary/20 px-8 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
