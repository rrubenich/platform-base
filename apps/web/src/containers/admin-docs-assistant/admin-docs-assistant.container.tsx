import { AdminDocsAssistantProvider } from "./admin-docs-assistant.context";
import { AdminDocsAssistantPage } from "./admin-docs-assistant.page";

export function AdminDocsAssistantContainer() {
	return (
		<AdminDocsAssistantProvider>
			<AdminDocsAssistantPage />
		</AdminDocsAssistantProvider>
	);
}
