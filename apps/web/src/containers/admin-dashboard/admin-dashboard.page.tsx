import { m } from "@workspace/i18n/messages";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { useAdminDashboardContext } from "./admin-dashboard.context";
import { GrowthChart } from "./components/growth-chart";
import { RecentUsersTable } from "./components/recent-users-table";
import { SectionCards } from "./components/section-cards";

export function AdminDashboardPage() {
	const { isError } = useAdminDashboardContext();

	return (
		<>
			{isError && (
				<div className="px-4 lg:px-6">
					<Alert variant="destructive">
						<AlertDescription>{m.admin_load_error()}</AlertDescription>
					</Alert>
				</div>
			)}
			<SectionCards />
			<div className="px-4 lg:px-6">
				<GrowthChart />
			</div>
			<div className="px-4 lg:px-6">
				<RecentUsersTable />
			</div>
		</>
	);
}
