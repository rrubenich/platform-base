import { AdminOrganizationProvider } from "./admin-organization.context";
import { AdminOrganizationPage } from "./admin-organization.page";

export function AdminOrganizationContainer() {
	return (
		<AdminOrganizationProvider>
			<AdminOrganizationPage />
		</AdminOrganizationProvider>
	);
}
