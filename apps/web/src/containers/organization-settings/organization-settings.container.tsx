import { OrganizationSettingsProvider } from "./organization-settings.context";
import { OrganizationSettingsPage } from "./organization-settings.page";

export function OrganizationSettingsContainer() {
	return (
		<OrganizationSettingsProvider>
			<OrganizationSettingsPage />
		</OrganizationSettingsProvider>
	);
}
