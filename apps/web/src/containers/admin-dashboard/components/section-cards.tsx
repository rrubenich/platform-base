import {
	Building03Icon,
	ComputerIcon,
	UserBlock01Icon,
	UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { m } from "@workspace/i18n/messages";
import { Badge } from "@workspace/ui/components/badge";
import {
	Card,
	CardAction,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { formatNumber } from "@/lib/format";
import { useAdminDashboardContext } from "../admin-dashboard.context";

function StatCard({
	label,
	value,
	badge,
	icon,
	footer,
	hint,
}: {
	label: string;
	value: number | undefined;
	badge?: string;
	icon: IconSvgElement;
	footer: string;
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
				{badge && (
					<CardAction>
						<Badge variant="outline">{badge}</Badge>
					</CardAction>
				)}
			</CardHeader>
			<CardFooter className="flex-col items-start gap-1.5 text-sm">
				<div className="line-clamp-1 flex items-center gap-2 font-medium">
					{footer}
					<HugeiconsIcon icon={icon} strokeWidth={2} className="size-4" />
				</div>
				<div className="text-muted-foreground">{hint}</div>
			</CardFooter>
		</Card>
	);
}

// dashboard-01's section cards, with the platform's numbers.
export function SectionCards() {
	const { stats, growth, range } = useAdminDashboardContext();
	const newUsers = growth?.reduce((sum, day) => sum + day.users, 0);
	const newOrganizations = growth?.reduce(
		(sum, day) => sum + day.organizations,
		0,
	);

	return (
		<div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
			<StatCard
				label={m.admin_stats_users()}
				value={stats?.users}
				badge={
					stats && m.admin_stats_admins({ count: formatNumber(stats.admins) })
				}
				icon={UserGroupIcon}
				footer={m.admin_stats_new_in_range({
					count: formatNumber(newUsers ?? 0),
					days: range,
				})}
				hint={m.admin_stats_users_hint()}
			/>
			<StatCard
				label={m.admin_stats_organizations()}
				value={stats?.organizations}
				badge={
					stats && m.admin_stats_teams({ count: formatNumber(stats.teams) })
				}
				icon={Building03Icon}
				footer={m.admin_stats_new_in_range({
					count: formatNumber(newOrganizations ?? 0),
					days: range,
				})}
				hint={m.admin_stats_organizations_hint()}
			/>
			<StatCard
				label={m.admin_stats_sessions()}
				value={stats?.activeSessions}
				badge={
					stats &&
					m.admin_stats_impersonated({
						count: formatNumber(stats.impersonatedSessions),
					})
				}
				icon={ComputerIcon}
				footer={m.admin_stats_sessions_footer()}
				hint={m.admin_stats_sessions_hint()}
			/>
			<StatCard
				label={m.admin_stats_banned()}
				value={stats?.bannedUsers}
				icon={UserBlock01Icon}
				footer={m.admin_stats_banned_footer()}
				hint={m.admin_stats_banned_hint()}
			/>
		</div>
	);
}
