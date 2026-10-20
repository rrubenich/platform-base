import { AdminDashboardProvider } from "./admin-dashboard.context";
import { AdminDashboardPage } from "./admin-dashboard.page";

export function AdminDashboardContainer() {
	return (
		<AdminDashboardProvider>
			<AdminDashboardPage />
		</AdminDashboardProvider>
	);
}
