"use client";

import { Settings, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { CollapsibleSection } from "@/components/common/layout/CollapsibleSection";
import { PanelHeader } from "@/components/common/layout/PanelHeader";
import {
	ALL_PANEL_FEATURES,
	DEV_IN_PROGRESS_FEATURES,
	FEATURE_ICON_MAP,
	IS_DEV_FEATURE_ENABLED,
	type PanelFeature,
} from "@/lib/config/panel-config";
import { useConfig, useSaveConfig } from "@/lib/query";
import { useNotificationStore } from "@/lib/store/notification-store";
import type { DockDisplayMode } from "@/lib/store/ui-store";
import { useUiStore } from "@/lib/store/ui-store";
import { toastError, toastSuccess } from "@/lib/toast";
import {
	DifyConfigSection,
	LlmConfigSection,
	RecorderConfigSection,
	SchedulerSection,
	SettingsSection,
	TavilyConfigSection,
	ToggleSwitch,
} from "./components";

/**
 * 设置面板组件
 * 用于配置系统各项功能
 */
export function SettingsPanel() {
	const tPage = useTranslations("page");
	const tSettings = useTranslations("page.settings");
	const tBottomDock = useTranslations("bottomDock");

	// 使用 TanStack Query 获取配置
	const { data: config, isLoading: configLoading } = useConfig();

	// 使用 TanStack Query 保存配置
	const saveConfigMutation = useSaveConfig();

	// 状态管理
	const [autoTodoDetectionEnabled, setAutoTodoDetectionEnabled] =
		useState(false);
	const [whitelistApps, setWhitelistApps] = useState<string[]>([]);
	const [whitelistInput, setWhitelistInput] = useState("");
	const [showDeveloperOptions, setShowDeveloperOptions] = useState(false);
	const [showDevPanels, setShowDevPanels] = useState(false);
	const setFeatureEnabled = useUiStore((state) => state.setFeatureEnabled);
	const isFeatureEnabled = useUiStore((state) => state.isFeatureEnabled);
	const dockDisplayMode = useUiStore((state) => state.dockDisplayMode);
	const setDockDisplayMode = useUiStore((state) => state.setDockDisplayMode);

	// 用于跟踪最后一次保存的时间戳，防止保存后立即被 refetch 覆盖
	const lastSaveTimeRef = useRef<number>(0);

	// 当配置加载完成后，同步本地状态
	// 但如果刚刚保存过配置（500ms 内），则跳过同步，避免被旧值覆盖
	useEffect(() => {
		if (config) {
			const now = Date.now();
			// 如果刚刚保存过配置（500ms 内），跳过同步
			if (now - lastSaveTimeRef.current < 500) {
				return;
			}
			setAutoTodoDetectionEnabled(
				(config.jobsAutoTodoDetectionEnabled as boolean) ?? false,
			);
			// 同步白名单配置
			const apps = config.jobsAutoTodoDetectionParamsWhitelistApps;
			if (Array.isArray(apps)) {
				setWhitelistApps(apps as string[]);
			} else if (apps && typeof apps === "string") {
				const appsStr = apps as string;
				setWhitelistApps(
					appsStr
						.split(",")
						.map((s: string) => s.trim())
						.filter((s: string) => s),
				);
			}
		}
	}, [config]);

	const loading = configLoading || saveConfigMutation.isPending;

	// 自动待办检测处理
	const handleToggleAutoTodoDetection = async (enabled: boolean) => {
		try {
			// 记录保存时间戳
			lastSaveTimeRef.current = Date.now();

			await saveConfigMutation.mutateAsync({
				data: {
					jobsAutoTodoDetectionEnabled: enabled,
				},
			});
			setAutoTodoDetectionEnabled(enabled);

			// 同步更新轮询端点状态
			const store = useNotificationStore.getState();
			const existingEndpoint = store.getEndpoint("draft-todos");
			if (existingEndpoint) {
				store.registerEndpoint({
					...existingEndpoint,
					enabled: enabled,
				});
			}

			toastSuccess(
				enabled
					? tSettings("autoTodoDetectionEnabled")
					: tSettings("autoTodoDetectionDisabled"),
			);
		} catch (error) {
			console.error("保存配置失败:", error);
			const errorMsg = error instanceof Error ? error.message : String(error);
			toastError(tSettings("saveFailed", { error: errorMsg }));
			// 失败时清除保存时间戳，允许后续同步
			lastSaveTimeRef.current = 0;
			setAutoTodoDetectionEnabled(!enabled);
		}
	};

	// 面板开关处理
	const handleTogglePanel = async (feature: PanelFeature, enabled: boolean) => {
		try {
			setFeatureEnabled(feature, enabled);

			toastSuccess(
				enabled
					? `${tBottomDock(feature)} ${tSettings("panelEnabled")}`
					: `${tBottomDock(feature)} ${tSettings("panelDisabled")}`,
			);
		} catch (error) {
			console.error("切换面板失败:", error);
			const errorMsg = error instanceof Error ? error.message : String(error);
			toastError(tSettings("saveFailed", { error: errorMsg }));
			// 回滚状态
			setFeatureEnabled(feature, !enabled);
		}
	};

	// Dock 显示模式处理
	const handleDockDisplayModeChange = (mode: DockDisplayMode) => {
		setDockDisplayMode(mode);
		toastSuccess(tSettings("dockDisplayModeChanged"));
	};

	// 白名单处理函数
	const handleAddWhitelistApp = async (app: string) => {
		const trimmedApp = app.trim();
		if (trimmedApp && !whitelistApps.includes(trimmedApp)) {
			const newApps = [...whitelistApps, trimmedApp];
			setWhitelistApps(newApps);
			setWhitelistInput("");
			try {
				lastSaveTimeRef.current = Date.now();
				await saveConfigMutation.mutateAsync({
					data: {
						jobsAutoTodoDetectionParamsWhitelistApps: newApps,
					},
				});
			} catch (error) {
				setWhitelistApps(whitelistApps);
				console.error("保存白名单失败:", error);
				const errorMsg = error instanceof Error ? error.message : String(error);
				toastError(tSettings("saveFailed", { error: errorMsg }));
				lastSaveTimeRef.current = 0;
			}
		}
	};

	const handleRemoveWhitelistApp = async (app: string) => {
		const newApps = whitelistApps.filter((a) => a !== app);
		const oldApps = whitelistApps;
		setWhitelistApps(newApps);
		try {
			lastSaveTimeRef.current = Date.now();
			await saveConfigMutation.mutateAsync({
				data: {
					jobsAutoTodoDetectionParamsWhitelistApps: newApps,
				},
			});
		} catch (error) {
			setWhitelistApps(oldApps);
			console.error("保存白名单失败:", error);
			const errorMsg = error instanceof Error ? error.message : String(error);
			toastError(tSettings("saveFailed", { error: errorMsg }));
			lastSaveTimeRef.current = 0;
		}
	};

	const handleWhitelistKeyDown = async (
		e: React.KeyboardEvent<HTMLInputElement>,
	) => {
		if (e.key === "Enter" && whitelistInput.trim()) {
			e.preventDefault();
			await handleAddWhitelistApp(whitelistInput);
		} else if (
			e.key === "Backspace" &&
			!whitelistInput &&
			whitelistApps.length > 0
		) {
			const lastApp = whitelistApps[whitelistApps.length - 1];
			await handleRemoveWhitelistApp(lastApp);
		}
	};

	// 获取所有可用的面板（排除 settings）
	const availablePanels = ALL_PANEL_FEATURES.filter(
		(feature) => feature !== "settings",
	);

	// 开发中的面板 & 常规面板分组
	const devPanels = availablePanels.filter((feature) =>
		DEV_IN_PROGRESS_FEATURES.includes(feature),
	);
	const regularPanels = availablePanels.filter(
		(feature) => !DEV_IN_PROGRESS_FEATURES.includes(feature),
	);

	return (
		<div className="relative flex h-full flex-col overflow-hidden bg-background">
			{/* 顶部标题栏 */}
			<PanelHeader icon={Settings} title={tPage("settingsLabel")} />

			{/* 设置内容区域 */}
			<div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
				{/* LLM 配置 */}
				<LlmConfigSection config={config} loading={loading} />

				{/* Tavily 配置 */}
				<TavilyConfigSection config={config} loading={loading} />

				{/* 自动待办检测设置 */}
				<SettingsSection
					title={tSettings("autoTodoDetectionTitle")}
					description={tSettings("autoTodoDetectionDescription")}
				>
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<div className="flex-1">
								<label
									htmlFor="auto-todo-detection-toggle"
									className="text-sm font-medium text-foreground"
								>
									{tSettings("autoTodoDetectionLabel")}
								</label>
							</div>
							<ToggleSwitch
								id="auto-todo-detection-toggle"
								enabled={autoTodoDetectionEnabled}
								disabled={loading}
								onToggle={handleToggleAutoTodoDetection}
								ariaLabel={tSettings("autoTodoDetectionLabel")}
							/>
						</div>
						{autoTodoDetectionEnabled && (
							<>
								<div className="rounded-md bg-primary/10 p-3">
									<p className="text-xs text-primary">
										{tSettings("autoTodoDetectionHint")}
									</p>
								</div>
								{/* 应用白名单 */}
								<div className="pl-4 border-l-2 border-border">
									<label
										htmlFor="whitelist-input"
										className="mb-1 block text-sm font-medium text-foreground"
									>
										{tSettings("whitelistApps")}
									</label>
									<div className="min-h-[38px] flex flex-wrap gap-1.5 items-center rounded-md border border-input bg-background px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 transition-all">
										{whitelistApps.map((app) => (
											<span
												key={app}
												className="inline-flex items-center gap-1 px-2 py-0.5 text-sm bg-primary/10 text-primary rounded-md border border-primary/20"
											>
												{app}
												<button
													type="button"
													onClick={() => handleRemoveWhitelistApp(app)}
													className="hover:bg-primary/20 rounded-full p-0.5 transition-colors"
													aria-label={`删除 ${app}`}
												>
													<X className="h-3 w-3" />
												</button>
											</span>
										))}
										<input
											id="whitelist-input"
											type="text"
											className="flex-1 min-w-[120px] outline-none bg-transparent text-sm placeholder:text-muted-foreground px-1"
											placeholder={tSettings("whitelistAppsPlaceholder")}
											value={whitelistInput}
											onChange={(e) => setWhitelistInput(e.target.value)}
											onKeyDown={handleWhitelistKeyDown}
											disabled={loading}
										/>
									</div>
									<p className="mt-1 text-xs text-muted-foreground">
										{tSettings("whitelistAppsDesc")}
									</p>
								</div>
							</>
						)}
					</div>
				</SettingsSection>

				{/* Dock 显示模式设置 */}
				<SettingsSection
					title={tSettings("dockDisplayModeTitle")}
					description={tSettings("dockDisplayModeDescription")}
				>
					<div className="flex items-center justify-between">
						<label
							htmlFor="dock-display-mode-select"
							className="text-sm font-medium text-foreground"
						>
							{tSettings("dockDisplayModeLabel")}
						</label>
						<select
							id="dock-display-mode-select"
							value={dockDisplayMode}
							onChange={(e) =>
								handleDockDisplayModeChange(e.target.value as DockDisplayMode)
							}
							disabled={loading}
							className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
						>
							<option value="fixed">{tSettings("dockDisplayModeFixed")}</option>
							<option value="auto-hide">
								{tSettings("dockDisplayModeAutoHide")}
							</option>
						</select>
					</div>
				</SettingsSection>

				{/* 面板开关 */}
				<SettingsSection
					title={tSettings("panelSwitchesTitle")}
					description={tSettings("panelSwitchesDescription")}
				>
					<div className="space-y-3">
						{regularPanels.map((feature) => {
							// 跳过开发模式下的功能（如果不是开发模式）
							if (feature === "debugShots" && !IS_DEV_FEATURE_ENABLED) {
								return null;
							}

							const enabled = isFeatureEnabled(feature);
							const panelLabel = tBottomDock(feature) || feature;
							const Icon = FEATURE_ICON_MAP[feature];

							return (
								<div
									key={feature}
									className="flex items-center justify-between"
								>
									<div className="flex-1 flex items-center gap-2">
										{Icon && (
											<Icon className="h-4 w-4 text-muted-foreground shrink-0" />
										)}
										<label
											htmlFor={`panel-toggle-${feature}`}
											className="text-sm font-medium text-foreground cursor-pointer"
										>
											{panelLabel}
										</label>
									</div>
									<ToggleSwitch
										id={`panel-toggle-${feature}`}
										enabled={enabled}
										disabled={loading}
										onToggle={(newEnabled) =>
											handleTogglePanel(feature, newEnabled)
										}
										ariaLabel={panelLabel}
									/>
								</div>
							);
						})}

						{/* 开发中的面板（折叠分组，位于面板开关内部底部） */}
						{devPanels.length > 0 && (
							<CollapsibleSection
								title={tSettings("devPanelsTitle")}
								show={showDevPanels}
								onToggle={() => setShowDevPanels((prev) => !prev)}
								className="mt-4"
								contentClassName="mt-3"
							>
								<SettingsSection
									title={tSettings("devPanelsTitle")}
									description={tSettings("devPanelsDescription")}
								>
									<div className="space-y-3">
										{devPanels.map((feature) => {
											// 开发中的截图调试面板仅在开发模式下展示
											if (feature === "debugShots" && !IS_DEV_FEATURE_ENABLED) {
												return null;
											}

											const enabled = isFeatureEnabled(feature);
											const panelLabel = tBottomDock(feature) || feature;
											const Icon = FEATURE_ICON_MAP[feature];

											return (
												<div
													key={feature}
													className="flex items-center justify-between"
												>
													<div className="flex-1 flex items-center gap-2">
														{Icon && (
															<Icon className="h-4 w-4 text-muted-foreground shrink-0" />
														)}
														<label
															htmlFor={`panel-toggle-${feature}`}
															className="text-sm font-medium text-foreground cursor-pointer"
														>
															{panelLabel}
														</label>
													</div>
													<ToggleSwitch
														id={`panel-toggle-${feature}`}
														enabled={enabled}
														disabled={loading}
														onToggle={(newEnabled) =>
															handleTogglePanel(feature, newEnabled)
														}
														ariaLabel={panelLabel}
													/>
												</div>
											);
										})}
									</div>
								</SettingsSection>
							</CollapsibleSection>
						)}
					</div>
				</SettingsSection>

				{/* 开发者选项（整栏可折叠） */}
				<CollapsibleSection
					title={tSettings("developerSectionTitle")}
					show={showDeveloperOptions}
					onToggle={() => setShowDeveloperOptions((prevShow) => !prevShow)}
					className="mt-4"
					contentClassName="mt-3"
				>
					<SettingsSection
						title={tSettings("developerSectionTitle")}
						description={tSettings("developerSectionDescription")}
					>
						{/* 定时任务管理（开发者选项中的第一项） */}
						<SchedulerSection loading={loading} />

						{/* Dify 配置（不再单独折叠） */}
						<div className="mt-4">
							<DifyConfigSection config={config} loading={loading} />
						</div>

						{/* 屏幕录制设置（黑名单等） */}
						<div className="mt-4">
							<RecorderConfigSection config={config} loading={loading} />
						</div>
					</SettingsSection>
				</CollapsibleSection>
			</div>
		</div>
	);
}
