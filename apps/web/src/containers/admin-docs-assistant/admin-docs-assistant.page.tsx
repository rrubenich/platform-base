import { AiBookIcon, PencilEdit02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { m } from "@workspace/i18n/messages";
import { Button } from "@workspace/ui/components/button";
import { Composer } from "@/components/agent-chat/composer";
import { Conversation } from "@/components/agent-chat/conversation";
import { useAdminDocsAssistantContext } from "./admin-docs-assistant.context";
import { ToolActivity } from "./components/tool-activity";

export function AdminDocsAssistantPage() {
	const chat = useAdminDocsAssistantContext();

	return (
		// Fills the viewport under the header, so only the conversation scrolls.
		<div className="flex h-[calc(100svh-var(--header-height)-3rem)] flex-col gap-4 px-4 lg:px-6">
			<div className="flex items-center justify-between gap-4">
				<h1 className="font-semibold text-lg">{m.docs_assistant_title()}</h1>
				{chat.turns.length > 0 && (
					<Button variant="outline" size="sm" onClick={chat.reset}>
						<HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={2} />
						{m.chat_new()}
					</Button>
				)}
			</div>
			<div className="flex flex-1 overflow-y-auto">
				<Conversation
					chat={chat}
					icon={AiBookIcon}
					copy={{
						description: m.docs_assistant_description(),
						thinking: m.docs_assistant_thinking(),
						error: m.docs_assistant_error(),
						forbidden: m.docs_assistant_forbidden(),
					}}
					suggestions={[
						m.docs_assistant_suggestion_architecture(),
						m.docs_assistant_suggestion_auth(),
						m.docs_assistant_suggestion_agents(),
						m.docs_assistant_suggestion_organizations(),
					]}
					renderTools={(tools) => <ToolActivity tools={tools} />}
				/>
			</div>
			<Composer chat={chat} placeholder={m.docs_assistant_placeholder()} />
		</div>
	);
}
