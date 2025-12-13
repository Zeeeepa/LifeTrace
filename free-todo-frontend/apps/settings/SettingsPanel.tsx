"use client";

import { Settings } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { LanguageToggle } from "@/components/common/LanguageToggle";
import { PanelHeader } from "@/components/common/PanelHeader";
import { ThemeStyleSelect } from "@/components/common/ThemeStyleSelect";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { useTranslations } from "@/lib/i18n";
import { useColorThemeStore } from "@/lib/store/color-theme";
import { useLocaleStore } from "@/lib/store/locale";

/**
 * 设置面板组件
 * 用于展示和管理应用设置，包括主题、语言、配色等
 */
export function SettingsPanel() {
	const { locale } = useLocaleStore();
	const { colorTheme } = useColorThemeStore();
	const { theme } = useTheme();
	const t = useTranslations(locale);
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	// 获取当前主题标签
	const getCurrentThemeLabel = () => {
		if (!mounted) return t.theme.system;
		const themes = [
			{ value: "light" as const, label: t.theme.light },
			{ value: "dark" as const, label: t.theme.dark },
			{ value: "system" as const, label: t.theme.system },
		];
		const validThemes = themes.map((t) => t.value);
		const currentTheme =
			theme && validThemes.includes(theme as (typeof validThemes)[number])
				? (theme as (typeof validThemes)[number])
				: "system";
		return (
			themes.find((t) => t.value === currentTheme)?.label || t.theme.system
		);
	};

	// 获取当前语言标签
	const getCurrentLanguageLabel = () => {
		return locale === "zh" ? t.language.zh : t.language.en;
	};

	// 获取当前配色风格标签
	const getCurrentColorThemeLabel = () => {
		return colorTheme === "blue" ? t.colorTheme.blue : t.colorTheme.neutral;
	};

	return (
		<div className="relative flex h-full flex-col overflow-hidden bg-background">
			{/* 顶部标题栏 */}
			<PanelHeader icon={Settings} title={t.page.settingsLabel} />

			{/* 设置内容区域 */}
			<div className="flex-1 overflow-y-auto px-4 py-6">
				<div className="mx-auto max-w-2xl space-y-4">
					{/* 用户设置标题 */}
					<div className="mb-2">
						<h3 className="text-lg font-semibold text-foreground">
							{t.layout.userSettings}
						</h3>
					</div>

					{/* 主题设置 */}
					<div className="rounded-lg border border-border bg-card p-4 shadow-sm">
						<div className="mb-3">
							<div className="text-sm font-medium text-foreground">
								{t.layout.currentTheme}
							</div>
							<p className="mt-1 text-xs text-muted-foreground">
								{mounted ? getCurrentThemeLabel() : t.theme.system}
							</p>
						</div>
						<div className="flex items-center gap-3">
							<ThemeToggle />
							<span className="text-sm text-muted-foreground">
								{locale === "zh"
									? "点击切换主题（浅色/深色/系统）"
									: "Click to toggle theme (Light/Dark/System)"}
							</span>
						</div>
					</div>

					{/* 语言设置 */}
					<div className="rounded-lg border border-border bg-card p-4 shadow-sm">
						<div className="mb-3">
							<div className="text-sm font-medium text-foreground">
								{t.layout.currentLanguage}
							</div>
							<p className="mt-1 text-xs text-muted-foreground">
								{getCurrentLanguageLabel()}
							</p>
						</div>
						<div className="flex items-center gap-3">
							<LanguageToggle />
							<span className="text-sm text-muted-foreground">
								{locale === "zh"
									? "点击切换语言（中文/英文）"
									: "Click to toggle language (Chinese/English)"}
							</span>
						</div>
					</div>

					{/* 配色风格设置 */}
					<div className="rounded-lg border border-border bg-card p-4 shadow-sm">
						<div className="mb-3">
							<div className="text-sm font-medium text-foreground">
								{t.colorTheme.label}
							</div>
							<p className="mt-1 text-xs text-muted-foreground">
								{getCurrentColorThemeLabel()}
							</p>
						</div>
						<div className="flex items-center gap-3">
							<ThemeStyleSelect />
							<span className="text-sm text-muted-foreground">
								{locale === "zh"
									? "选择应用的配色风格"
									: "Choose application color theme"}
							</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
