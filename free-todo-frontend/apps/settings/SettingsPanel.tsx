"use client";

import { Settings, X } from "lucide-react";
import { useEffect, useState } from "react";
import { PanelHeader } from "@/components/common/PanelHeader";
import {
	ALL_PANEL_FEATURES,
	FEATURE_ICON_MAP,
	IS_DEV_FEATURE_ENABLED,
	type PanelFeature,
} from "@/lib/config/panel-config";
import {
	useSaveAndInitLlmApiSaveAndInitLlmPost,
	useTestLlmConfigApiTestLlmConfigPost,
} from "@/lib/generated/config/config";
import { useTranslations } from "@/lib/i18n";
import { useConfig, useSaveConfig } from "@/lib/query";
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

	// 使用 TanStack Query 获取配置
	const { data: config, isLoading: configLoading } = useConfig();

	// 使用 TanStack Query 保存配置
	const saveConfigMutation = useSaveConfig();
	const testLlmMutation = useTestLlmConfigApiTestLlmConfigPost();
	const saveAndInitLlmMutation = useSaveAndInitLlmApiSaveAndInitLlmPost();

	// 状态管理
	const [autoTodoDetectionEnabled, setAutoTodoDetectionEnabled] =
		useState(false);
	const setFeatureEnabled = useUiStore((state) => state.setFeatureEnabled);
	const isFeatureEnabled = useUiStore((state) => state.isFeatureEnabled);

	// LLM 配置状态
	const [llmApiKey, setLlmApiKey] = useState("");
	const [llmBaseUrl, setLlmBaseUrl] = useState("");
	const [llmModel, setLlmModel] = useState("qwen-plus");
	const [llmTemperature, setLlmTemperature] = useState(0.7);
	const [llmMaxTokens, setLlmMaxTokens] = useState(2048);
	const [initialLlmConfig, setInitialLlmConfig] = useState<{
		llmApiKey: string;
		llmBaseUrl: string;
		llmModel: string;
	}>({
		llmApiKey: "",
		llmBaseUrl: "",
		llmModel: "qwen-plus",
	});
	const [testMessage, setTestMessage] = useState<{
		type: "success" | "error";
		text: string;
	} | null>(null);

	// 录制配置状态
	const [recorderEnabled, setRecorderEnabled] = useState(false);
	const [recorderInterval, setRecorderInterval] = useState(10);
	const [blacklistEnabled, setBlacklistEnabled] = useState(false);
	const [blacklistApps, setBlacklistApps] = useState<string[]>([]);
	const [blacklistInput, setBlacklistInput] = useState("");

	// 当配置加载完成后，同步本地状态
	useEffect(() => {
		if (config) {
			setAutoTodoDetectionEnabled(
				(config.jobsAutoTodoDetectionEnabled as boolean) ?? false,
			);
			const costEnabled = (config.uiCostTrackingEnabled as boolean) ?? true;
			setFeatureEnabled("costTracking", costEnabled);

			// LLM 配置
			setLlmApiKey((config.llmApiKey as string) || "");
			setLlmBaseUrl((config.llmBaseUrl as string) || "");
			setLlmModel((config.llmModel as string) || "qwen-plus");
			setLlmTemperature((config.llmTemperature as number) ?? 0.7);
			setLlmMaxTokens((config.llmMaxTokens as number) ?? 2048);
			setInitialLlmConfig({
				llmApiKey: (config.llmApiKey as string) || "",
				llmBaseUrl: (config.llmBaseUrl as string) || "",
				llmModel: (config.llmModel as string) || "qwen-plus",
			});

			// 录制配置
			setRecorderEnabled((config.jobsRecorderEnabled as boolean) ?? false);
			setRecorderInterval((config.jobsRecorderInterval as number) ?? 10);
			setBlacklistEnabled(
				(config.jobsRecorderParamsBlacklistEnabled as boolean) ?? false,
			);
			const apps = config.jobsRecorderParamsBlacklistApps;
			if (Array.isArray(apps)) {
				setBlacklistApps(apps as string[]);
			} else {
				const appsStr = String(apps || "");
				if (appsStr) {
					const appArray = appsStr
						.split(",")
						.map((s: string) => s.trim())
						.filter((s: string) => s);
					setBlacklistApps(appArray);
				} else {
					setBlacklistApps([]);
				}
			}
		}
	}, [config, setFeatureEnabled]);

	const loading =
		configLoading ||
		saveConfigMutation.isPending ||
		testLlmMutation.isPending ||
		saveAndInitLlmMutation.isPending;

	// LLM 配置处理
	const handleTestLlm = async () => {
		// 确保使用最新的状态值
		const currentApiKey = llmApiKey.trim();
		const currentBaseUrl = llmBaseUrl.trim();
		const currentModel = llmModel.trim();

		if (!currentApiKey || !currentBaseUrl) {
			setTestMessage({
				type: "error",
				text: t.page.settings.apiKeyRequired,
			});
			return;
		}

		setTestMessage(null);
		try {
			const response = await testLlmMutation.mutateAsync({
				data: {
					llmApiKey: currentApiKey,
					llmBaseUrl: currentBaseUrl,
					llmModel: currentModel,
				},
			});

			const result = response as { success?: boolean; error?: string };
			if (result.success) {
				setTestMessage({
					type: "success",
					text: t.page.settings.testSuccess,
				});
			} else {
				setTestMessage({
					type: "error",
					text: `${t.page.settings.testFailed}: ${result.error || "Unknown error"}`,
				});
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : "Network error";
			setTestMessage({
				type: "error",
				text: `${t.page.settings.testFailed}: ${errorMsg}`,
			});
		}
	};

	const handleSaveLlmConfig = async () => {
		// 确保使用最新的状态值
		const currentApiKey = llmApiKey.trim();
		const currentBaseUrl = llmBaseUrl.trim();
		const currentModel = llmModel.trim();

		if (!currentApiKey || !currentBaseUrl) {
			// 如果 API Key 或 Base URL 为空，不显示错误，因为用户可能还在输入
			return;
		}

		try {
			// 检查 LLM 配置是否发生变化
			const llmConfigChanged =
				currentApiKey !== initialLlmConfig.llmApiKey ||
				currentBaseUrl !== initialLlmConfig.llmBaseUrl ||
				currentModel !== initialLlmConfig.llmModel;

			if (llmConfigChanged) {
				// 使用 save-and-init-llm 接口保存并重新初始化 LLM
				await saveAndInitLlmMutation.mutateAsync({
					data: {
						llmApiKey: currentApiKey,
						llmBaseUrl: currentBaseUrl,
						llmModel: currentModel,
					},
				});
			}

			// 保存其他 LLM 配置（temperature, maxTokens）
			await saveConfigMutation.mutateAsync({
				data: {
					llmTemperature,
					llmMaxTokens,
				},
			});

			setInitialLlmConfig({
				llmApiKey: currentApiKey,
				llmBaseUrl: currentBaseUrl,
				llmModel: currentModel,
			});

			// 只有在配置实际发生变化时才显示成功通知
			if (llmConfigChanged) {
				toastSuccess("LLM 配置已保存并重新初始化");
			}
		} catch (error) {
			console.error("保存 LLM 配置失败:", error);
			const errorMsg = error instanceof Error ? error.message : String(error);
			toastError(t.page.settings.saveFailed.replace("{error}", errorMsg));
		}
	};

	// 录制配置处理
	const handleSaveRecorderConfig = async (
		updates?: Partial<{
			jobsRecorderEnabled: boolean;
			jobsRecorderInterval: number;
			jobsRecorderParamsBlacklistEnabled: boolean;
			jobsRecorderParamsBlacklistApps: string[];
		}>,
	) => {
		try {
			await saveConfigMutation.mutateAsync({
				data: {
					jobsRecorderEnabled: updates?.jobsRecorderEnabled ?? recorderEnabled,
					jobsRecorderInterval:
						updates?.jobsRecorderInterval ?? recorderInterval,
					jobsRecorderParamsBlacklistEnabled:
						updates?.jobsRecorderParamsBlacklistEnabled ?? blacklistEnabled,
					jobsRecorderParamsBlacklistApps:
						updates?.jobsRecorderParamsBlacklistApps ?? blacklistApps,
				},
			});
		} catch (error) {
			console.error("保存录制配置失败:", error);
			const errorMsg = error instanceof Error ? error.message : String(error);
			toastError(t.page.settings.saveFailed.replace("{error}", errorMsg));
			throw error;
		}
	};

	// 黑名单处理
	const handleAddBlacklistApp = async (app: string) => {
		const trimmedApp = app.trim();
		if (trimmedApp && !blacklistApps.includes(trimmedApp)) {
			const newApps = [...blacklistApps, trimmedApp];
			setBlacklistApps(newApps);
			setBlacklistInput("");
			// 自动保存
			try {
				await saveConfigMutation.mutateAsync({
					data: {
						jobsRecorderParamsBlacklistApps: newApps,
					},
				});
			} catch (error) {
				// 回滚状态
				setBlacklistApps(blacklistApps);
				console.error("保存黑名单失败:", error);
			}
		}
	};

	const handleRemoveBlacklistApp = async (app: string) => {
		const newApps = blacklistApps.filter((a) => a !== app);
		const oldApps = blacklistApps;
		setBlacklistApps(newApps);
		// 自动保存
		try {
			await saveConfigMutation.mutateAsync({
				data: {
					jobsRecorderParamsBlacklistApps: newApps,
				},
			});
		} catch (error) {
			// 回滚状态
			setBlacklistApps(oldApps);
			console.error("保存黑名单失败:", error);
		}
	};

	const handleBlacklistKeyDown = async (
		e: React.KeyboardEvent<HTMLInputElement>,
	) => {
		if (e.key === "Enter" && blacklistInput.trim()) {
			e.preventDefault();
			await handleAddBlacklistApp(blacklistInput);
		} else if (
			e.key === "Backspace" &&
			!blacklistInput &&
			blacklistApps.length > 0
		) {
			const lastApp = blacklistApps[blacklistApps.length - 1];
			await handleRemoveBlacklistApp(lastApp);
		}
	};

	// 自动待办检测处理
	const handleToggleAutoTodoDetection = async (enabled: boolean) => {
		try {
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
					? t.page.settings.autoTodoDetectionEnabled
					: t.page.settings.autoTodoDetectionDisabled,
			);
		} catch (error) {
			console.error("保存配置失败:", error);
			const errorMsg = error instanceof Error ? error.message : String(error);
			toastError(t.page.settings.saveFailed.replace("{error}", errorMsg));
			setAutoTodoDetectionEnabled(!enabled);
		}
	};

	// 面板开关处理
	const handleTogglePanel = async (feature: PanelFeature, enabled: boolean) => {
		try {
			setFeatureEnabled(feature, enabled);

			// 如果是费用统计面板，还需要保存到配置
			if (feature === "costTracking") {
				await saveConfigMutation.mutateAsync({
					data: {
						uiCostTrackingEnabled: enabled,
					},
				});
			}

			toastSuccess(
				enabled
					? `${t.bottomDock[feature as keyof typeof t.bottomDock]} ${t.page.settings.panelEnabled}`
					: `${t.bottomDock[feature as keyof typeof t.bottomDock]} ${t.page.settings.panelDisabled}`,
			);
		} catch (error) {
			console.error("保存配置失败:", error);
			const errorMsg = error instanceof Error ? error.message : String(error);
			toastError(t.page.settings.saveFailed.replace("{error}", errorMsg));
			// 回滚状态
			setFeatureEnabled(feature, !enabled);
		}
	};

	// 获取所有可用的面板（排除 settings）
	const availablePanels = ALL_PANEL_FEATURES.filter(
		(feature) => feature !== "settings",
	);

	return (
		<div className="relative flex h-full flex-col overflow-hidden bg-background">
			{/* 顶部标题栏 */}
			<PanelHeader icon={Settings} title={t.page.settingsLabel} />

			{/* 设置内容区域 */}
			<div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
				{/* LLM 配置 */}
				<div className="rounded-lg border border-border p-4">
					<div className="mb-4">
						<h3 className="mb-1 text-base font-semibold text-foreground">
							{t.page.settings.llmConfig}
						</h3>
					</div>
					<div className="space-y-3">
						{/* 消息提示 */}
						{testMessage && (
							<div
								className={`rounded-lg px-3 py-2 text-sm font-medium ${
									testMessage.type === "success"
										? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
										: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
								}`}
							>
								{testMessage.text}
							</div>
						)}

						{/* API Key */}
						<div>
							<label
								htmlFor="llm-api-key"
								className="mb-1 block text-sm font-medium text-foreground"
							>
								{t.page.settings.apiKey} <span className="text-red-500">*</span>
							</label>
							<input
								id="llm-api-key"
								type="password"
								className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
								placeholder={t.page.settings.apiKey}
								value={llmApiKey}
								onChange={(e) => setLlmApiKey(e.target.value)}
								onBlur={handleSaveLlmConfig}
								disabled={loading}
							/>
							<p className="mt-1 text-xs text-muted-foreground">
								{t.page.settings.apiKeyHint}{" "}
								<a
									href="https://bailian.console.aliyun.com/?tab=api#/api"
									target="_blank"
									rel="noopener noreferrer"
									className="text-primary hover:underline"
								>
									{t.page.settings.apiKeyLink}
								</a>
							</p>
						</div>

						{/* Base URL */}
						<div>
							<label
								htmlFor="llm-base-url"
								className="mb-1 block text-sm font-medium text-foreground"
							>
								{t.page.settings.baseUrl}{" "}
								<span className="text-red-500">*</span>
							</label>
							<input
								id="llm-base-url"
								type="text"
								className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
								placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
								value={llmBaseUrl}
								onChange={(e) => setLlmBaseUrl(e.target.value)}
								onBlur={handleSaveLlmConfig}
								disabled={loading}
							/>
						</div>

						{/* Model / Temperature / Max Tokens */}
						<div className="grid grid-cols-3 gap-3">
							<div>
								<label
									htmlFor="llm-model"
									className="mb-1 block text-sm font-medium text-foreground"
								>
									{t.page.settings.model}
								</label>
								<input
									id="llm-model"
									type="text"
									className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
									placeholder="qwen-plus"
									value={llmModel}
									onChange={(e) => setLlmModel(e.target.value)}
									onBlur={handleSaveLlmConfig}
									disabled={loading}
								/>
							</div>
							<div>
								<label
									htmlFor="llm-temperature"
									className="mb-1 block text-sm font-medium text-foreground"
								>
									{t.page.settings.temperature}
								</label>
								<input
									id="llm-temperature"
									type="number"
									step="0.1"
									min="0"
									max="2"
									className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
									value={llmTemperature}
									onChange={(e) =>
										setLlmTemperature(parseFloat(e.target.value))
									}
									onBlur={handleSaveLlmConfig}
									disabled={loading}
								/>
							</div>
							<div>
								<label
									htmlFor="llm-max-tokens"
									className="mb-1 block text-sm font-medium text-foreground"
								>
									{t.page.settings.maxTokens}
								</label>
								<input
									id="llm-max-tokens"
									type="number"
									className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
									value={llmMaxTokens}
									onChange={(e) =>
										setLlmMaxTokens(parseInt(e.target.value, 10))
									}
									onBlur={handleSaveLlmConfig}
									disabled={loading}
								/>
							</div>
						</div>

						{/* 测试按钮 */}
						<button
							type="button"
							onClick={async () => {
								// 先让输入框失去焦点，确保状态已更新
								if (document.activeElement instanceof HTMLElement) {
									document.activeElement.blur();
								}
								// 等待一小段时间确保状态更新
								await new Promise((resolve) => setTimeout(resolve, 50));
								await handleTestLlm();
							}}
							disabled={loading || !llmApiKey.trim() || !llmBaseUrl.trim()}
							className="w-full rounded-md border border-input bg-background px-4 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{testLlmMutation.isPending
								? `${t.page.settings.testConnection}...`
								: t.page.settings.testConnection}
						</button>
					</div>
				</div>

				{/* 基础设置 */}
				<div className="rounded-lg border border-border p-4">
					<div className="mb-4">
						<h3 className="mb-1 text-base font-semibold text-foreground">
							{t.page.settings.basicSettings}
						</h3>
					</div>
					<div className="space-y-4">
						{/* 启用录制 */}
						<div className="flex items-center justify-between">
							<div className="flex-1">
								<p className="text-sm font-medium text-foreground">
									{t.page.settings.enableRecording}
								</p>
								<p className="mt-0.5 text-xs text-muted-foreground">
									{t.page.settings.enableRecordingDesc}
								</p>
							</div>
							<button
								type="button"
								disabled={loading}
								onClick={async () => {
									const newValue = !recorderEnabled;
									setRecorderEnabled(newValue);
									try {
										await handleSaveRecorderConfig({
											jobsRecorderEnabled: newValue,
										});
									} catch {
										setRecorderEnabled(recorderEnabled);
									}
								}}
								className={`
                  relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                  focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${recorderEnabled ? "bg-primary" : "bg-muted"}
                `}
							>
								<span
									className={`
                    inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                    ${recorderEnabled ? "translate-x-6" : "translate-x-1"}
                  `}
								/>
							</button>
						</div>

						{/* 录制子设置 */}
						{recorderEnabled && (
							<div className="space-y-3 pl-4 border-l-2 border-border">
								{/* 截图间隔 */}
								<div>
									<label
										htmlFor="recorder-interval"
										className="mb-1 block text-sm font-medium text-foreground"
									>
										{t.page.settings.screenshotInterval}
									</label>
									<input
										id="recorder-interval"
										type="number"
										className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
										value={recorderInterval}
										onChange={(e) =>
											setRecorderInterval(parseInt(e.target.value, 10))
										}
										onBlur={() => handleSaveRecorderConfig()}
										disabled={loading}
									/>
								</div>

								{/* 启用黑名单 */}
								<div className="flex items-center justify-between">
									<div className="flex-1">
										<p className="text-sm font-medium text-foreground">
											{t.page.settings.enableBlacklist}
										</p>
										<p className="mt-0.5 text-xs text-muted-foreground">
											{t.page.settings.enableBlacklistDesc}
										</p>
									</div>
									<button
										type="button"
										disabled={loading}
										onClick={async () => {
											const newValue = !blacklistEnabled;
											setBlacklistEnabled(newValue);
											try {
												await handleSaveRecorderConfig({
													jobsRecorderParamsBlacklistEnabled: newValue,
												});
											} catch {
												setBlacklistEnabled(blacklistEnabled);
											}
										}}
										className={`
                      relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                      focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
                      disabled:opacity-50 disabled:cursor-not-allowed
                      ${blacklistEnabled ? "bg-primary" : "bg-muted"}
                    `}
									>
										<span
											className={`
                        inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                        ${blacklistEnabled ? "translate-x-6" : "translate-x-1"}
                      `}
										/>
									</button>
								</div>

								{/* 应用黑名单 */}
								{blacklistEnabled && (
									<div>
										<label
											htmlFor="blacklist-input"
											className="mb-1 block text-sm font-medium text-foreground"
										>
											{t.page.settings.appBlacklist}
										</label>
										<div className="min-h-[38px] flex flex-wrap gap-1.5 items-center rounded-md border border-input bg-background px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 transition-all">
											{blacklistApps.map((app) => (
												<span
													key={app}
													className="inline-flex items-center gap-1 px-2 py-0.5 text-sm bg-primary/10 text-primary rounded-md border border-primary/20"
												>
													{app}
													<button
														type="button"
														onClick={() => handleRemoveBlacklistApp(app)}
														className="hover:bg-primary/20 rounded-full p-0.5 transition-colors"
														aria-label={`删除 ${app}`}
													>
														<X className="h-3 w-3" />
													</button>
												</span>
											))}
											<input
												id="blacklist-input"
												type="text"
												className="flex-1 min-w-[120px] outline-none bg-transparent text-sm placeholder:text-muted-foreground px-1"
												placeholder={t.page.settings.blacklistPlaceholder}
												value={blacklistInput}
												onChange={(e) => setBlacklistInput(e.target.value)}
												onKeyDown={handleBlacklistKeyDown}
												disabled={loading}
											/>
										</div>
										<p className="mt-1 text-xs text-muted-foreground">
											{t.page.settings.blacklistDesc}
										</p>
									</div>
								)}
							</div>
						)}
					</div>
				</div>

				{/* 功能开关 */}
				{/* 自动待办检测设置 */}
				<div className="rounded-lg border border-border p-4">
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

				{/* 面板开关 */}
				<div className="rounded-lg border border-border p-4">
					<div className="mb-4">
						<h3 className="mb-1 text-base font-semibold text-foreground">
							{t.page.settings.panelSwitchesTitle}
						</h3>
						<p className="text-sm text-muted-foreground">
							{t.page.settings.panelSwitchesDescription}
						</p>
					</div>
					<div className="space-y-3">
						{availablePanels.map((feature) => {
							// 跳过开发模式下的功能（如果不是开发模式）
							if (feature === "debugShots" && !IS_DEV_FEATURE_ENABLED) {
								return null;
							}

							const enabled = isFeatureEnabled(feature);
							const panelLabel =
								(feature in t.bottomDock
									? t.bottomDock[feature as keyof typeof t.bottomDock]
									: feature) || feature;
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
									<button
										type="button"
										id={`panel-toggle-${feature}`}
										disabled={loading}
										onClick={() => handleTogglePanel(feature, !enabled)}
										className={`
                      relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                      focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
                      disabled:opacity-50 disabled:cursor-not-allowed
                      ${enabled ? "bg-primary" : "bg-muted"}
                    `}
										aria-label={panelLabel}
									>
										<span
											className={`
                        inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                        ${enabled ? "translate-x-6" : "translate-x-1"}
                      `}
										/>
									</button>
								</div>
							);
						})}
					</div>
				</div>
			</div>
		</div>
	);
}
