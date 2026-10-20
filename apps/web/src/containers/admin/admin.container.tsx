import { AdminProvider } from "./admin.context";
import { AdminPage } from "./admin.page";

export function AdminContainer() {
	return (
		<AdminProvider>
			<AdminPage />
		</AdminProvider>
	);
}
