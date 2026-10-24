import { UserAdd01Icon, UserGroup02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";
import { buttonVariants } from "@workspace/ui/components/button";
import { useDashboardContext } from "../dashboard.context";
import { MyTeams } from "./my-teams";
import { PendingInvitations } from "./pending-invitations";
import { RecentMembers } from "./recent-members";
import { SetupChecklist } from "./setup-checklist";
import { StatCards } from "./stat-cards";

export function OverviewHome() {
	const { canInvite, canCreateTeam } = useDashboardContext();

	return (
		<div className="flex flex-col gap-6 p-4 md:p-6">
			<header className="flex flex-wrap items-start justify-between gap-4">
				<div className="flex flex-col gap-1">
					<h1 className="text-xl font-semibold">{m.dashboard_title()}</h1>
					<p className="text-sm text-muted-foreground">
						{m.dashboard_description()}
					</p>
				</div>
				{(canInvite || canCreateTeam) && (
					<div className="flex flex-wrap gap-2">
						{canInvite && (
							<Link
								to="/members"
								search={{ invite: 1 }}
								className={buttonVariants()}
							>
								<HugeiconsIcon
									icon={UserAdd01Icon}
									strokeWidth={2}
									data-icon="inline-start"
								/>
								{m.dashboard_invite()}
							</Link>
						)}
						{canCreateTeam && (
							<Link
								to="/teams"
								search={{ new: 1 }}
								className={buttonVariants({ variant: "outline" })}
							>
								<HugeiconsIcon
									icon={UserGroup02Icon}
									strokeWidth={2}
									data-icon="inline-start"
								/>
								{m.dashboard_new_team()}
							</Link>
						)}
					</div>
				)}
			</header>
			<StatCards />
			<SetupChecklist />
			<div className="grid gap-6 lg:grid-cols-2">
				<PendingInvitations />
				<RecentMembers />
				<MyTeams />
			</div>
		</div>
	);
}
