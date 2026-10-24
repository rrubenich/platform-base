import { UserGroup02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import {
	Avatar,
	AvatarFallback,
	AvatarGroup,
	AvatarGroupCount,
	AvatarImage,
} from "@workspace/ui/components/avatar";
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
import { initials } from "@/lib/initials";
import { useDashboardContext } from "../dashboard.context";

const SHOWN_AVATARS = 5;

/** The viewer's teams, each with the faces of the people in it. */
export function TeamRosters() {
	const { myTeamsWithMembers, isTeamsError } = useDashboardContext();

	return (
		<Card>
			<CardHeader>
				<CardTitle>{m.home_teams_title()}</CardTitle>
				<CardDescription>{m.home_teams_description()}</CardDescription>
			</CardHeader>
			<CardContent>
				{isTeamsError ? (
					<Alert variant="destructive">
						<AlertDescription>{m.dashboard_my_teams_error()}</AlertDescription>
					</Alert>
				) : myTeamsWithMembers === undefined ? (
					<Skeleton className="h-16 w-full" />
				) : myTeamsWithMembers.length === 0 ? (
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
					<ul className="flex flex-col gap-4">
						{myTeamsWithMembers.map((team) => (
							<li
								key={team.id}
								className="flex flex-wrap items-center justify-between gap-3"
							>
								<Link
									to="/teams/$teamId"
									params={{ teamId: team.id }}
									className="font-medium hover:underline"
								>
									{team.name}
								</Link>
								{team.members === undefined ? (
									<Skeleton className="h-8 w-24" />
								) : (
									<AvatarGroup>
										{team.members.slice(0, SHOWN_AVATARS).map((member) => (
											<Avatar key={member.id} title={member.user.name}>
												{member.user.image && (
													<AvatarImage src={member.user.image} />
												)}
												<AvatarFallback>
													{initials(member.user.name)}
												</AvatarFallback>
											</Avatar>
										))}
										{team.members.length > SHOWN_AVATARS && (
											<AvatarGroupCount>
												{m.home_teams_more({
													count: team.members.length - SHOWN_AVATARS,
												})}
											</AvatarGroupCount>
										)}
									</AvatarGroup>
								)}
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
