/**
 * 可复用的应用 Header 组件
 * 左侧：Logo + 应用名称
 * 中间：通知区域（可选）
 * 右侧：工具按钮（LayoutSelector, ThemeToggle, LanguageToggle, SettingsToggle）
 */

"use client";

import Image from "next/image";
import { LayoutSelector } from "@/components/common/layout/LayoutSelector";
import { ThemeToggle } from "@/components/common/theme/ThemeToggle";
import { LanguageToggle } from "@/components/common/ui/LanguageToggle";
import { SettingsToggle } from "@/components/common/ui/SettingsToggle";
import { HeaderIsland } from "@/components/notification/HeaderIsland";

interface AppHeaderProps {
	/** 当前通知（可选） */
	currentNotification?: { id: string; title: string; content: string; timestamp: string; source?: string } | null;
	/** 是否是 Electron 环境 */
	isElectron?: boolean;
}

export function AppHeader({
	currentNotification = null,
	isElectron = false,
}: AppHeaderProps) {
	const showNotification = currentNotification && isElectron;

	return (
		<header className="relative flex h-15 shrink-0 items-center bg-primary-foreground dark:bg-accent px-4 text-foreground overflow-visible">
			{/* 左侧：Logo + 应用名称（复用 MaximizeHeader 的样式） */}
			<div className="flex items-center gap-2 shrink-0">
				<div className="relative h-8 w-8 shrink-0">
					{/* 浅色模式图标 */}
					<Image
						src="/free-todo-logos/free_todo_icon_4_dark_with_grid.png"
						alt="Free Todo Logo"
						width={32}
						height={32}
						className="object-contain block dark:hidden"
					/>
					{/* 深色模式图标 */}
					<Image
						src="/free-todo-logos/free_todo_icon_4_with_grid.png"
						alt="Free Todo Logo"
						width={32}
						height={32}
						className="object-contain hidden dark:block"
					/>
				</div>
				<h1 className="text-lg font-semibold tracking-tight text-foreground hidden md:block">
					Free Todo: Your AI Secretary
				</h1>
			</div>

			{/* 中间：通知区域 */}
			{showNotification ? (
				<div className="flex-1 flex items-center justify-center relative min-w-0 overflow-visible">
					<HeaderIsland />
				</div>
			) : (
				<div className="flex-1" />
			)}

			{/* 右侧：工具按钮 */}
			<div className="flex items-center gap-2 min-w-0 shrink-0">
				<LayoutSelector />
				<ThemeToggle />
				<LanguageToggle />
				<SettingsToggle />
			</div>
		</header>
	);
}
