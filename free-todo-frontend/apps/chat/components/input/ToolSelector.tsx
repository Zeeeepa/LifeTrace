"use client";

import { Check, Wrench } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useUiStore } from "@/lib/store/ui-store";
import { cn } from "@/lib/utils";

/**
 * Agno 工具列表定义
 * 基于 FreeTodoToolkit 的 14 个工具
 */
const AGNO_TOOLS = [
	// Todo 管理工具（6个）
	{ id: "create_todo", category: "todo" },
	{ id: "complete_todo", category: "todo" },
	{ id: "update_todo", category: "todo" },
	{ id: "list_todos", category: "todo" },
	{ id: "search_todos", category: "todo" },
	{ id: "delete_todo", category: "todo" },
	// 任务拆解工具（1个）
	{ id: "breakdown_task", category: "breakdown" },
	// 时间解析工具（1个）
	{ id: "parse_time", category: "time" },
	// 冲突检测工具（1个）
	{ id: "check_schedule_conflict", category: "conflict" },
	// 统计分析工具（2个）
	{ id: "get_todo_stats", category: "stats" },
	{ id: "get_overdue_todos", category: "stats" },
	// 标签管理工具（3个）
	{ id: "list_tags", category: "tags" },
	{ id: "get_todos_by_tag", category: "tags" },
	{ id: "suggest_tags", category: "tags" },
] as const;

interface ToolSelectorProps {
	/** 是否禁用 */
	disabled?: boolean;
}

/**
 * Agno 模式工具选择器组件
 * 显示为一个按钮，点击后展开多选下拉框
 */
export function ToolSelector({ disabled = false }: ToolSelectorProps) {
	const tChat = useTranslations("chat");
	const tToolCall = useTranslations("chat.toolCall");
	const [isOpen, setIsOpen] = useState(false);
	const dropdownRef = useRef<HTMLDivElement>(null);

	const selectedAgnoTools = useUiStore((state) => state.selectedAgnoTools);
	const setSelectedAgnoTools = useUiStore(
		(state) => state.setSelectedAgnoTools,
	);

	// 点击外部关闭下拉框
	useEffect(() => {
		if (!isOpen) return;

		const handleClickOutside = (event: MouseEvent) => {
			if (
				dropdownRef.current &&
				!dropdownRef.current.contains(event.target as Node)
			) {
				setIsOpen(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [isOpen]);

	const handleToggleTool = (toolId: string) => {
		const newTools = selectedAgnoTools.includes(toolId)
			? selectedAgnoTools.filter((id) => id !== toolId)
			: [...selectedAgnoTools, toolId];
		console.log("[ToolSelector] Toggling tool:", toolId);
		console.log("[ToolSelector] New selectedAgnoTools:", newTools);
		setSelectedAgnoTools(newTools);
	};

	const handleSelectAll = () => {
		setSelectedAgnoTools(AGNO_TOOLS.map((tool) => tool.id));
	};

	const handleDeselectAll = () => {
		setSelectedAgnoTools([]);
	};

	// 所有工具都被选中时视为全选
	const isAllSelected = selectedAgnoTools.length === AGNO_TOOLS.length;
	const selectedCount = selectedAgnoTools.length;

	return (
		<div className="relative" ref={dropdownRef}>
			{/* 工具选择按钮 */}
			<button
				type="button"
				disabled={disabled}
				onClick={() => setIsOpen(!isOpen)}
				className={cn(
					"flex h-8 items-center gap-2 rounded px-3 text-xs",
					"border border-border bg-background text-foreground",
					"hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
					"disabled:pointer-events-none disabled:opacity-50",
				)}
				aria-label={tChat("toolSelector.label")}
			>
				<Wrench className="h-3.5 w-3.5" />
				<span>{tChat("toolSelector.label")}</span>
				{!isAllSelected && (
					<span className="text-muted-foreground">({selectedCount})</span>
				)}
			</button>

			{/* 下拉多选框 */}
			{isOpen && (
				<div className="absolute left-0 bottom-full z-50 mb-2 w-72 rounded-md border border-border bg-background shadow-lg">
					{/* 标题栏 */}
					<div className="flex items-center justify-between border-b border-border px-3 py-2">
						<span className="text-sm font-medium">
							{tChat("toolSelector.title")}
						</span>
						<div className="flex gap-2">
							<button
								type="button"
								onClick={handleSelectAll}
								className="text-xs text-primary hover:underline"
							>
								{tChat("toolSelector.selectAll")}
							</button>
							<span className="text-xs text-muted-foreground">|</span>
							<button
								type="button"
								onClick={handleDeselectAll}
								className="text-xs text-primary hover:underline"
							>
								{tChat("toolSelector.deselectAll")}
							</button>
						</div>
					</div>

					{/* 工具列表 */}
					<div className="max-h-96 overflow-y-auto p-2">
						{Object.entries(
							AGNO_TOOLS.reduce(
								(acc, tool) => {
									if (!acc[tool.category]) {
										acc[tool.category] = [];
									}
									acc[tool.category].push(tool);
									return acc;
								},
								{} as Record<
									string,
									Array<(typeof AGNO_TOOLS)[number]>
								>,
							),
						).map(([category, tools]) => (
							<div key={category} className="mb-3 last:mb-0">
								{/* 分类标题 */}
								<div className="mb-1.5 px-2 text-xs font-medium text-muted-foreground">
									{tChat(`toolSelector.categories.${category}`)}
								</div>
								{/* 工具选项 */}
								<div className="space-y-0.5">
									{tools.map((tool) => {
										const isSelected = selectedAgnoTools.includes(tool.id);
										return (
											<button
												key={tool.id}
												type="button"
												onClick={() => handleToggleTool(tool.id)}
												className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
											>
												<div
													className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
														isSelected
															? "border-primary bg-primary text-primary-foreground"
															: "border-input"
													}`}
												>
													{isSelected && <Check className="h-3 w-3" />}
												</div>
												<span className="flex-1 text-left">
													{tToolCall(`tools.${tool.id}`)}
												</span>
											</button>
										);
									})}
								</div>
							</div>
						))}
					</div>

					{/* 底部状态栏 */}
					<div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
						{selectedCount === 0
							? tChat("toolSelector.selectedCount", { count: 0 })
							: isAllSelected
								? tChat("toolSelector.allSelected")
								: tChat("toolSelector.selectedCount", { count: selectedCount })}
					</div>
				</div>
			)}
		</div>
	);
}
