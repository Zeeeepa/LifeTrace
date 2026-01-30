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
