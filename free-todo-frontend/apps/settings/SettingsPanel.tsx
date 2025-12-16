"use client";

import { Settings } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { getConfig, saveConfig } from "@/lib/api";
import { useTranslations } from "@/lib/i18n";
import { useLocaleStore } from "@/lib/store/locale";
import { useNotificationStore } from "@/lib/store/notification-store";
import { useUiStore } from "@/lib/store/ui-store";
import { toastError, toastSuccess } from "@/lib/toast";

/**
 * 设置面板组件
 * 用于配置系统各项功能
 */
export function SettingsPanel() {
	const { locale } = useLocaleStore();
	const t = useTranslations(locale);
	const [loading, setLoading] = useState(false);
	const [autoTodoDetectionEnabled, setAutoTodoDetectionEnabled] =
		useState(false);
	const [costPanelEnabled, setCostPanelEnabled] = useState<boolean>(() =>
		useUiStore.getState().isFeatureEnabled("costTracking"),
	);
	const setFeatureEnabled = useUiStore((state) => state.setFeatureEnabled);

	const loadConfig = useCallback(async () => {
		setLoading(true);
		try {
			const response = await getConfig();
			if (response.success && response.config) {
				setAutoTodoDetectionEnabled(
					(response.config.jobsAutoTodoDetectionEnabled as boolean) ?? false,
				);
				const costEnabled =
					(response.config.uiCostTrackingEnabled as boolean) ?? true;
				setCostPanelEnabled(costEnabled);
				setFeatureEnabled("costTracking", costEnabled);
			}
		} catch (error) {
			console.error("加载配置失败:", error);
			const errorMsg = error instanceof Error ? error.message : String(error);
			toastError(t.page.settings.loadFailed.replace("{error}", errorMsg));
		} finally {
			setLoading(false);
		}
	}, [setFeatureEnabled, t]);

	// 加载配置
	useEffect(() => {
		void loadConfig();
	}, [loadConfig]);

	const handleToggleAutoTodoDetection = async (enabled: boolean) => {
		setLoading(true);
		try {
			await saveConfig({
				jobsAutoTodoDetectionEnabled: enabled,
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
					? t.page.settings.autoTodoDetectionEnabled
					: t.page.settings.autoTodoDetectionDisabled,
			);
		} catch (error) {
			console.error("保存配置失败:", error);
			const errorMsg = error instanceof Error ? error.message : String(error);
			toastError(t.page.settings.saveFailed.replace("{error}", errorMsg));
			// 恢复原状态
			setAutoTodoDetectionEnabled(!enabled);
		} finally {
			setLoading(false);
		}
	};

	const handleToggleCostPanel = async (enabled: boolean) => {
		setLoading(true);
		try {
			await saveConfig({
				uiCostTrackingEnabled: enabled,
			});
			setCostPanelEnabled(enabled);
			setFeatureEnabled("costTracking", enabled);
			toastSuccess(
				enabled
					? t.page.settings.costTrackingPanelEnabled
					: t.page.settings.costTrackingPanelDisabled,
			);
		} catch (error) {
			console.error("保存配置失败:", error);
			const errorMsg = error instanceof Error ? error.message : String(error);
			toastError(t.page.settings.saveFailed.replace("{error}", errorMsg));
			setCostPanelEnabled(!enabled);
			setFeatureEnabled("costTracking", !enabled);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="relative flex h-full flex-col overflow-hidden bg-background">
			{/* 顶部标题栏 */}
			<div className="shrink-0 bg-primary/15">
				<div className="flex items-center justify-between px-4 py-2.5">
					<h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
						<Settings className="h-5 w-5 text-primary" />
						{t.page.settingsLabel}
					</h2>
				</div>
			</div>

			{/* 设置内容区域 */}
			<div className="flex-1 overflow-y-auto px-4 py-6">
				{/* 自动待办检测设置 */}
				<div className="mb-6 rounded-lg border border-border bg-card p-4">
					<div className="mb-4">
						<h3 className="mb-1 text-base font-semibold text-foreground">
							{t.page.settings.autoTodoDetectionTitle}
						</h3>
						<p className="text-sm text-muted-foreground">
							{t.page.settings.autoTodoDetectionDescription}
						</p>
					</div>
					<div className="flex items-center justify-between">
						<div className="flex-1">
							<label
								htmlFor="auto-todo-detection-toggle"
								className="text-sm font-medium text-foreground"
							>
								{t.page.settings.autoTodoDetectionLabel}
							</label>
						</div>
						<button
							type="button"
							id="auto-todo-detection-toggle"
							disabled={loading}
							onClick={() =>
								handleToggleAutoTodoDetection(!autoTodoDetectionEnabled)
							}
							className={`
                relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
                disabled:opacity-50 disabled:cursor-not-allowed
                ${autoTodoDetectionEnabled ? "bg-primary" : "bg-muted"}
              `}
							aria-label={t.page.settings.autoTodoDetectionLabel}
						>
							<span
								className={`
                  inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                  ${
										autoTodoDetectionEnabled ? "translate-x-6" : "translate-x-1"
									}
                `}
							/>
						</button>
					</div>
					{autoTodoDetectionEnabled && (
						<div className="mt-3 rounded-md bg-primary/10 p-3">
							<p className="text-xs text-primary">
								{t.page.settings.autoTodoDetectionHint}
							</p>
						</div>
					)}
				</div>

				{/* 费用统计面板 */}
				<div className="rounded-lg border border-border bg-card p-4">
					<div className="mb-4">
						<h3 className="mb-1 text-base font-semibold text-foreground">
							{t.page.settings.costTrackingPanelTitle}
						</h3>
						<p className="text-sm text-muted-foreground">
							{t.page.settings.costTrackingPanelDescription}
						</p>
					</div>
					<div className="flex items-center justify-between">
						<div className="flex-1">
							<label
								htmlFor="cost-tracking-toggle"
								className="text-sm font-medium text-foreground"
							>
								{t.page.settings.costTrackingPanelLabel}
							</label>
						</div>
						<button
							type="button"
							id="cost-tracking-toggle"
							disabled={loading}
							onClick={() => handleToggleCostPanel(!costPanelEnabled)}
							className={`
                relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
                disabled:opacity-50 disabled:cursor-not-allowed
                ${costPanelEnabled ? "bg-primary" : "bg-muted"}
              `}
							aria-label={t.page.settings.costTrackingPanelLabel}
						>
							<span
								className={`
                  inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                  ${costPanelEnabled ? "translate-x-6" : "translate-x-1"}
                `}
							/>
						</button>
					</div>
					{!costPanelEnabled && (
						<div className="mt-3 rounded-md bg-muted p-3">
							<p className="text-xs text-muted-foreground">
								{t.page.settings.costTrackingPanelHint}
							</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
