import { Loader2, Send } from "lucide-react";
import type React from "react";
import { cn } from "@/lib/utils";

type InputBoxProps = {
	inputValue: string;
	placeholder: string;
	isStreaming: boolean;
	locale: string;
	onChange: (value: string) => void;
	onSend: () => void;
	onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
	onCompositionStart: () => void;
	onCompositionEnd: () => void;
};

export function InputBox({
	inputValue,
	placeholder,
	isStreaming,
	locale,
	onChange,
	onSend,
	onKeyDown,
	onCompositionStart,
	onCompositionEnd,
}: InputBoxProps) {
	return (
		<div className="flex flex-1 items-end gap-2">
			<textarea
				value={inputValue}
				onChange={(e) => onChange(e.target.value)}
				onCompositionStart={onCompositionStart}
				onCompositionEnd={onCompositionEnd}
				onKeyDown={onKeyDown}
				placeholder={placeholder}
				rows={2}
				className={cn(
					"flex-1 resize-none rounded-2xl border border-border bg-muted/60 px-4 py-3",
					"text-foreground placeholder:text-muted-foreground",
					"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
				)}
			/>
			<button
				type="button"
				onClick={onSend}
				disabled={!inputValue.trim() || isStreaming}
				className={cn(
					"flex h-11 w-11 items-center justify-center rounded-[var(--radius-panel)]",
					"bg-blue-500 text-white transition-colors",
					"hover:bg-blue-600",
					"disabled:cursor-not-allowed disabled:opacity-50",
					"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
				)}
				aria-label={locale === "zh" ? "发送" : "Send"}
			>
				{isStreaming ? (
					<Loader2 className="h-5 w-5 animate-spin" />
				) : (
					<Send className="h-5 w-5" />
				)}
			</button>
		</div>
	);
}
