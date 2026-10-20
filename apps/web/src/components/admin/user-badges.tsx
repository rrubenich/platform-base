import { m } from "@workspace/i18n/messages";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@workspace/ui/components/avatar";
import { Badge } from "@workspace/ui/components/badge";
import { initials } from "@/lib/initials";

export const hasRole = (role: string | null | undefined, name: string) =>
	(role ?? "").split(",").includes(name);

/** Platform role(s) and account state, as badges. */
export function UserBadges({
	user,
}: {
	user: {
		role?: string | null;
		banned?: boolean | null;
		emailVerified?: boolean;
	};
}) {
	return (
		<div className="flex flex-wrap gap-1">
			{hasRole(user.role, "admin") ? (
				<Badge>{m.admin_role_admin()}</Badge>
			) : (
				<Badge variant="secondary">{m.admin_role_user()}</Badge>
			)}
			{user.banned && (
				<Badge variant="destructive">{m.admin_status_banned()}</Badge>
			)}
			{user.emailVerified === false && (
				<Badge variant="outline">{m.admin_status_unverified()}</Badge>
			)}
		</div>
	);
}

/** Avatar, name and email, for table rows. */
export function UserIdentity({
	user,
}: {
	user: { name: string; email: string; image?: string | null };
}) {
	return (
		<div className="flex min-w-0 items-center gap-3">
			<Avatar className="size-8">
				<AvatarImage src={user.image ?? undefined} alt={user.name} />
				<AvatarFallback>{initials(user.name)}</AvatarFallback>
			</Avatar>
			<div className="grid min-w-0 leading-tight">
				<span className="truncate font-medium">{user.name}</span>
				<span className="truncate text-xs text-muted-foreground">
					{user.email}
				</span>
			</div>
		</div>
	);
}
