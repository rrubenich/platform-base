import {
	Mail01Icon,
	UserGroup02Icon,
	UserMultiple02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { m } from "@workspace/i18n/messages";
import {
	Card,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { formatNumber } from "@/lib/format";
import { useDashboardContext } from "../dashboard.context";

function StatCard({
	label,
	value,
	icon,
	hint,
}: {
	label: string;
	value: number | undefined;
	icon: IconSvgElement;
	hint: string;
}) {
	return (
		<Card className="@container/card">
			<CardHeader>
				<CardDescription>{label}</CardDescription>
				<CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
					{value === undefined ? (
						<Skeleton className="h-8 w-20" />
					) : (
						formatNumber(value)
					)}
				</CardTitle>
			</CardHeader>
			<CardFooter className="flex items-center gap-2 text-sm text-muted-foreground">
				<HugeiconsIcon icon={icon} strokeWidth={2} className="size-4" />
				{hint}
			</CardFooter>
		</Card>
	);
}

export function StatCards() {
	const { memberCount, teamCount, pendingInvitationCount } =
		useDashboardContext();

	return (
		<div className="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs sm:grid-cols-3 dark:*:data-[slot=card]:bg-card">
			<StatCard
				label={m.dashboard_stat_members()}
				value={memberCount}
				icon={UserMultiple02Icon}
				hint={m.dashboard_stat_members_hint()}
			/>
			<StatCard
				label={m.dashboard_stat_teams()}
				value={teamCount}
				icon={UserGroup02Icon}
				hint={m.dashboard_stat_teams_hint()}
			/>
			<StatCard
				label={m.dashboard_stat_pending()}
				value={pendingInvitationCount}
				icon={Mail01Icon}
				hint={m.dashboard_stat_pending_hint()}
			/>
		</div>
	);
}
