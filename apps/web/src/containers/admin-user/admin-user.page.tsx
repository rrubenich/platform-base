import { m } from "@workspace/i18n/messages";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { useAdminUserContext } from "./admin-user.context";
import { UserProfileCard } from "./components/user-profile-card";
import { UserSessionsCard } from "./components/user-sessions-card";

export function AdminUserPage() {
	const { user, isLoading, isError } = useAdminUserContext();

	return (
		<div className="flex flex-col gap-4 px-4 lg:px-6">
			{isError ? (
				<Alert variant="destructive">
					<AlertDescription>{m.admin_user_not_found()}</AlertDescription>
				</Alert>
			) : isLoading || !user ? (
				<Skeleton className="h-48 w-full" />
			) : (
				<>
					<UserProfileCard user={user} />
					<UserSessionsCard />
				</>
			)}
		</div>
	);
}
