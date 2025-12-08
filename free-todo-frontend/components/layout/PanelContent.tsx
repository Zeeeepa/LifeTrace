"use client";

import { CreateTodoForm } from "@/components/todo/CreateTodoForm";
import { TodoList } from "@/components/todo/TodoList";
import type { PanelPosition } from "@/lib/config/panel-config";
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

	// 如果是待办功能，显示待办组件
	if (feature === "todos") {
		return (
			<div className="flex h-full flex-col">
				<div className="flex h-10 shrink-0 items-center bg-muted/30 px-4">
					<h2 className="text-sm font-medium text-foreground">
						{getFeatureLabel(position)}
					</h2>
				</div>
				<CreateTodoForm />
				<TodoList />
			</div>
		);
	}

	// 其他功能显示占位符
	return (
		<div className="flex h-full flex-col">
			<div className="flex h-10 shrink-0 items-center bg-muted/30 px-4">
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
