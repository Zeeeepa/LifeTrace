"use client";

import { Check, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useSaveConfig } from "@/lib/query";
import type { AppConfig } from "@/lib/query/config";
import { toastError, toastSuccess } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { SettingsSection } from "./index";

interface TavilyConfigSectionProps {
	config: AppConfig | undefined;
	loading?: boolean;
}

/**
 * Tavily 配置区块
 * - 通过 dynaconf 管理：tavily.api_key
 * - 前端字段映射：tavilyApiKey
 */
export function TavilyConfigSection({
	config,
	loading = false,
}: TavilyConfigSectionProps) {
	const t = useTranslations("page.settings");
	const saveConfigMutation = useSaveConfig();

	const [apiKey, setApiKey] = useState<string>(
		(config?.tavilyApiKey as string | undefined) ?? "",
	);
	const [savedApiKey, setSavedApiKey] = useState<string>(
		(config?.tavilyApiKey as string | undefined) ?? "",
	);

	const isSaving = loading || saveConfigMutation.isPending;
	const hasChanges = apiKey !== savedApiKey;

	// 当配置加载完成后，同步本地状态
	useEffect(() => {
		if (config) {
			// 只在配置值存在时更新，避免覆盖用户正在编辑的值
			if (config.tavilyApiKey !== undefined) {
				const newApiKey = (config.tavilyApiKey as string) || "";
				setApiKey(newApiKey);
				setSavedApiKey(newApiKey);
			}
		}
	}, [config]);

	const handleSave = async () => {
		if (!hasChanges) return;

		try {
			const payload = {
				tavilyApiKey: apiKey,
			};

			await saveConfigMutation.mutateAsync({ data: payload });
			setSavedApiKey(apiKey);
			toastSuccess(t("tavilySaveSuccess"));
		} catch (error) {
			console.error("保存 Tavily 配置失败:", error);
			const errorMsg = error instanceof Error ? error.message : String(error);
			toastError(t("saveFailed", { error: errorMsg }));
		}
	};

	return (
		<SettingsSection title={t("tavilyConfigTitle")}>
			<div className="space-y-4">
				{/* API Key */}
				<div className="space-y-1">
					<label
						htmlFor="tavily-api-key"
						className="block text-sm font-medium text-foreground"
					>
						{t("apiKey")}
					</label>
					<div className="flex gap-2">
						<input
							id="tavily-api-key"
							type="password"
							className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
							placeholder="Tavily API Key"
							value={apiKey}
							onChange={(e) => setApiKey(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter" && hasChanges) {
									void handleSave();
								}
							}}
							disabled={isSaving}
						/>
						<button
							type="button"
							onClick={() => void handleSave()}
							disabled={isSaving || !hasChanges}
							className={cn(
								"flex items-center justify-center rounded-md border px-3 py-2 text-sm font-medium transition-colors shrink-0",
								"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
								hasChanges && !isSaving
									? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
									: "border-input bg-background text-muted-foreground cursor-not-allowed opacity-50",
							)}
							aria-label={t("save") || "Save"}
							title={
								hasChanges
									? t("save") || "Save"
									: t("tavilySaveSuccess") || "Saved"
							}
						>
							{isSaving ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<Check className="h-4 w-4" />
							)}
						</button>
					</div>
					<p className="mt-1 text-xs text-muted-foreground">
						{t("tavilyApiKeyHint")}{" "}
						<a
							href="https://app.tavily.com/"
							target="_blank"
							rel="noopener noreferrer"
							className="text-primary hover:underline"
						>
							{t("tavilyApiKeyLink")}
						</a>
					</p>
				</div>
			</div>
		</SettingsSection>
	);
}
