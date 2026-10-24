import { useNavigate, useSearch } from "@tanstack/react-router";
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useRef,
} from "react";
import { type AgentChat, useAgentChat } from "@/lib/use-agent-chat";

const CHAT_PATH = "/agents/assistant/chat";

const AssistantContext = createContext<AgentChat | undefined>(undefined);

/** The member's conversation with the organization assistant. */
export function AssistantProvider({ children }: { children: ReactNode }) {
	const chat = useAgentChat(CHAT_PATH);
	const { q } = useSearch({ from: "/_workspace/assistant" });
	const navigate = useNavigate({ from: "/assistant" });
	const sentInitial = useRef(false);
	const { send } = chat;

	// A question asked from the home page: send it once, then drop it from
	// the URL so a reload doesn't ask it again.
	useEffect(() => {
		if (!q || sentInitial.current) return;
		sentInitial.current = true;
		send(q);
		void navigate({ search: {}, replace: true });
	}, [q, send, navigate]);

	return (
		<AssistantContext.Provider value={chat}>
			{children}
		</AssistantContext.Provider>
	);
}

export function useAssistantContext() {
	const context = useContext(AssistantContext);

	if (context === undefined) {
		throw new Error(
			"useAssistantContext must be used within an AssistantProvider",
		);
	}

	return context;
}
