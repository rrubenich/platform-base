import { getLocale } from "@workspace/i18n/runtime";

const API_URL = import.meta.env.VITE_API_URL ?? "/api";

export async function apiGet(path: string): Promise<string> {
	const response = await fetch(`${API_URL}${path}`, {
		headers: { "Accept-Language": getLocale() },
	});
	if (!response.ok) {
		throw new Error(`API request failed: ${response.status}`);
	}
	return response.text();
}

/** A failed API call, carrying the response status and Nest's message. */
export class ApiError extends Error {
	readonly status: number;

	constructor(status: number, message: string) {
		super(message);
		this.name = "ApiError";
		this.status = status;
	}
}

/**
 * A JSON API call with the session cookie, for authenticated routes.
 * Requests stay same-origin (Vite's proxy in dev, server/index.ts when
 * deployed); `credentials: "include"` only matters if VITE_API_URL is ever
 * pointed at another origin.
 */
export async function apiJson<T>(
	path: string,
	{ method = "GET", body }: { method?: string; body?: unknown } = {},
): Promise<T> {
	const response = await fetch(`${API_URL}${path}`, {
		method,
		credentials: "include",
		headers: {
			"Accept-Language": getLocale(),
			...(body === undefined ? {} : { "Content-Type": "application/json" }),
		},
		body: body === undefined ? undefined : JSON.stringify(body),
	});

	if (!response.ok) {
		// Nest errors are { message: string | string[] }; validation errors
		// list every failed constraint.
		const data = (await response.json().catch(() => null)) as {
			message?: string | string[];
		} | null;
		const message = Array.isArray(data?.message)
			? data.message.join(", ")
			: data?.message;
		throw new ApiError(
			response.status,
			message || `API request failed: ${response.status}`,
		);
	}

	if (response.status === 204) return undefined as T;
	return (await response.json()) as T;
}
