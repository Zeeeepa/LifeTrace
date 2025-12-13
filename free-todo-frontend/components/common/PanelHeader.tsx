"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * 统一的面板头部组件
 * 确保所有面板的 headerbar 高度一致
 */
interface PanelHeaderProps {
	/** 标题图标 */
	icon: LucideIcon;
	/** 标题文本 */
	title: string;
	/** 右侧操作区域 */
	actions?: ReactNode;
	/** 自定义类名 */
	className?: string;
}

export function PanelHeader({
	icon: Icon,
	title,
	actions,
	className,
}: PanelHeaderProps) {
	return (
		<div className="shrink-0 bg-primary/15">
			<div
				className={`flex items-center justify-between px-4 py-2.5 ${className || ""}`}
			>
				<h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
					<Icon className="h-5 w-5 text-primary" />
					{title}
				</h2>
				{actions && <div className="flex items-center gap-2">{actions}</div>}
			</div>
		</div>
	);
}
