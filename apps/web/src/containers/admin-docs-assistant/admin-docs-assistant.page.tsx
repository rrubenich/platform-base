import { PencilEdit02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { m } from "@workspace/i18n/messages";
import { Button } from "@workspace/ui/components/button";
import { useAdminDocsAssistantContext } from "./admin-docs-assistant.context";
import { Composer } from "./components/composer";
import { Conversation } from "./components/conversation";

export function AdminDocsAssistantPage() {
	const { turns, reset } = useAdminDocsAssistantContext();

	return (
		// Fills the viewport under the header, so only the conversation scrolls.
		<div className="flex h-[calc(100svh-var(--header-height)-3rem)] flex-col gap-4 px-4 lg:px-6">
			<div className="flex items-center justify-between gap-4">
				<h1 className="font-semibold text-lg">{m.docs_assistant_title()}</h1>
				{turns.length > 0 && (
					<Button variant="outline" size="sm" onClick={reset}>
						<HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={2} />
						{m.docs_assistant_new_chat()}
					</Button>
				)}
			</div>
			<div className="flex flex-1 overflow-y-auto">
				<Conversation />
			</div>
			<Composer />
		</div>
	);
}
