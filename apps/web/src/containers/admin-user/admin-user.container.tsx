import { AdminUserProvider } from "./admin-user.context";
import { AdminUserPage } from "./admin-user.page";

export function AdminUserContainer() {
	return (
		<AdminUserProvider>
			<AdminUserPage />
		</AdminUserProvider>
	);
}
