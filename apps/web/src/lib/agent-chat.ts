import { getLocale } from "@workspace/i18n/runtime";
import { ApiError } from "@/lib/api";

// Client for the agent chat routes in apps/api (proxied to apps/agents),
// which stream their reply as server-sent events.

const API_URL = import.meta.env.VITE_API_URL ?? "/api";

/** One chat turn: the user's new message, in the conversation `threadId`
 * (from that conversation's `thread` event), or a new one when absent. */
export type ChatTurn = { message: string; threadId?: string };

export type AgentEvent =
	| { type: "thread"; id: string }
	| { type: "delta"; text: string }
	| { type: "tool"; name: string; args: Record<string, unknown> }
	| { type: "done" }
	| { type: "error"; code: string; message: string };

/** Splits an SSE body into its events' JSON `data`, ignoring keep-alives. */
export function parseEventStream(buffer: string): {
	events: AgentEvent[];
	rest: string;
} {
	const frames = buffer.split(/\r?\n\r?\n/);
	// The last frame may still be arriving.
	const rest = frames.pop() ?? "";
	const events = frames.flatMap((frame) => {
		const data = frame
			.split(/\r?\n/)
			.filter((line) => line.startsWith("data:"))
			.map((line) => line.slice("data:".length).trimStart())
			.join("\n");
		return data ? [JSON.parse(data) as AgentEvent] : [];
	});
	return { events, rest };
}

/**
 * Sends a chat turn to an agent chat route and calls `onEvent` for each
 * event as it arrives; the first names the conversation's thread. Resolves when the stream ends; rejects with `ApiError`
 * when the route refuses the request (e.g. 403), or an `AbortError` when
 * `signal` aborts.
 */
export async function streamAgentChat(
	path: string,
	turn: ChatTurn,
	onEvent: (event: AgentEvent) => void,
	signal?: AbortSignal,
): Promise<void> {
	const response = await fetch(`${API_URL}${path}`, {
		method: "POST",
		credentials: "include",
		headers: {
			"Accept-Language": getLocale(),
			"Content-Type": "application/json",
			Accept: "text/event-stream",
		},
		body: JSON.stringify(turn),
		signal,
	});
	if (!response.ok || !response.body) {
		const data = (await response.json().catch(() => null)) as {
			message?: string;
		} | null;
		throw new ApiError(
			response.status,
			data?.message || `API request failed: ${response.status}`,
		);
	}

	const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
	let buffer = "";
	for (;;) {
		const { value, done } = await reader.read();
		if (done) break;
		const { events, rest } = parseEventStream(buffer + value);
		buffer = rest;
		for (const event of events) onEvent(event);
	}
	// A stream may end without a trailing blank line.
	for (const event of parseEventStream(`${buffer}\n\n`).events) onEvent(event);
}
