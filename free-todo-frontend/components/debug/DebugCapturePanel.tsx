"use client";

import { Camera } from "lucide-react";

export function DebugCapturePanel() {
	return (
		<div className="flex h-full flex-col">
			<div className="flex h-10 shrink-0 items-center gap-2 bg-orange-50 px-4 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300">
				<Camera className="h-4 w-4" />
				<h2 className="text-sm font-medium">截图管理（开发调试）</h2>
			</div>
			<div className="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
				<p>这里预留给截图采集 / 管理工具（仅开发模式可见）。</p>
				<p className="text-xs text-orange-500">本面板不会包含在生产构建中。</p>
			</div>
		</div>
	);
}
