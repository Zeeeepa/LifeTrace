import type { ZodSchema } from "zod";

// 标准化时间字符串（处理无时区后缀问题）
function normalizeTimestamps(obj: unknown): unknown {
	if (obj === null || obj === undefined) return obj;
	if (typeof obj === "string") {
		// ISO 时间格式但无时区，假设为 UTC
		if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(obj)) {
			return `${obj}Z`;
		}
		return obj;
	}
	if (Array.isArray(obj)) {
		return obj.map(normalizeTimestamps);
	}
	if (typeof obj === "object") {
		return Object.fromEntries(
			Object.entries(obj).map(([k, v]) => [k, normalizeTimestamps(v)]),
		);
	}
	return obj;
}

export async function customFetcher<T>({
	url,
	method,
	params,
	data,
	headers,
	signal,
	responseSchema,
}: {
	url: string;
	method: string;
	params?: Record<string, unknown>;
	data?: unknown;
	headers?: Record<string, string>;
	signal?: AbortSignal;
	responseSchema?: ZodSchema<T>;
}): Promise<T> {
	const baseUrl = typeof window !== "undefined" ? "" : "http://localhost:8000";

	const queryString = params
		? "?" + new URLSearchParams(params as Record<string, string>).toString()
		: "";

	const response = await fetch(`${baseUrl}${url}${queryString}`, {
		method,
		headers: { "Content-Type": "application/json", ...headers },
		body: data ? JSON.stringify(data) : undefined,
		signal,
	});

	if (!response.ok) {
		throw new Error(`API Error: ${response.status}`);
	}

	let json = await response.json();

	// 标准化时间字符串
	json = normalizeTimestamps(json);

	// 如果提供了 schema，进行验证
	if (responseSchema) {
		const result = responseSchema.safeParse(json);
		if (!result.success) {
			console.error("[API] Schema validation failed:", result.error.format());
			if (process.env.NODE_ENV === "development") {
				throw new Error("Schema validation failed");
			}
		}
		return result.success ? result.data : json;
	}

	return json;
}
