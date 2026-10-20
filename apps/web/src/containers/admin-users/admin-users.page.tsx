import { m } from "@workspace/i18n/messages";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { useAdminUsersContext } from "./admin-users.context";
import { UsersTable } from "./components/users-table";
import { UsersToolbar } from "./components/users-toolbar";

export function AdminUsersPage() {
	const { isError } = useAdminUsersContext();

	return (
		<div className="flex flex-col gap-4 px-4 lg:px-6">
			<div>
				<h1 className="text-xl font-semibold">{m.admin_users_title()}</h1>
				<p className="text-sm text-muted-foreground">
					{m.admin_users_description()}
				</p>
			</div>
			<UsersToolbar />
			{isError ? (
				<Alert variant="destructive">
					<AlertDescription>{m.admin_load_error()}</AlertDescription>
				</Alert>
			) : (
				<UsersTable />
			)}
		</div>
	);
}
