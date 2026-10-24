import { m } from "@workspace/i18n/messages";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@workspace/ui/components/avatar";
import { Badge } from "@workspace/ui/components/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { memberRoleLabel } from "@/components/role-select";
import { initials } from "@/lib/initials";
import { useDashboardContext } from "../dashboard.context";

/** The organization's owners and admins, for a member who needs something. */
export function Contacts() {
	const { contacts, isLoading } = useDashboardContext();

	if (!isLoading && contacts.length === 0) return null;

	return (
		<Card>
			<CardHeader>
				<CardTitle>{m.home_contacts_title()}</CardTitle>
				<CardDescription>{m.home_contacts_description()}</CardDescription>
			</CardHeader>
			<CardContent>
				{isLoading ? (
					<Skeleton className="h-16 w-full" />
				) : (
					<ul className="flex flex-col gap-3">
						{contacts.map((member) => (
							<li key={member.id} className="flex items-center gap-3">
								<Avatar>
									{member.user.image && <AvatarImage src={member.user.image} />}
									<AvatarFallback>{initials(member.user.name)}</AvatarFallback>
								</Avatar>
								<div className="flex min-w-0 flex-1 flex-col">
									<span className="truncate font-medium">
										{member.user.name}
									</span>
									<a
										href={`mailto:${member.user.email}`}
										className="truncate text-sm text-muted-foreground hover:underline"
									>
										{member.user.email}
									</a>
								</div>
								<Badge variant="secondary">
									{memberRoleLabel(member.role)}
								</Badge>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
