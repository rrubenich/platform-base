import { m } from "@workspace/i18n/messages";
import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@workspace/ui/components/alert";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@workspace/ui/components/avatar";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@workspace/ui/components/card";
import { UserActionsMenu } from "@/components/admin/user-actions-menu";
import { UserBadges } from "@/components/admin/user-badges";
import { formatDate, formatDateTime } from "@/lib/format";
import { initials } from "@/lib/initials";
import { type UserDetail, useAdminUserContext } from "../admin-user.context";

function Detail({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex flex-col gap-1">
			<dt className="text-sm text-muted-foreground">{label}</dt>
			<dd className="text-sm font-medium">{value}</dd>
		</div>
	);
}

export function UserProfileCard({ user }: { user: UserDetail }) {
	const { isSelf, actions } = useAdminUserContext();
	const yesNo = (value: boolean | null | undefined) =>
		value ? m.admin_yes() : m.admin_no();

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center gap-4">
					<Avatar className="size-12">
						<AvatarImage src={user.image ?? undefined} alt={user.name} />
						<AvatarFallback>{initials(user.name)}</AvatarFallback>
					</Avatar>
					<div className="flex min-w-0 flex-col gap-1">
						<CardTitle className="truncate text-xl">{user.name}</CardTitle>
						<CardDescription className="truncate">{user.email}</CardDescription>
					</div>
				</div>
				<CardAction>
					<UserActionsMenu
						user={user}
						isSelf={isSelf}
						actions={actions}
						variant="outline"
					/>
				</CardAction>
			</CardHeader>
			<CardContent className="flex flex-col gap-6">
				<UserBadges user={user} />
				{user.banned && (
					<Alert variant="destructive">
						<AlertTitle>{m.admin_user_banned_title()}</AlertTitle>
						<AlertDescription>
							{[
								user.banReason || m.admin_user_banned_no_reason(),
								user.banExpires
									? m.admin_user_banned_until({
											date: formatDateTime(user.banExpires),
										})
									: m.admin_user_banned_permanent(),
							].join(" · ")}
						</AlertDescription>
					</Alert>
				)}
				<dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<Detail label={m.admin_user_id()} value={user.id} />
					<Detail
						label={m.admin_column_joined()}
						value={formatDate(user.createdAt)}
					/>
					<Detail
						label={m.admin_user_email_verified()}
						value={yesNo(user.emailVerified)}
					/>
					<Detail
						label={m.admin_user_two_factor()}
						value={yesNo(user.twoFactorEnabled)}
					/>
				</dl>
			</CardContent>
		</Card>
	);
}
