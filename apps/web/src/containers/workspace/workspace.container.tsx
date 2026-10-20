import { WorkspaceProvider } from "./workspace.context";
import { WorkspacePage } from "./workspace.page";

export function WorkspaceContainer() {
	return (
		<WorkspaceProvider>
			<WorkspacePage />
		</WorkspaceProvider>
	);
}
