import { AdminUsersProvider } from "./admin-users.context";
import { AdminUsersPage } from "./admin-users.page";

export function AdminUsersContainer() {
	return (
		<AdminUsersProvider>
			<AdminUsersPage />
		</AdminUsersProvider>
	);
}
