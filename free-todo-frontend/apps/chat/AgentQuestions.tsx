/**
 * AgentQuestions - Agent 澄清问题组件
 *
 * 显示 AI 生成的多选题，让用户回答以澄清任务概念
 */

import { HelpCircle, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback } from "react";
import type { AgentQuestion } from "@/apps/chat/types";
import { cn } from "@/lib/utils";

interface AgentQuestionsProps {
	questions: AgentQuestion[];
	answers: Record<string, string[]>;
	onAnswerChange: (questionId: string, answers: string[]) => void;
	onSubmit: () => void;
	isSubmitting?: boolean;
}

export function AgentQuestions({
	questions,
	answers,
	onAnswerChange,
	onSubmit,
	isSubmitting = false,
}: AgentQuestionsProps) {
	const t = useTranslations("chat.agent");

	const handleOptionToggle = useCallback(
		(questionId: string, option: string) => {
			const currentAnswers = answers[questionId] || [];
			const newAnswers = currentAnswers.includes(option)
				? currentAnswers.filter((a) => a !== option)
				: [...currentAnswers, option];
			onAnswerChange(questionId, newAnswers);
		},
		[answers, onAnswerChange],
	);

	// 检查是否至少有一个问题有答案
	const hasAnyAnswer = Object.values(answers).some(
		(arr) => arr && arr.length > 0,
	);

	return (
		<div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 space-y-4">
			{/* 标题 */}
			<div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
				<HelpCircle className="h-4 w-4" />
				<span className="font-medium">{t("questionsTitle")}</span>
			</div>

			<p className="text-sm text-muted-foreground">{t("questionsDesc")}</p>

			{/* 问题列表 */}
			<div className="space-y-4">
				{questions.map((question, qIndex) => (
					<div key={question.id} className="space-y-2">
						<div className="flex items-start gap-2">
							<span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-xs font-medium text-amber-600 dark:text-amber-400">
								{qIndex + 1}
							</span>
							<span className="text-sm font-medium">{question.question}</span>
						</div>

						{/* 选项 */}
						<div className="ml-7 space-y-1.5">
							{question.options.map((option, oIndex) => {
								const isSelected = (answers[question.id] || []).includes(
									option,
								);
								return (
									<button
										key={`${question.id}-option-${oIndex}`}
										type="button"
										onClick={() => handleOptionToggle(question.id, option)}
										className={cn(
											"w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
											"border",
											isSelected
												? "border-primary bg-primary/10 text-primary"
												: "border-border bg-background hover:bg-muted/50",
										)}
									>
										{option}
									</button>
								);
							})}

							{/* 跳过选项 */}
							<button
								type="button"
								onClick={() => onAnswerChange(question.id, ["skip"])}
								className={cn(
									"w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
									"border border-dashed",
									(answers[question.id] || []).includes("skip")
										? "border-muted-foreground/50 bg-muted/30 text-muted-foreground"
										: "border-border text-muted-foreground hover:bg-muted/30",
								)}
							>
								{t("skipQuestion")}
							</button>
						</div>
					</div>
				))}
			</div>

			{/* 提交按钮 */}
			<div className="flex justify-end pt-2">
				<button
					type="button"
					onClick={onSubmit}
					disabled={isSubmitting || !hasAnyAnswer}
					className={cn(
						"flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors",
						isSubmitting || !hasAnyAnswer
							? "cursor-not-allowed opacity-50"
							: "hover:bg-primary/90",
					)}
				>
					<Send className="h-3 w-3" />
					{isSubmitting ? t("submitting") : t("submitAnswers")}
				</button>
			</div>
		</div>
	);
}

