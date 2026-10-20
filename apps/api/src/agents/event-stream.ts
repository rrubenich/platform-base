import { Readable } from "node:stream";
import type { ReadableStream } from "node:stream/web";
import { HttpStatus } from "@nestjs/common";
import type { Response } from "express";

/**
 * Pipes an agent's server-sent events from apps/agents to the browser as
 * they arrive. `open` receives a signal that aborts once the browser goes
 * away, so the agent stops generating (and paying for) tokens.
 */
export async function proxyEventStream(
	response: Response,
	open: (signal: AbortSignal) => Promise<globalThis.Response>,
): Promise<void> {
	const abort = new AbortController();
	response.on("close", () => abort.abort());

	// Throws (and Nest answers with a status) before any byte is sent.
	const upstream = await open(abort.signal);
	response.status(HttpStatus.OK).set({
		"Content-Type": "text/event-stream",
		"Cache-Control": "no-cache",
		Connection: "keep-alive",
		// Keeps reverse proxies from buffering the stream.
		"X-Accel-Buffering": "no",
	});
	response.flushHeaders();
	if (!upstream.body) {
		response.end();
		return;
	}
	Readable.fromWeb(upstream.body as ReadableStream)
		.on("error", () => response.end())
		.pipe(response);
}
