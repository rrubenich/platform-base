import { UserGroup02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@workspace/ui/components/card";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@workspace/ui/components/empty";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { useDashboardContext } from "../dashboard.context";

export function MyTeams() {
	const { myTeams } = useDashboardContext();

	return (
		<Card>
			<CardHeader>
				<CardTitle>{m.dashboard_my_teams_title()}</CardTitle>
				<CardDescription>{m.dashboard_my_teams_description()}</CardDescription>
			</CardHeader>
			<CardContent>
				{myTeams === undefined ? (
					<Skeleton className="h-16 w-full" />
				) : myTeams.length === 0 ? (
					<Empty className="border">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<HugeiconsIcon icon={UserGroup02Icon} strokeWidth={2} />
							</EmptyMedia>
							<EmptyTitle>{m.dashboard_my_teams_empty_title()}</EmptyTitle>
							<EmptyDescription>
								{m.dashboard_my_teams_empty_description()}
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				) : (
					<ul className="flex flex-col gap-2">
						{myTeams.map((team) => (
							<li key={team.id}>
								<Link
									to="/teams/$teamId"
									params={{ teamId: team.id }}
									className="font-medium hover:underline"
								>
									{team.name}
								</Link>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
