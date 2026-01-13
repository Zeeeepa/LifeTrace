"use client";

import { ChevronsUpDown, Maximize2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useContext } from "react";
import type { PanelFeature } from "@/lib/config/panel-config";
import { FEATURE_ICON_MAP } from "@/lib/config/panel-config";
import { PanelFeatureContext } from "./PanelFeatureContext";
import { IslandMode } from "./types";

interface PanelTitleBarProps {
	onModeChange?: (mode: IslandMode) => void;
	onClose?: () => void;
}

// Panel模式标题栏组件 - 显示当前功能名称
export function PanelTitleBar({
	onModeChange,
	onClose,
}: PanelTitleBarProps) {
	const t = useTranslations("bottomDock");
	const tIsland = useTranslations("dynamicIsland");
	const context = useContext(PanelFeatureContext);
	const currentFeature = context?.currentFeature ?? "chat";

	const featureLabelMap: Partial<Record<PanelFeature, string>> = {
		calendar: "calendar",
		activity: "activity",
		todos: "todos",
		chat: "chat",
		todoDetail: "todoDetail",
		diary: "diary",
		settings: "settings",
		costTracking: "costTracking",
		achievements: "achievements",
	};

	const labelKey = featureLabelMap[currentFeature] ?? "chat";
	const Icon = FEATURE_ICON_MAP[currentFeature];

	return (
		<div
			className="h-8 px-4 flex items-center justify-between bg-background/95 relative"
			style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
		>
			{/* 排除顶部边缘区域（4px），让 top ResizeHandle 可以工作 */}
			<div
				className="absolute top-0 left-0 right-0 h-1 pointer-events-none"
				style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
			/>
			<div className="flex items-center gap-2 text-xs text-[oklch(var(--foreground))]/70 select-none">
				{Icon && <Icon className="h-3.5 w-3.5" />}
				<span>LifeTrace · {t(labelKey)}</span>
			</div>
			{/* 右上角：和全屏模式保持一致的"全屏 / 折叠"按钮 */}
			<div
				className="flex items-center gap-1.5 text-[oklch(var(--foreground))]/60"
				style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
			>
				<button
					type="button"
					className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-[oklch(var(--muted))]/40 hover:text-[oklch(var(--foreground))] transition-colors"
					title={tIsland("expandFullscreen")}
					onClick={async (e) => {
						e.stopPropagation();
							onModeChange?.(IslandMode.FULLSCREEN);
					}}
				>
					<Maximize2 size={14} />
				</button>
				<button
					type="button"
					className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-[oklch(var(--muted))]/40 hover:text-[oklch(var(--foreground))] transition-colors"
					title={tIsland("collapseIsland")}
					onClick={async (e) => {
						e.stopPropagation();
							onModeChange?.(IslandMode.FLOAT);
							onClose?.();
					}}
				>
					<ChevronsUpDown size={14} />
				</button>
			</div>
		</div>
	);
}
