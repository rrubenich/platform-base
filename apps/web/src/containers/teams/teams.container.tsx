import { TeamsProvider } from "./teams.context";
import { TeamsPage } from "./teams.page";

export function TeamsContainer() {
	return (
		<TeamsProvider>
			<TeamsPage />
		</TeamsProvider>
	);
}
