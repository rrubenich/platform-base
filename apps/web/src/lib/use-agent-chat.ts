import { useCallback, useRef, useState } from "react";
import { type AgentEvent, streamAgentChat } from "@/lib/agent-chat";
import { ApiError } from "@/lib/api";

export type ToolCall = { name: string; args: Record<string, unknown> };

export type AssistantTurn = {
	id: number;
	role: "assistant";
	content: string;
	/** Tools the agent used for this answer, in order. */
	tools: ToolCall[];
	status: "streaming" | "done" | "stopped" | "error" | "forbidden";
};

export type Turn =
	| { id: number; role: "user"; content: string }
	| AssistantTurn;

export type AgentChat = {
	turns: Turn[];
	isStreaming: boolean;
	send: (message: string) => void;
	stop: () => void;
	reset: () => void;
};

/**
 * A conversation with the agent behind `chatPath` (an apps/api chat route).
 * The agents service keeps the conversation: each message is sent alone, in
 * the thread the first answer named. `reset` starts a new thread; the turns
 * here are only this page's view of it.
 */
export function useAgentChat(chatPath: string): AgentChat {
	const [turns, setTurns] = useState<Turn[]>([]);
	const [isStreaming, setIsStreaming] = useState(false);
	const abortRef = useRef<AbortController | null>(null);
	const threadRef = useRef<string | undefined>(undefined);
	const nextId = useRef(0);

	const send = useCallback(
		(message: string) => {
			const content = message.trim();
			if (!content || isStreaming) return;

			const userTurn: Turn = { id: nextId.current++, role: "user", content };
			const answerId = nextId.current++;
			const turn = { message: content, threadId: threadRef.current };
			setTurns((current) => [
				...current,
				userTurn,
				{
					id: answerId,
					role: "assistant",
					content: "",
					tools: [],
					status: "streaming",
				},
			]);

			const updateAnswer = (change: (turn: AssistantTurn) => Turn) =>
				setTurns((current) =>
					current.map((turn) =>
						turn.id === answerId && turn.role === "assistant"
							? change(turn)
							: turn,
					),
				);

			const onEvent = (event: AgentEvent) => {
				if (event.type === "thread") {
					threadRef.current = event.id;
				} else if (event.type === "delta") {
					updateAnswer((turn) => ({
						...turn,
						content: turn.content + event.text,
					}));
				} else if (event.type === "tool") {
					updateAnswer((turn) => ({
						...turn,
						tools: [...turn.tools, { name: event.name, args: event.args }],
					}));
				} else if (event.type === "error") {
					updateAnswer((turn) => ({ ...turn, status: "error" }));
				}
			};

			const abort = new AbortController();
			abortRef.current = abort;
			setIsStreaming(true);
			streamAgentChat(chatPath, turn, onEvent, abort.signal)
				.then(() =>
					updateAnswer((turn) =>
						turn.status === "streaming" ? { ...turn, status: "done" } : turn,
					),
				)
				.catch((error: unknown) => {
					const status = abort.signal.aborted
						? "stopped"
						: error instanceof ApiError && error.status === 403
							? "forbidden"
							: "error";
					updateAnswer((turn) => ({ ...turn, status }));
				})
				.finally(() => {
					abortRef.current = null;
					setIsStreaming(false);
				});
		},
		[chatPath, isStreaming],
	);

	const stop = useCallback(() => abortRef.current?.abort(), []);

	const reset = useCallback(() => {
		abortRef.current?.abort();
		threadRef.current = undefined;
		setTurns([]);
	}, []);

	return { turns, isStreaming, send, stop, reset };
}
