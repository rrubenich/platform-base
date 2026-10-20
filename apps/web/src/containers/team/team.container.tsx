import { TeamProvider } from "./team.context";
import { TeamPage } from "./team.page";

export function TeamContainer() {
	return (
		<TeamProvider>
			<TeamPage />
		</TeamProvider>
	);
}
