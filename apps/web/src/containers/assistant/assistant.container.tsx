import { AssistantProvider } from "./assistant.context";
import { AssistantPage } from "./assistant.page";

export function AssistantContainer() {
	return (
		<AssistantProvider>
			<AssistantPage />
		</AssistantProvider>
	);
}
