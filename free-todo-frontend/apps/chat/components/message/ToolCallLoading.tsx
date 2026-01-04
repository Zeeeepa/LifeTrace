"use client";

import { cn } from "@/lib/utils";

type ToolCallLoadingProps = {
	toolName: string;
	className?: string;
};

export function ToolCallLoading({ toolName, className }: ToolCallLoadingProps) {
	// 工具名称映射（可选，用于显示更友好的名称）
	const toolNameMap: Record<string, string> = {
		web_search: "联网搜索",
	};

	const displayName = toolNameMap[toolName] || toolName;

	return (
		<div className={cn("flex items-center gap-2 text-sm", className)}>
			<span className="shimmer-text font-medium">
				正在使用 {displayName}...
			</span>
		</div>
	);
}
