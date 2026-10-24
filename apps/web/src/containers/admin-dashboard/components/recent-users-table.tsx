import { Link } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";
import { Button } from "@workspace/ui/components/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@workspace/ui/components/table";
import { UserBadges, UserIdentity } from "@/components/admin/user-badges";
import { formatDate } from "@/lib/format";
import { useAdminDashboardContext } from "../admin-dashboard.context";

// Where dashboard-01 has its data table: the latest sign-ups.
export function RecentUsersTable() {
	const { recentUsers, isRecentUsersLoading } = useAdminDashboardContext();

	return (
		<Card>
			<CardHeader>
				<CardTitle>{m.admin_recent_users_title()}</CardTitle>
				<CardDescription>{m.admin_recent_users_description()}</CardDescription>
				<CardAction>
					<Button
						variant="outline"
						size="sm"
						render={<Link to="/admin/users" />}
					>
						{m.admin_view_all()}
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				<div className="overflow-hidden rounded-lg border">
					<Table>
						<TableHeader className="bg-muted">
							<TableRow>
								<TableHead>{m.admin_column_user()}</TableHead>
								<TableHead>{m.admin_column_status()}</TableHead>
								<TableHead className="text-right">
									{m.admin_column_joined()}
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{isRecentUsersLoading
								? Array.from({ length: 4 }, (_, index) => (
										<TableRow key={index}>
											<TableCell colSpan={3}>
												<Skeleton className="h-8 w-full" />
											</TableCell>
										</TableRow>
									))
								: recentUsers?.map((user) => (
										<TableRow key={user.id}>
											<TableCell>
												<Link
													to="/admin/users/$userId"
													params={{ userId: user.id }}
													className="block hover:underline"
												>
													<UserIdentity user={user} />
												</Link>
											</TableCell>
											<TableCell>
												<UserBadges user={user} />
											</TableCell>
											<TableCell className="text-right text-muted-foreground">
												{formatDate(user.createdAt)}
											</TableCell>
										</TableRow>
									))}
						</TableBody>
					</Table>
				</div>
			</CardContent>
		</Card>
	);
}
