import { m } from "@workspace/i18n/messages";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@workspace/ui/components/avatar";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { formatDate } from "@/lib/format";
import { initials } from "@/lib/initials";
import { useDashboardContext } from "../dashboard.context";

export function RecentMembers() {
	const { recentMembers, isLoading } = useDashboardContext();

	return (
		<Card>
			<CardHeader>
				<CardTitle>{m.dashboard_recent_title()}</CardTitle>
				<CardDescription>{m.dashboard_recent_description()}</CardDescription>
			</CardHeader>
			<CardContent>
				{isLoading ? (
					<Skeleton className="h-16 w-full" />
				) : (
					<ul className="flex flex-col gap-3">
						{recentMembers.map((member) => (
							<li key={member.id} className="flex items-center gap-3">
								<Avatar>
									{member.user.image && <AvatarImage src={member.user.image} />}
									<AvatarFallback>{initials(member.user.name)}</AvatarFallback>
								</Avatar>
								<div className="flex min-w-0 flex-1 flex-col">
									<span className="truncate font-medium">
										{member.user.name}
									</span>
									<span className="truncate text-sm text-muted-foreground">
										{member.user.email}
									</span>
								</div>
								<span className="text-sm text-muted-foreground">
									{m.dashboard_recent_joined({
										date: formatDate(member.createdAt),
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
