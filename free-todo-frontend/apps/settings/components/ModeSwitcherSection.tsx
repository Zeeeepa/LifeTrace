"use client";

import { MessageSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ChatMode } from "@/apps/chat/types";
import { useUiStore } from "@/lib/store/ui-store";
import { toastSuccess } from "@/lib/toast";
import { SettingsSection } from "./SettingsSection";
import { ToggleSwitch } from "./ToggleSwitch";

interface ModeSwitcherSectionProps {
	loading?: boolean;
}

/**
 * ModeSwitcher 开关设置区块组件
 * 控制聊天面板的模式切换器是否显示，以及默认聊天模式
 */
export function ModeSwitcherSection({
	loading = false,
}: ModeSwitcherSectionProps) {
	const tSettings = useTranslations("page.settings");
	const tChat = useTranslations("chat");
	const showModeSwitcher = useUiStore((state) => state.showModeSwitcher);
	const setShowModeSwitcher = useUiStore((state) => state.setShowModeSwitcher);
	const defaultChatMode = useUiStore((state) => state.defaultChatMode);
	const setDefaultChatMode = useUiStore((state) => state.setDefaultChatMode);
	const showAgnoToolSelector = useUiStore(
		(state) => state.showAgnoToolSelector,
	);
	const setShowAgnoToolSelector = useUiStore(
		(state) => state.setShowAgnoToolSelector,
	);

	const handleToggle = (enabled: boolean) => {
		setShowModeSwitcher(enabled);
		toastSuccess(
			enabled
				? tSettings("modeSwitcherEnabled")
				: tSettings("modeSwitcherDisabled"),
		);
	};

	const handleDefaultModeChange = (mode: ChatMode) => {
		setDefaultChatMode(mode);
		toastSuccess(tSettings("defaultChatModeChanged"));
	};

	const handleToolSelectorToggle = (enabled: boolean) => {
		setShowAgnoToolSelector(enabled);
		toastSuccess(
			enabled
				? tSettings("agnoToolSelectorEnabled")
				: tSettings("agnoToolSelectorDisabled"),
		);
	};

	const chatModes: ChatMode[] = ["ask", "plan", "edit", "difyTest", "agno"];

	return (
		<SettingsSection
			title={tSettings("modeSwitcherTitle")}
			description={tSettings("modeSwitcherDescription")}
		>
			{/* 显示模式切换器开关 */}
			<div className="flex items-center justify-between">
				<div className="flex-1 flex items-center gap-2">
					<MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
					<label
						htmlFor="mode-switcher-toggle"
						className="text-sm font-medium text-foreground cursor-pointer"
					>
						{tSettings("modeSwitcherLabel")}
					</label>
				</div>
				<ToggleSwitch
					id="mode-switcher-toggle"
					enabled={showModeSwitcher}
					disabled={loading}
					onToggle={handleToggle}
					ariaLabel={tSettings("modeSwitcherLabel")}
				/>
			</div>
			<p className="mt-2 text-xs text-muted-foreground">
				{tSettings("modeSwitcherHint")}
			</p>

			{/* 默认聊天模式选择 */}
			<div className="mt-4 flex items-center justify-between">
				<label
					htmlFor="default-chat-mode-select"
					className="text-sm font-medium text-foreground"
				>
					{tSettings("defaultChatModeLabel")}
				</label>
				<select
					id="default-chat-mode-select"
					value={defaultChatMode}
					onChange={(e) =>
						handleDefaultModeChange(e.target.value as ChatMode)
					}
					disabled={loading}
					className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
				>
					{chatModes.map((mode) => (
						<option key={mode} value={mode}>
							{tChat(`modes.${mode}.label`)}
						</option>
					))}
				</select>
			</div>
			<p className="mt-2 text-xs text-muted-foreground">
				{tSettings("defaultChatModeHint")}
			</p>

			{/* Agno 工具选择器开关 */}
			<div className="mt-4 flex items-center justify-between">
				<div className="flex-1 flex items-center gap-2">
					<MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
					<label
						htmlFor="agno-tool-selector-toggle"
						className="text-sm font-medium text-foreground cursor-pointer"
					>
						{tSettings("agnoToolSelectorLabel")}
					</label>
				</div>
				<ToggleSwitch
					id="agno-tool-selector-toggle"
					enabled={showAgnoToolSelector}
					disabled={loading}
					onToggle={handleToolSelectorToggle}
					ariaLabel={tSettings("agnoToolSelectorLabel")}
				/>
			</div>
			<p className="mt-2 text-xs text-muted-foreground">
				{tSettings("agnoToolSelectorHint")}
			</p>
		</SettingsSection>
	);
}
