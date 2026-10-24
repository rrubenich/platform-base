import { Link } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";
import { Badge } from "@workspace/ui/components/badge";
import { buttonVariants } from "@workspace/ui/components/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { memberRoleLabel } from "@/components/role-select";
import { formatDate } from "@/lib/format";
import { useDashboardContext } from "../dashboard.context";

/** Invitations nobody has answered yet, the soonest to expire first. */
export function PendingInvitations() {
	const { pendingInvitations, pendingInvitationCount, isLoading } =
		useDashboardContext();

	return (
		<Card>
			<CardHeader>
				<CardTitle>{m.dashboard_pending_title()}</CardTitle>
				<CardDescription>{m.dashboard_pending_description()}</CardDescription>
				{(pendingInvitationCount ?? 0) > 0 && (
					<CardAction>
						<Link
							to="/members"
							search={{ tab: "invitations" }}
							className={buttonVariants({ variant: "outline", size: "sm" })}
						>
							{m.dashboard_pending_view_all()}
						</Link>
					</CardAction>
				)}
			</CardHeader>
			<CardContent>
				{isLoading ? (
					<Skeleton className="h-16 w-full" />
				) : pendingInvitations.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						{m.dashboard_pending_empty()}
					</p>
				) : (
					<ul className="flex flex-col gap-3">
						{pendingInvitations.map((invitation) => (
							<li key={invitation.id} className="flex items-center gap-3">
								<span className="min-w-0 flex-1 truncate font-medium">
									{invitation.email}
								</span>
								{invitation.role && (
									<Badge variant="secondary">
										{memberRoleLabel(invitation.role)}
									</Badge>
								)}
								<span className="text-sm text-muted-foreground">
									{m.dashboard_pending_expires({
										date: formatDate(invitation.expiresAt),
									})}
								</span>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
