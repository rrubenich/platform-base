import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type AgentEvent, streamAgentChat } from "@/lib/agent-chat";
import { ApiError } from "@/lib/api";
import { AssistantContainer } from "./assistant.container";
import { parseAssistantSearch } from "./assistant.search";

const navigate = vi.fn();
let search: { q?: string } = {};

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => navigate,
	useSearch: () => search,
}));

vi.mock("@/lib/agent-chat", () => ({ streamAgentChat: vi.fn() }));

const stream = vi.mocked(streamAgentChat);

/** Makes the next call play `events`, then end. */
function replyWith(...events: AgentEvent[]) {
	stream.mockImplementationOnce(async (_path, _turn, onEvent) => {
		for (const event of events) onEvent(event);
	});
}

describe("AssistantContainer", () => {
	beforeEach(() => {
		stream.mockReset();
		navigate.mockReset();
		search = {};
	});

	it("chats with the organization assistant, in one thread", async () => {
		replyWith(
			{ type: "thread", id: "thread-1" },
			{ type: "delta", text: "Here's a **plan**." },
			{ type: "done" },
		);
		replyWith({ type: "delta", text: "Sure." }, { type: "done" });
		render(<AssistantContainer />);
		const user = userEvent.setup();

		await user.type(screen.getByRole("textbox"), "Plan my week{Enter}");
		expect(await screen.findByText("plan")).toBeInTheDocument();
		await user.type(screen.getByRole("textbox"), "Shorter{Enter}");
		expect(await screen.findByText("Sure.")).toBeInTheDocument();

		expect(stream).toHaveBeenNthCalledWith(
			1,
			"/agents/assistant/chat",
			{ message: "Plan my week", threadId: undefined },
			expect.any(Function),
			expect.any(AbortSignal),
		);
		expect(stream).toHaveBeenNthCalledWith(
			2,
			"/agents/assistant/chat",
			{ message: "Shorter", threadId: "thread-1" },
			expect.any(Function),
			expect.any(AbortSignal),
		);
	});

	it("asks the question it was opened with once, then drops it from the URL", async () => {
		search = { q: "Summarize this" };
		replyWith({ type: "delta", text: "Done." }, { type: "done" });
		render(<AssistantContainer />);

		expect(await screen.findByText("Done.")).toBeInTheDocument();
		expect(stream).toHaveBeenCalledTimes(1);
		expect(stream.mock.calls[0]?.[1]).toEqual({
			message: "Summarize this",
			threadId: undefined,
		});
		expect(navigate).toHaveBeenCalledWith({ search: {}, replace: true });
	});

	it("shows the tools it used", async () => {
		replyWith(
			{ type: "tool", name: "ask_calendar", args: {} },
			{ type: "delta", text: "Booked." },
			{ type: "done" },
		);
		render(<AssistantContainer />);

		await userEvent
			.setup()
			.click(screen.getByRole("button", { name: /Break a project/ }));

		expect(await screen.findByText("Used ask_calendar")).toBeInTheDocument();
	});

	it("says so when the member has no access", async () => {
		stream.mockRejectedValueOnce(new ApiError(403, "Forbidden"));
		render(<AssistantContainer />);

		await userEvent.setup().type(screen.getByRole("textbox"), "Hi{Enter}");

		expect(
			await screen.findByText("You don't have access to the assistant."),
		).toBeInTheDocument();
	});
});

describe("parseAssistantSearch", () => {
	it("keeps a non-blank q and drops anything else", () => {
		expect(parseAssistantSearch({ q: "Hi", other: 1 })).toEqual({ q: "Hi" });
		expect(parseAssistantSearch({ q: "  " })).toEqual({});
		expect(parseAssistantSearch({ q: 3 })).toEqual({});
	});
});
