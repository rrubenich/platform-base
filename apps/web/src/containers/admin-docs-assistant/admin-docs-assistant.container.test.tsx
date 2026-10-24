import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { type AgentEvent, streamAgentChat } from "@/lib/agent-chat";
import { ApiError } from "@/lib/api";
import { AdminDocsAssistantContainer } from "./admin-docs-assistant.container";

vi.mock("@/lib/agent-chat", () => ({ streamAgentChat: vi.fn() }));

const stream = vi.mocked(streamAgentChat);

/** Makes the next call play `events`, then end. */
function replyWith(...events: AgentEvent[]) {
	stream.mockImplementationOnce(async (_path, _turn, onEvent) => {
		for (const event of events) onEvent(event);
	});
}

async function ask(question: string) {
	const user = userEvent.setup();
	await user.type(screen.getByRole("textbox"), `${question}{Enter}`);
	return user;
}

describe("AdminDocsAssistantContainer", () => {
	beforeEach(() => {
		stream.mockReset();
	});

	it("suggests questions until the first one is asked", async () => {
		replyWith({ type: "done" });
		render(<AdminDocsAssistantContainer />);

		const suggestion = screen.getByRole("button", {
			name: /How are the AI agents integrated/,
		});
		await userEvent.setup().click(suggestion);

		expect(stream).toHaveBeenCalledWith(
			"/admin/docs-assistant/chat",
			{ message: suggestion.textContent, threadId: undefined },
			expect.any(Function),
			expect.any(AbortSignal),
		);
		expect(
			screen.queryByRole("button", { name: /How are the AI agents/ }),
		).not.toBeInTheDocument();
	});

	it("shows what the agent looked up and its Markdown answer", async () => {
		replyWith(
			{ type: "tool", name: "search_docs", args: { query: "JWT" } },
			{ type: "tool", name: "read_doc", args: { path: "AGENTS.md" } },
			{ type: "delta", text: "Tokens are **EdDSA** JWTs.\n\n" },
			{ type: "delta", text: "Sources: `AGENTS.md`" },
			{ type: "done" },
		);
		render(<AdminDocsAssistantContainer />);

		await ask("How do the services authenticate?");

		const answer = await screen.findByRole("article", { name: "Assistant" });
		expect(within(answer).getByText("Searched for “JWT”")).toBeInTheDocument();
		expect(within(answer).getByText("Read AGENTS.md")).toBeInTheDocument();
		expect(within(answer).getByText("EdDSA").tagName).toBe("STRONG");
		expect(
			within(answer).getByText("AGENTS.md", { selector: "code" }),
		).toBeInTheDocument();
		expect(screen.getByRole("article", { name: "You" })).toHaveTextContent(
			"How do the services authenticate?",
		);
	});

	it("continues the conversation in the thread its first answer named", async () => {
		replyWith(
			{ type: "thread", id: "t1" },
			{ type: "delta", text: "First answer" },
			{ type: "done" },
		);
		replyWith({ type: "thread", id: "t1" }, { type: "done" });
		render(<AdminDocsAssistantContainer />);

		await ask("First?");
		await screen.findByText("First answer");
		await ask("Second?");

		expect(stream.mock.calls[0][1]).toEqual({
			message: "First?",
			threadId: undefined,
		});
		expect(stream.mock.calls[1][1]).toEqual({
			message: "Second?",
			threadId: "t1",
		});
	});

	it("starts a new thread for a new chat", async () => {
		replyWith(
			{ type: "thread", id: "t1" },
			{ type: "delta", text: "First answer" },
			{ type: "done" },
		);
		replyWith({ type: "thread", id: "t2" }, { type: "done" });
		render(<AdminDocsAssistantContainer />);

		const user = await ask("First?");
		await screen.findByText("First answer");
		await user.click(screen.getByRole("button", { name: "New chat" }));
		await ask("Another topic?");

		expect(stream.mock.calls[1][1]).toEqual({
			message: "Another topic?",
			threadId: undefined,
		});
		expect(screen.queryByText("First answer")).not.toBeInTheDocument();
	});

	it("reports an agent failure without losing the conversation", async () => {
		replyWith({ type: "error", code: "model_error", message: "x" });
		render(<AdminDocsAssistantContainer />);

		await ask("Anything?");

		expect(
			await screen.findByText(
				"The assistant could not answer. Please try again.",
			),
		).toBeInTheDocument();
		expect(screen.getByRole("article", { name: "You" })).toBeInTheDocument();
	});

	it("explains when the user may not use the assistant", async () => {
		stream.mockRejectedValueOnce(new ApiError(403, "Forbidden"));
		render(<AdminDocsAssistantContainer />);

		await ask("Anything?");

		expect(
			await screen.findByText("You don't have access to the docs assistant."),
		).toBeInTheDocument();
	});

	it("stops the answer being written", async () => {
		stream.mockImplementationOnce(
			(_path, _turn, onEvent, signal) =>
				new Promise((_resolve, reject) => {
					onEvent({ type: "delta", text: "Partial" });
					signal?.addEventListener("abort", () =>
						reject(new DOMException("Aborted", "AbortError")),
					);
				}),
		);
		render(<AdminDocsAssistantContainer />);

		const user = await ask("Long question?");
		await user.click(await screen.findByRole("button", { name: "Stop" }));

		expect(await screen.findByText("Stopped.")).toBeInTheDocument();
		expect(screen.getByText("Partial")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
	});
});
