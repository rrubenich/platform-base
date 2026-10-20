import { AdminOrganizationsProvider } from "./admin-organizations.context";
import { AdminOrganizationsPage } from "./admin-organizations.page";

export function AdminOrganizationsContainer() {
	return (
		<AdminOrganizationsProvider>
			<AdminOrganizationsPage />
		</AdminOrganizationsProvider>
	);
}
