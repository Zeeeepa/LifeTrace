import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo } from "react";
import { usePlanService } from "@/apps/chat/hooks/usePlanService";
import { useTodos } from "@/lib/query";
import { usePlanStore } from "@/lib/store/plan-store";
import type { Todo } from "@/lib/types";

export const usePlanQuestionnaire = () => {
	const tChat = useTranslations("chat");

	// 从 TanStack Query 获取 todos 数据（用于 Plan 功能）
	const { data: todos = [] } = useTodos();

	// Plan功能相关状态
	const {
		activePlanTodoId,
		stage,
		questions,
		answers,
		summary,
		subtasks,
		isLoading: planLoading,
		isGeneratingSummary,
		summaryStreamingText,
		isGeneratingQuestions,
		questionStreamingCount,
		questionStreamingTitle,
		error: planError,
		setQuestions,
		setAnswer,
		setSummary,
		setSummaryStreaming,
		setIsGeneratingSummary,
		setQuestionStreaming,
		setIsGeneratingQuestions,
		applyPlan,
	} = usePlanStore();

	const { generateQuestions, generateSummary } = usePlanService();

	// 获取当前正在规划的待办
	const activePlanTodo = useMemo(() => {
		if (!activePlanTodoId) return null;
		return todos.find((todo: Todo) => todo.id === activePlanTodoId) || null;
	}, [activePlanTodoId, todos]);

	// 当进入questionnaire阶段时，生成选择题
	useEffect(() => {
		if (
			stage === "questionnaire" &&
			activePlanTodo &&
			questions.length === 0 &&
			planLoading
		) {
			let cancelled = false;
			const generate = async () => {
				try {
					console.log(
						"开始生成选择题，任务名称:",
						activePlanTodo.name,
						"任务ID:",
						activePlanTodo.id,
					);
					setIsGeneratingQuestions(true);
					const generatedQuestions = await generateQuestions(
						activePlanTodo.name,
						activePlanTodo.id,
						(count, title) => {
							// 流式更新问题生成进度
							if (!cancelled) {
								setQuestionStreaming(count, title);
							}
						},
					);
					if (!cancelled) {
						console.log("生成的选择题:", generatedQuestions);
						setQuestions(generatedQuestions);
						setIsGeneratingQuestions(false);
					}
				} catch (error) {
					if (!cancelled) {
						console.error("Failed to generate questions:", error);
						// 错误处理：设置错误状态
						usePlanStore.setState({
							error:
								error instanceof Error
									? error.message
									: tChat("generateQuestionsFailed"),
							isLoading: false,
							isGeneratingQuestions: false,
						});
					}
				}
			};
			void generate();
			return () => {
				cancelled = true;
			};
		}
	}, [
		stage,
		activePlanTodo,
		questions.length,
		planLoading,
		generateQuestions,
		setQuestions,
		setQuestionStreaming,
		setIsGeneratingQuestions,
		tChat,
	]);

	// 处理提交回答
	const handleSubmitAnswers = useCallback(async () => {
		if (!activePlanTodo) return;

		try {
			// 设置生成状态
			setIsGeneratingSummary(true);
			setSummaryStreaming("");

			// 流式生成总结
			const result = await generateSummary(
				activePlanTodo.name,
				answers,
				(streamingText) => {
					// 实时更新流式文本
					setSummaryStreaming(streamingText);
				},
			);

			// 生成完成，设置最终结果
			setSummary(result.summary, result.subtasks);
		} catch (error) {
			console.error("Failed to generate summary:", error);
			setIsGeneratingSummary(false);
			setSummaryStreaming(null);
			// 设置错误状态
			usePlanStore.setState({
				error:
					error instanceof Error
						? error.message
						: tChat("generateSummaryFailed"),
			});
		}
	}, [
		activePlanTodo,
		answers,
		generateSummary,
		setSummary,
		setIsGeneratingSummary,
		setSummaryStreaming,
		tChat,
	]);

	// 处理接收计划
	const handleAcceptPlan = useCallback(async () => {
		await applyPlan();
	}, [applyPlan]);

	return {
		activePlanTodo,
		stage,
		questions,
		answers,
		summary,
		subtasks,
		planLoading,
		isGeneratingSummary,
		summaryStreamingText,
		isGeneratingQuestions,
		questionStreamingCount,
		questionStreamingTitle,
		planError,
		setAnswer,
		handleSubmitAnswers,
		handleAcceptPlan,
	};
};
