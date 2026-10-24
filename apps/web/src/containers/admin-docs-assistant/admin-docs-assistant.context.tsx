import { createContext, type ReactNode, useContext } from "react";
import { type AgentChat, useAgentChat } from "@/lib/use-agent-chat";

const CHAT_PATH = "/admin/docs-assistant/chat";

const AdminDocsAssistantContext = createContext<AgentChat | undefined>(
	undefined,
);

// The conversation lives only in this page (and the admin's thread in the
// agents service).
export function AdminDocsAssistantProvider({
	children,
}: {
	children: ReactNode;
}) {
	const chat = useAgentChat(CHAT_PATH);

	return (
		<AdminDocsAssistantContext.Provider value={chat}>
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
