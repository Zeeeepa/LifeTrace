"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetcher } from "@/lib/api/fetcher";
import type {
	Journal,
	JournalAutoLinkInput,
	JournalAutoLinkResponse,
	JournalCreateInput,
	JournalGenerateInput,
	JournalGenerateResponse,
	JournalListResponse,
	JournalUpdateInput,
} from "@/lib/types";
import { queryKeys } from "./keys";

interface UseJournalsParams {
	limit?: number;
	offset?: number;
	startDate?: string;
	endDate?: string;
}

const normalizeJournal = (raw: Journal): Journal => ({
	...raw,
	contentObjective: raw.contentObjective ?? null,
	contentAi: raw.contentAi ?? null,
	mood: raw.mood ?? null,
	energy: raw.energy ?? null,
	dayBucketStart: raw.dayBucketStart ?? null,
	tags: raw.tags ?? [],
	relatedTodoIds: raw.relatedTodoIds ?? [],
	relatedActivityIds: raw.relatedActivityIds ?? [],
});

export function useJournals(params?: UseJournalsParams) {
	return useQuery({
		queryKey: queryKeys.journals.list(params),
		queryFn: async () =>
			customFetcher<JournalListResponse>("/api/journals", {
				params: {
					limit: params?.limit ?? 50,
					offset: params?.offset ?? 0,
					start_date: params?.startDate,
					end_date: params?.endDate,
				},
			}),
		staleTime: 30 * 1000,
		select: (data) => {
			if (!data) {
				return { total: 0, journals: [] };
			}
			return {
				...data,
				journals: (data.journals ?? []).map((journal) =>
					normalizeJournal(journal),
				),
			};
		},
	});
}

const createJournal = async (input: JournalCreateInput) =>
	customFetcher<Journal>("/api/journals", {
		method: "POST",
		data: input,
	});

const updateJournal = async (id: number, input: JournalUpdateInput) =>
	customFetcher<Journal>(`/api/journals/${id}`, {
		method: "PUT",
		data: input,
	});

const autoLinkJournal = async (input: JournalAutoLinkInput) =>
	customFetcher<JournalAutoLinkResponse>("/api/journals/auto-link", {
		method: "POST",
		data: input,
	});

const generateObjective = async (input: JournalGenerateInput) =>
	customFetcher<JournalGenerateResponse>("/api/journals/generate-objective", {
		method: "POST",
		data: input,
	});

const generateAiView = async (input: JournalGenerateInput) =>
	customFetcher<JournalGenerateResponse>("/api/journals/generate-ai", {
		method: "POST",
		data: input,
	});

export function useJournalMutations() {
	const queryClient = useQueryClient();

	const createMutation = useMutation({
		mutationFn: createJournal,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.journals.all });
		},
	});

	const updateMutation = useMutation({
		mutationFn: ({ id, input }: { id: number; input: JournalUpdateInput }) =>
			updateJournal(id, input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.journals.all });
		},
	});

	const autoLinkMutation = useMutation({
		mutationFn: autoLinkJournal,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.journals.all });
		},
	});

	const objectiveMutation = useMutation({
		mutationFn: generateObjective,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.journals.all });
		},
	});

	const aiMutation = useMutation({
		mutationFn: generateAiView,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.journals.all });
		},
	});

	return {
		createJournal: createMutation.mutateAsync,
		updateJournal: (id: number, input: JournalUpdateInput) =>
			updateMutation.mutateAsync({ id, input }),
		autoLinkJournal: autoLinkMutation.mutateAsync,
		generateObjective: objectiveMutation.mutateAsync,
		generateAiView: aiMutation.mutateAsync,
		isCreating: createMutation.isPending,
		isUpdating: updateMutation.isPending,
		isAutoLinking: autoLinkMutation.isPending,
		isGeneratingObjective: objectiveMutation.isPending,
		isGeneratingAi: aiMutation.isPending,
		createError: createMutation.error,
		updateError: updateMutation.error,
	};
}
