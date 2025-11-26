"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import {
	AtSign,
	Bot,
	ChevronDown,
	Circle,
	Link2,
	Loader2,
	MessageSquareMore,
	Paperclip,
	Send,
	Sparkles,
	User,
	Wand2
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle
} from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Translation } from "@/lib/i18n";

interface ChatMessage {
	id: string;
	role: "user" | "bot";
	text: string;
	timestamp: string;
}

type ChatPanelCopy = Translation["workspace"]["chatPanel"];

type ComposerMode = "auto" | "manual";

type ChatBotProps = {
	copy: ChatPanelCopy;
	className?: string;
};

const createId = () =>
	typeof crypto !== "undefined" && crypto.randomUUID
		? crypto.randomUUID()
		: Math.random().toString(36).slice(2);

const sourceFilters = ["All sources", "Current editor", "Workspace memory"] as const;

const contextOptions = [
	{ id: "workspace", label: "Workspace summary", hint: "Latest editor focus" },
	{ id: "events", label: "Recent events", hint: "Timeline insights" },
	{ id: "tasks", label: "Open tasks", hint: "Pending todos" }
];

const quickPrompts = [
	{
		title: "Summarize my edits",
		description: "Provide a short recap of the changes I made today"
	},
	{
		title: "Create test checklist",
		description: "List the scenarios I should verify before merging"
	},
	{
		title: "Generate release notes",
		description: "Draft a friendly summary for teammates"
	},
	{
		title: "Plan next actions",
		description: "Suggest what I should tackle after this task"
	}
];

const MessageAvatar = ({ role }: { role: ChatMessage["role"] }) => (
	<div
		className={cn(
			"flex h-9 w-9 flex-none items-center justify-center rounded-full border text-xs font-semibold",
			role === "bot" ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-background text-foreground"
		)}
	>
		{role === "bot" ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
	</div>
);

const ContextPill = ({ label }: { label: string }) => (
	<span className="inline-flex items-center gap-1 rounded-full border border-dashed border-border/80 px-3 py-1 text-xs font-medium text-muted-foreground">
		<AtSign className="h-3.5 w-3.5" />
		{label}
	</span>
);

export function ChatBot({ copy, className }: ChatBotProps) {
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [composerValue, setComposerValue] = useState("");
	const [composerMode, setComposerMode] = useState<ComposerMode>("auto");
	const [sourceFilter, setSourceFilter] = useState<(typeof sourceFilters)[number]>(sourceFilters[0]);
	const [selectedContexts, setSelectedContexts] = useState<string[]>([]);
	const [isThinking, setIsThinking] = useState(false);

	const pendingReplyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
	const scrollAnchorRef = useRef<HTMLDivElement>(null);

  const isSendDisabled = composerValue.trim().length === 0 || isThinking;
  
  const [isChatbotOpen, setIsChatbotOpen] = useState(true);

	useEffect(() => {
		return () => {
			if (pendingReplyTimeout.current) {
				clearTimeout(pendingReplyTimeout.current);
			}
		};
	}, []);

	useEffect(() => {
		scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages, isThinking]);

	const handleContextToggle = (id: string) => {
		setSelectedContexts((prev) =>
			prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
		);
	};

	const handleSuggestionClick = (title: string) => {
		setComposerValue(title);
	};

	const handleSendMessage = () => {
		if (isSendDisabled) {
			return;
		}

		const trimmed = composerValue.trim();
		const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

		const userMessage: ChatMessage = {
			id: createId(),
			role: "user",
			text: trimmed,
			timestamp
		};

		setMessages((prev) => [...prev, userMessage]);
		setComposerValue("");
		setIsThinking(true);

		pendingReplyTimeout.current = setTimeout(() => {
			setMessages((prev) => [
				...prev,
				{
					id: createId(),
					role: "bot",
					text: `${copy.thinking} ${trimmed}`.trim(),
					timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
				}
			]);
			setIsThinking(false);
		}, 800);
	};

	const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault();
			handleSendMessage();
		}
	};

	const formattedPlaceholder = useMemo(
		() => copy.inputPlaceholder || "Ask, search, or make anything...",
		[copy.inputPlaceholder]
	);

  return (
    <div>
      {
        !isChatbotOpen ? <Button onClick={()=> setIsChatbotOpen(true)}>
          Open ChatBot
        </Button>
          : (
    <Card className={cn("flex max-h-full flex-col border-border/70 bg-card/90 shadow-xl", className)}>
			<CardHeader className="gap-4 border-b border-border/70 pb-6">
				<div className="flex items-center justify-between gap-3">
					<div className="flex items-center gap-3">
						<div className="rounded-2xl bg-primary/10 p-2 text-primary">
							<MessageSquareMore className="h-5 w-5" />
						</div>
						<div>
							<CardTitle className="text-lg font-semibold">{copy.title}</CardTitle>
							<CardDescription>{copy.description}</CardDescription>
						</div>
                  </div>
                  <Button onClick={() => setIsChatbotOpen(false)}>
                    Close ChatBot
          </Button>
					<Badge variant="outline" className="rounded-full border-primary/40 bg-primary/5 text-xs text-primary">
						Labs
					</Badge>
				</div>
				<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
					{selectedContexts.length > 0 && (
						<span className="inline-flex items-center gap-2 rounded-full border border-border/70 px-3 py-1">
							<AtSign className="h-3.5 w-3.5" />
							{selectedContexts.length} context{selectedContexts.length > 1 ? "s" : ""} active
						</span>
					)}
				</div>
      </CardHeader>
      

      <CardContent className="flex min-h-[70vh] flex-col gap-5">
        {/* 对话历史部分 */}
        <section className="flex flex-1 flex-col rounded-3xl border border-border/60 bg-card/70">
					<ScrollArea className="flex-1 px-6 py-4 max-h-screen">
						<div className="space-y-5">
							{messages.length === 0 && !isThinking ? (
								<div className="rounded-2xl border border-dashed border-border/70 bg-background/60 p-6 text-center text-sm text-muted-foreground">
									{copy.empty}
								</div>
							) : (
								messages.map((message) => (
									<article key={message.id} className="flex items-start gap-3">
										<MessageAvatar role={message.role} />
										<div className="flex flex-1 flex-col gap-1 rounded-3xl border border-border/50 bg-background/80 p-4 shadow-sm">
											<div className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
												<span className="inline-flex items-center gap-1">
													{message.role === "bot" ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
													{message.role === "bot" ? "Bot" : "You"}
												</span>
												<Separator orientation="vertical" className="h-4" />
												<span>{message.timestamp}</span>
											</div>
											<p className="text-sm leading-relaxed text-foreground">{message.text}</p>
										</div>
									</article>
								))
							)}

							{isThinking && (
								<article className="flex items-start gap-3">
									<MessageAvatar role="bot" />
									<div className="flex flex-1 flex-col gap-2 rounded-3xl border border-dashed border-primary/50 bg-primary/5 p-4 text-sm text-primary">
										<div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
											<Sparkles className="h-3.5 w-3.5" />
											{copy.thinking}
										</div>
										<p className="text-sm text-primary/90">{formattedPlaceholder}</p>
									</div>
								</article>
							)}

							<div ref={scrollAnchorRef} />
						</div>
					</ScrollArea>
				</section>

				<section className="flex flex-col rounded-3xl border border-border/70 bg-background/70">
					<div className="flex items-center justify-between border-b border-border/60 px-6 py-3 text-xs uppercase tracking-wide text-muted-foreground">
						<div className="flex items-center gap-2">
							<Button
								size="sm"
								variant={composerMode === "auto" ? "default" : "ghost"}
								className={cn("rounded-full px-4", composerMode !== "auto" && "bg-transparent text-muted-foreground")}
								onClick={() => setComposerMode("auto")}
							>
								Auto
							</Button>
							<Button
								size="sm"
								variant={composerMode === "manual" ? "default" : "ghost"}
								className={cn("rounded-full px-4", composerMode !== "manual" && "bg-transparent text-muted-foreground")}
								onClick={() => setComposerMode("manual")}
							>
								Manual
							</Button>
						</div>
						<div className="flex items-center gap-3 text-[11px] text-muted-foreground">
							<span className="inline-flex items-center gap-1">
								<Link2 className="h-3.5 w-3.5" />
								{sourceFilter}
							</span>
							<Separator orientation="vertical" className="h-4" />
							<span>Shift+Enter for newline</span>
						</div>
					</div>

					<Textarea
						value={composerValue}
						onChange={(event) => setComposerValue(event.target.value)}
						onKeyDown={handleComposerKeyDown}
						placeholder={formattedPlaceholder}
						className="rounded-none border-0 bg-transparent px-6 py-5 text-base"
					/>

					<div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-6 py-4">
						<div className="flex items-center gap-2">
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant="ghost" size="sm" className="rounded-full border border-dashed">
										<AtSign className="mr-2 h-4 w-4" />
										Contexts
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="start" className="w-64">
									<DropdownMenuLabel>Quick context</DropdownMenuLabel>
									<DropdownMenuSeparator />
									{contextOptions.map((option) => (
										<DropdownMenuItem key={option.id} onClick={() => handleContextToggle(option.id)}>
											{option.label}
										</DropdownMenuItem>
									))}
								</DropdownMenuContent>
							</DropdownMenu>
							<Button variant="ghost" size="icon" className="h-10 w-10 rounded-full border">
								<Paperclip className="h-4 w-4" />
							</Button>
						</div>

						<Button onClick={handleSendMessage} disabled={isSendDisabled} className="rounded-full px-6 shadow-lg">
							{isThinking ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Thinking
								</>
							) : (
								<>
									<Send className="mr-2 h-4 w-4" />
									{copy.send}
								</>
							)}
						</Button>
					</div>
				</section>
			</CardContent>
		</Card>
        )
      }
    </div>

	);
}

