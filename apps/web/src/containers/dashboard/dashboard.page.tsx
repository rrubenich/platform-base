import { UserAdd01Icon, UserGroup02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { buttonVariants } from "@workspace/ui/components/button";
import { MyTeams } from "./components/my-teams";
import { RecentMembers } from "./components/recent-members";
import { StatCards } from "./components/stat-cards";
import { useDashboardContext } from "./dashboard.context";

export function DashboardPage() {
	const { canInvite, canCreateTeam, isError } = useDashboardContext();

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
			{isError ? (
				<Alert variant="destructive">
					<AlertDescription>{m.dashboard_load_error()}</AlertDescription>
				</Alert>
			) : (
				<StatCards />
			)}
			<div className="grid gap-6 lg:grid-cols-2">
				<MyTeams />
				{!isError && <RecentMembers />}
			</div>
		</div>
	);
}
