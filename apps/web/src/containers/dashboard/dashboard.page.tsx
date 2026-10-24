import { MemberHome } from "./components/member-home";
import { OverviewHome } from "./components/overview-home";
import { useDashboardContext } from "./dashboard.context";

/** Owners and admins run the organization; members get their own hub. */
export function DashboardPage() {
	const { isManager } = useDashboardContext();

	return isManager ? <OverviewHome /> : <MemberHome />;
}
