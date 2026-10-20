import { DashboardProvider } from "./dashboard.context";
import { DashboardPage } from "./dashboard.page";

export function DashboardContainer() {
	return (
		<DashboardProvider>
			<DashboardPage />
		</DashboardProvider>
	);
}
