/**
 * Unified frontend types (camelCase)
 * These types match the auto-transformed API response structure from customFetcher.
 * The fetcher automatically converts snake_case (API) -> camelCase (frontend).
 */

// ============================================================================
// Todo Types
// ============================================================================

export type TodoStatus = "active" | "completed" | "canceled" | "draft";
export type TodoPriority = "high" | "medium" | "low" | "none";

export interface TodoAttachment {
	id: number;
	fileName: string;
	filePath: string;
	fileSize?: number;
	mimeType?: string;
	source?: "user" | "ai";
}

export interface Todo {
	id: number;
	name: string;
	description?: string;
	userNotes?: string;
	parentTodoId?: number | null;
	deadline?: string;
	startTime?: string;
	endTime?: string;
	status: TodoStatus;
	priority: TodoPriority;
	order?: number;
	tags?: string[];
	attachments?: TodoAttachment[];
	relatedActivities?: number[];
	createdAt: string;
	updatedAt: string;
}

export interface CreateTodoInput {
	name: string;
	description?: string;
	userNotes?: string;
	parentTodoId?: number | null;
	deadline?: string;
	startTime?: string;
	endTime?: string;
	status?: TodoStatus;
	priority?: TodoPriority;
	order?: number;
	tags?: string[];
	relatedActivities?: number[];
}

export interface UpdateTodoInput {
	name?: string;
	description?: string;
	userNotes?: string;
	status?: TodoStatus;
	priority?: TodoPriority;
	deadline?: string;
	startTime?: string;
	endTime?: string;
	order?: number;
	tags?: string[];
	parentTodoId?: number | null;
	relatedActivities?: number[];
}

// ============================================================================
// Screenshot & Event Types
// ============================================================================

export interface Screenshot {
	id: number;
	filePath: string;
	appName: string;
	windowTitle: string;
	createdAt: string;
	textContent?: string;
	width: number;
	height: number;
	ocrResult?: {
		textContent: string;
	};
}

export interface Event {
	id: number;
	appName: string;
	windowTitle: string;
	startTime: string;
	endTime?: string;
	screenshotCount: number;
	firstScreenshotId?: number;
	screenshots?: Screenshot[];
	aiTitle?: string;
	aiSummary?: string;
}

// ============================================================================
// Activity Types
// ============================================================================

export interface Activity {
	id: number;
	startTime: string;
	endTime: string;
	aiTitle?: string;
	aiSummary?: string;
	eventCount: number;
	createdAt?: string;
	updatedAt?: string;
}

export interface ActivityWithEvents extends Activity {
	eventIds?: number[];
	events?: Event[];
}

// ============================================================================
// Journal Types
// ============================================================================

export interface JournalTag {
	id: number;
	tagName: string;
}

export interface Journal {
	id: number;
	name: string;
	userNotes: string;
	date: string;
	contentFormat: string;
	contentObjective?: string | null;
	contentAi?: string | null;
	mood?: string | null;
	energy?: number | null;
	dayBucketStart?: string | null;
	tags?: JournalTag[];
	relatedTodoIds?: number[];
	relatedActivityIds?: number[];
	createdAt: string;
	updatedAt: string;
}

export interface JournalListResponse {
	total: number;
	journals: Journal[];
}

export interface JournalCreateInput {
	name?: string | null;
	userNotes: string;
	date: string;
	contentFormat?: string;
	contentObjective?: string | null;
	contentAi?: string | null;
	mood?: string | null;
	energy?: number | null;
	dayBucketStart?: string | null;
	tags?: string[];
	relatedTodoIds?: number[];
	relatedActivityIds?: number[];
}

export interface JournalUpdateInput {
	name?: string | null;
	userNotes?: string | null;
	date?: string | null;
	contentFormat?: string | null;
	contentObjective?: string | null;
	contentAi?: string | null;
	mood?: string | null;
	energy?: number | null;
	dayBucketStart?: string | null;
	tags?: string[] | null;
	relatedTodoIds?: number[] | null;
	relatedActivityIds?: number[] | null;
}

export interface JournalAutoLinkInput {
	journalId?: number | null;
	title?: string | null;
	contentOriginal?: string | null;
	date: string;
	dayBucketStart?: string | null;
	maxItems?: number;
}

export interface JournalAutoLinkCandidate {
	id: number;
	name: string;
	score: number;
}

export interface JournalAutoLinkResponse {
	relatedTodoIds: number[];
	relatedActivityIds: number[];
	todoCandidates: JournalAutoLinkCandidate[];
	activityCandidates: JournalAutoLinkCandidate[];
}

export interface JournalGenerateInput {
	journalId?: number | null;
	title?: string | null;
	contentOriginal?: string | null;
	date?: string | null;
	dayBucketStart?: string | null;
	language: string;
}

export interface JournalGenerateResponse {
	content: string;
}

// ============================================================================
// Utility Types for API List Responses (auto-transformed)
// ============================================================================

export interface TodoListResponse {
	total: number;
	todos: Todo[];
}

export interface ActivityListResponse {
	total: number;
	activities: Activity[];
}

export interface EventListResponse {
	total: number;
	events: Event[];
}

export interface ActivityEventsResponse {
	eventIds: number[];
}
