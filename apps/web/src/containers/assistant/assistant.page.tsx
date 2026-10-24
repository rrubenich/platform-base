import { AiChat02Icon, PencilEdit02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { m } from "@workspace/i18n/messages";
import { Button } from "@workspace/ui/components/button";
import { Composer } from "@/components/agent-chat/composer";
import { Conversation } from "@/components/agent-chat/conversation";
import { useAssistantContext } from "./assistant.context";
import { ToolActivity } from "./components/tool-activity";

export function AssistantPage() {
	const chat = useAssistantContext();

	return (
		// Fills the viewport under the header, so only the conversation scrolls.
		<div className="flex h-[calc(100svh-var(--header-height)-2rem)] flex-col gap-4 p-4 md:p-6">
			<div className="flex items-center justify-between gap-4">
				<h1 className="text-xl font-semibold">{m.assistant_title()}</h1>
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
					icon={AiChat02Icon}
					copy={{
						description: m.assistant_description(),
						thinking: m.assistant_thinking(),
						error: m.assistant_error(),
						forbidden: m.assistant_forbidden(),
					}}
					suggestions={[
						m.assistant_suggestion_update(),
						m.assistant_suggestion_plan(),
						m.assistant_suggestion_summarize(),
					]}
					renderTools={(tools) => <ToolActivity tools={tools} />}
				/>
			</div>
			<Composer chat={chat} placeholder={m.assistant_placeholder()} />
		</div>
	);
}
