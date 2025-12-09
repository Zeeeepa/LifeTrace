"use client";

import { TodoList } from "@/components/todo/TodoList";
import type { PanelPosition } from "@/lib/config/panel-config";
import { FEATURE_ICON_MAP } from "@/lib/config/panel-config";
import { useTranslations } from "@/lib/i18n";
import { useLocaleStore } from "@/lib/store/locale";
import { useUiStore } from "@/lib/store/ui-store";

interface PanelContentProps {
	position: PanelPosition;
}

export function PanelContent({ position }: PanelContentProps) {
	const { getFeatureByPosition } = useUiStore();
	const { locale } = useLocaleStore();
	const t = useTranslations(locale);

	const feature = getFeatureByPosition(position);

	// 获取位置对应的功能标签和占位符
	const getFeatureLabel = (pos: PanelPosition): string => {
		const feat = getFeatureByPosition(pos);
		if (!feat) return "";
		const labelMap: Record<string, string> = {
			calendar: t.page.calendarLabel,
			todos: t.page.todosLabel,
			chat: t.page.chatLabel,
			todoDetail: t.page.todoDetailLabel,
			diary: t.page.diaryLabel,
			settings: t.page.settingsLabel,
		};
		return labelMap[feat] || "";
	};

	const getFeaturePlaceholder = (pos: PanelPosition): string => {
		const feat = getFeatureByPosition(pos);
		if (!feat) return "";
		const placeholderMap: Record<string, string> = {
			calendar: t.page.calendarPlaceholder,
			todos: t.page.todosPlaceholder,
			chat: t.page.chatPlaceholder,
			todoDetail: t.page.todoDetailPlaceholder,
			diary: t.page.diaryPlaceholder,
			settings: t.page.settingsPlaceholder,
		};
		return placeholderMap[feat] || "";
	};

	// 获取对应的图标
	const Icon = feature ? FEATURE_ICON_MAP[feature] : null;

	// 如果是待办功能，显示待办组件
	if (feature === "todos") {
		return <TodoList />;
	}

	// 其他功能显示占位符
	return (
		<div className="flex h-full flex-col">
			<div className="flex h-10 shrink-0 items-center gap-2 bg-muted/30 px-4">
				{Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
				<h2 className="text-sm font-medium text-foreground">
					{getFeatureLabel(position)}
				</h2>
			</div>
			<div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
				{getFeaturePlaceholder(position)}
			</div>
		</div>
	);
}
