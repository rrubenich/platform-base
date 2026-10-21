import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useRef,
	useState,
} from "react";
import { type AgentEvent, streamAgentChat } from "@/lib/agent-chat";
import { ApiError } from "@/lib/api";

const CHAT_PATH = "/admin/docs-assistant/chat";

export type ToolCall = { name: string; args: Record<string, unknown> };

export type Turn =
	| { id: number; role: "user"; content: string }
	| {
			id: number;
			role: "assistant";
			content: string;
			/** Tools the agent used for this answer, in order. */
			tools: ToolCall[];
			status: "streaming" | "done" | "stopped" | "error" | "forbidden";
	  };

type AdminDocsAssistantContextValue = {
	turns: Turn[];
	isStreaming: boolean;
	send: (question: string) => void;
	stop: () => void;
	reset: () => void;
};

const AdminDocsAssistantContext = createContext<
	AdminDocsAssistantContextValue | undefined
>(undefined);

// The agents service keeps the conversation (per admin): each question is
// sent alone, in the thread the first answer named. A new chat starts a new
// thread; the turns shown here are only this page's view of it.
export function AdminDocsAssistantProvider({
	children,
}: {
	children: ReactNode;
}) {
	const [turns, setTurns] = useState<Turn[]>([]);
	const [isStreaming, setIsStreaming] = useState(false);
	const abortRef = useRef<AbortController | null>(null);
	const threadRef = useRef<string | undefined>(undefined);
	const nextId = useRef(0);

	const send = useCallback(
		(question: string) => {
			const content = question.trim();
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

			const updateAnswer = (
				change: (turn: Extract<Turn, { role: "assistant" }>) => Turn,
			) =>
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
			streamAgentChat(CHAT_PATH, turn, onEvent, abort.signal)
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
		[isStreaming],
	);

	const stop = useCallback(() => abortRef.current?.abort(), []);

	const reset = useCallback(() => {
		abortRef.current?.abort();
		threadRef.current = undefined;
		setTurns([]);
	}, []);

	return (
		<AdminDocsAssistantContext.Provider
			value={{ turns, isStreaming, send, stop, reset }}
		>
			{children}
		</AdminDocsAssistantContext.Provider>
	);
}

export function useAdminDocsAssistantContext() {
	const context = useContext(AdminDocsAssistantContext);

	if (context === undefined) {
		throw new Error(
			"useAdminDocsAssistantContext must be used within an AdminDocsAssistantProvider",
		);
	}

	return context;
}
