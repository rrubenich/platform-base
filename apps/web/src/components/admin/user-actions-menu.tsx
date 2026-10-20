import {
	Delete02Icon,
	Logout03Icon,
	MoreHorizontalIcon,
	ShieldUserIcon,
	UserBlock01Icon,
	UserCheck01Icon,
	UserSwitchIcon,
	ViewIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";
import { Button } from "@workspace/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { useState } from "react";
import type { AdminUserActions } from "@/lib/use-admin-user-actions";
import { BanUserDialog } from "./ban-user-dialog";
import { ConfirmDialog } from "./confirm-dialog";
import { hasRole } from "./user-badges";

export type ManagedUser = {
	id: string;
	name: string;
	email: string;
	role?: string | null;
	banned?: boolean | null;
};

/**
 * Every admin action on a user, in a dropdown. Actions an admin can't take
 * on themselves (ban, delete, impersonate, demote) are left out for their own
 * row.
 */
export function UserActionsMenu({
	user,
	isSelf,
	actions,
	showDetailsLink = false,
	variant = "ghost",
}: {
	user: ManagedUser;
	isSelf: boolean;
	actions: AdminUserActions;
	showDetailsLink?: boolean;
	variant?: "ghost" | "outline";
}) {
	const [isBanOpen, setBanOpen] = useState(false);
	const [isDeleteOpen, setDeleteOpen] = useState(false);
	const isAdmin = hasRole(user.role, "admin");

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<Button
							variant={variant}
							size="icon-sm"
							aria-label={m.admin_actions_for({ name: user.name })}
							disabled={actions.isPending}
						/>
					}
				>
					<HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-56">
					{showDetailsLink && (
						<>
							<DropdownMenuGroup>
								<DropdownMenuItem
									render={
										<Link
											to="/admin/users/$userId"
											params={{ userId: user.id }}
										/>
									}
								>
									<HugeiconsIcon icon={ViewIcon} strokeWidth={2} />
									{m.admin_action_view()}
								</DropdownMenuItem>
							</DropdownMenuGroup>
							<DropdownMenuSeparator />
						</>
					)}
					<DropdownMenuGroup>
						{!isSelf && (
							<DropdownMenuItem
								onClick={() =>
									actions.setRole(user.id, isAdmin ? "user" : "admin")
								}
							>
								<HugeiconsIcon icon={ShieldUserIcon} strokeWidth={2} />
								{isAdmin ? m.admin_action_demote() : m.admin_action_promote()}
							</DropdownMenuItem>
						)}
						{!isSelf && !user.banned && (
							<DropdownMenuItem onClick={() => actions.impersonate(user.id)}>
								<HugeiconsIcon icon={UserSwitchIcon} strokeWidth={2} />
								{m.admin_action_impersonate()}
							</DropdownMenuItem>
						)}
						<DropdownMenuItem onClick={() => actions.revokeSessions(user.id)}>
							<HugeiconsIcon icon={Logout03Icon} strokeWidth={2} />
							{m.admin_action_revoke_sessions()}
						</DropdownMenuItem>
					</DropdownMenuGroup>
					{!isSelf && (
						<>
							<DropdownMenuSeparator />
							<DropdownMenuGroup>
								{user.banned ? (
									<DropdownMenuItem onClick={() => actions.unban(user.id)}>
										<HugeiconsIcon icon={UserCheck01Icon} strokeWidth={2} />
										{m.admin_action_unban()}
									</DropdownMenuItem>
								) : (
									<DropdownMenuItem onClick={() => setBanOpen(true)}>
										<HugeiconsIcon icon={UserBlock01Icon} strokeWidth={2} />
										{m.admin_action_ban()}
									</DropdownMenuItem>
								)}
								<DropdownMenuItem
									variant="destructive"
									onClick={() => setDeleteOpen(true)}
								>
									<HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
									{m.admin_action_delete()}
								</DropdownMenuItem>
							</DropdownMenuGroup>
						</>
					)}
				</DropdownMenuContent>
			</DropdownMenu>
			<BanUserDialog
				user={user}
				open={isBanOpen}
				onOpenChange={setBanOpen}
				onBan={actions.ban}
			/>
			<ConfirmDialog
				open={isDeleteOpen}
				onOpenChange={setDeleteOpen}
				title={m.admin_delete_user_title({ name: user.name })}
				description={m.admin_delete_user_description({ email: user.email })}
				confirmLabel={m.admin_action_delete()}
				onConfirm={() => actions.remove(user.id)}
			/>
		</>
	);
}
