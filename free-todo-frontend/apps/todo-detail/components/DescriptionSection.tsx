"use client";

import { Check, Paperclip, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { TodoAttachment } from "@/lib/types/todo";

interface DescriptionSectionProps {
	description?: string;
	attachments?: TodoAttachment[];
	onDescriptionChange?: (description: string) => void;
}

export function DescriptionSection({
	description,
	attachments,
	onDescriptionChange,
}: DescriptionSectionProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [editValue, setEditValue] = useState(description || "");
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const hasAttachments = attachments && attachments.length > 0;

	// 自动调整 textarea 高度
	const adjustTextareaHeight = useCallback(() => {
		const textarea = textareaRef.current;
		if (textarea) {
			textarea.style.height = "auto";
			textarea.style.height = `${textarea.scrollHeight}px`;
		}
	}, []);

	// 进入编辑模式时，聚焦并调整高度
	useEffect(() => {
		if (isEditing && textareaRef.current) {
			textareaRef.current.focus();
			adjustTextareaHeight();
		}
	}, [isEditing, adjustTextareaHeight]);

	// 开始编辑
	const handleStartEdit = () => {
		setEditValue(description || "");
		setIsEditing(true);
	};

	// 保存编辑
	const handleSave = () => {
		if (onDescriptionChange) {
			onDescriptionChange(editValue.trim());
		}
		setIsEditing(false);
	};

	// 取消编辑
	const handleCancel = () => {
		setEditValue(description || "");
		setIsEditing(false);
	};

	// 处理键盘事件
	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Escape") {
			handleCancel();
		} else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			handleSave();
		}
	};

	return (
		<div className="mb-8">
			<h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
				Description
			</h2>

			{isEditing ? (
				<div className="relative">
					<textarea
						ref={textareaRef}
						value={editValue}
						onChange={(e) => {
							setEditValue(e.target.value);
							adjustTextareaHeight();
						}}
						onKeyDown={handleKeyDown}
						placeholder="输入描述..."
						className="w-full min-h-[80px] resize-none rounded-md border border-primary bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
					/>
					<div className="mt-2 flex justify-end gap-2">
						<button
							type="button"
							onClick={handleCancel}
							className="flex items-center gap-1 rounded px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
						>
							<X className="h-3.5 w-3.5" />
							取消
						</button>
						<button
							type="button"
							onClick={handleSave}
							className="flex items-center gap-1 rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90 transition-colors"
						>
							<Check className="h-3.5 w-3.5" />
							保存
						</button>
					</div>
				</div>
			) : (
				<button
					type="button"
					onClick={handleStartEdit}
					className="w-full text-left group cursor-pointer rounded-md border border-border bg-muted/20 px-3 py-2 text-sm text-foreground hover:border-primary/50 hover:bg-muted/40 transition-colors"
				>
					{description || (
						<span className="text-muted-foreground">暂无描述（点击添加）</span>
					)}
				</button>
			)}

			{hasAttachments && (
				<div className="mt-6">
					<h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						Attachments
					</h3>
					<div className="space-y-2">
						{attachments?.map((file) => (
							<div
								key={file.id}
								className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm"
							>
								<Paperclip className="h-4 w-4 text-muted-foreground" />
								<div className="flex-1 truncate">
									<div className="font-medium text-foreground">
										{file.fileName}
									</div>
									<div className="text-xs text-muted-foreground">
										{file.mimeType || "unknown"}
									</div>
								</div>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
