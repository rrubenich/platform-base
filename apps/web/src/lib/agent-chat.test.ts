import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { ApiError } from "@/lib/api";
import {
	type AgentEvent,
	parseEventStream,
	streamAgentChat,
} from "./agent-chat";

function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
	const encoder = new TextEncoder();
	return new ReadableStream({
		start(controller) {
			for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
			controller.close();
		},
	});
}

describe("parseEventStream", () => {
	it("returns complete events and keeps the unfinished one", () => {
		const { events, rest } = parseEventStream(
			'event: delta\ndata: {"type":"delta","text":"Oi"}\n\n: ping\n\nevent: done\ndata: {"ty',
		);

		expect(events).toEqual([{ type: "delta", text: "Oi" }]);
		expect(rest).toBe('event: done\ndata: {"ty');
	});
});

describe("streamAgentChat", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("posts the turn and reports events split across chunks", async () => {
		const fetchMock = vi.fn(
			async () =>
				new Response(
					streamOf(
						'event: thread\ndata: {"type":"thread","id":"t1"}\n\nevent: tool\ndata: {"type":"tool","name":"read_doc","args":{"path":"AGENTS.md"}}\n\nevent: delta\ndata: {"type":"del',
						'ta","text":"Olá"}\n\nevent: done\ndata: {"type":"done"}\n\n',
					),
					{ headers: { "Content-Type": "text/event-stream" } },
				),
		);
		vi.stubGlobal("fetch", fetchMock);
		const events: AgentEvent[] = [];

		await streamAgentChat(
			"/admin/docs-assistant/chat",
			{ message: "Oi", threadId: "t1" },
			(event) => events.push(event),
		);

		expect(events).toEqual([
			{ type: "thread", id: "t1" },
			{ type: "tool", name: "read_doc", args: { path: "AGENTS.md" } },
			{ type: "delta", text: "Olá" },
			{ type: "done" },
		]);
		const [url, init] = fetchMock.mock.calls[0] as unknown as [
			string,
			RequestInit,
		];
		expect(url).toBe("/api/admin/docs-assistant/chat");
		expect(init.credentials).toBe("include");
		expect(JSON.parse(init.body as string)).toEqual({
			message: "Oi",
			threadId: "t1",
		});
	});

	it("rejects with the API's status and message when the route refuses", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				Response.json({ message: "Forbidden" }, { status: 403 }),
			),
		);

		const call = streamAgentChat("/x", { message: "Oi" }, () => {});

		await expect(call).rejects.toBeInstanceOf(ApiError);
		await expect(call).rejects.toMatchObject({
			status: 403,
			message: "Forbidden",
		});
	});
});
