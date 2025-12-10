"use client";

import { Plus } from "lucide-react";
import type React from "react";

interface NewTodoInlineFormProps {
	value: string;
	onChange: (value: string) => void;
	onSubmit: (e?: React.FormEvent) => void;
	onCancel: () => void;
}

export function NewTodoInlineForm({
	value,
	onChange,
	onSubmit,
	onCancel,
}: NewTodoInlineFormProps) {
	return (
		<form
			onSubmit={onSubmit}
			className="flex flex-col gap-2 rounded-lg border border-dashed border-primary/50 bg-primary/5 p-4 sm:flex-row sm:items-center sm:gap-3"
		>
			<input
				type="text"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder="输入待办名称..."
				className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
				required
			/>
			<div className="flex items-center gap-2 sm:justify-end">
				<button
					type="button"
					onClick={onCancel}
					className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
				>
					取消
				</button>
				<button
					type="submit"
					className="inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
				>
					<Plus className="h-4 w-4" />
					创建
				</button>
			</div>
		</form>
	);
}
