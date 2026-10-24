import { UserGroupIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@workspace/ui/components/empty";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@workspace/ui/components/table";
import { TablePagination } from "@/components/admin/table-pagination";
import { UserActionsMenu } from "@/components/admin/user-actions-menu";
import { UserBadges, UserIdentity } from "@/components/admin/user-badges";
import { formatDate } from "@/lib/format";
import { USERS_PAGE_SIZE, useAdminUsersContext } from "../admin-users.context";

export function UsersTable() {
	const {
		users,
		total,
		page,
		isLoading,
		currentUserId,
		pendingSetupUserIds,
		actions,
		setPage,
	} = useAdminUsersContext();

	if (!isLoading && users?.length === 0) {
		return (
			<Empty className="border">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<HugeiconsIcon icon={UserGroupIcon} strokeWidth={2} />
					</EmptyMedia>
					<EmptyTitle>{m.admin_users_empty_title()}</EmptyTitle>
					<EmptyDescription>
						{m.admin_users_empty_description()}
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="overflow-hidden rounded-lg border">
				<Table>
					<TableHeader className="bg-muted">
						<TableRow>
							<TableHead>{m.admin_column_user()}</TableHead>
							<TableHead>{m.admin_column_status()}</TableHead>
							<TableHead className="hidden md:table-cell">
								{m.admin_column_joined()}
							</TableHead>
							<TableHead className="w-12">
								<span className="sr-only">{m.admin_column_actions()}</span>
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{isLoading
							? Array.from({ length: 6 }, (_, index) => (
									<TableRow key={index}>
										<TableCell colSpan={4}>
											<Skeleton className="h-8 w-full" />
										</TableCell>
									</TableRow>
								))
							: users?.map((user) => (
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
											<UserBadges
												user={user}
												pendingSetup={pendingSetupUserIds.has(user.id)}
											/>
										</TableCell>
										<TableCell className="hidden text-muted-foreground md:table-cell">
											{formatDate(user.createdAt)}
										</TableCell>
										<TableCell className="text-right">
											<UserActionsMenu
												user={user}
												isSelf={user.id === currentUserId}
												actions={actions}
												showDetailsLink
											/>
										</TableCell>
									</TableRow>
								))}
					</TableBody>
				</Table>
			</div>
			<TablePagination
				page={page}
				pageSize={USERS_PAGE_SIZE}
				total={total}
				onPageChange={setPage}
			/>
		</div>
	);
}
