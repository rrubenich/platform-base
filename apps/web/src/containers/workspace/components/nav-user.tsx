import {
	Logout03Icon,
	LogoutIcon,
	SecurityCheckIcon,
	UnfoldMoreIcon,
	UserCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@workspace/ui/components/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@workspace/ui/components/sidebar";
import { initials } from "@/lib/initials";
import type { WorkspaceUser } from "../workspace.context";

function UserSummary({ user }: { user: WorkspaceUser }) {
	return (
		<>
			<Avatar>
				<AvatarImage src={user.image ?? undefined} alt={user.name} />
				<AvatarFallback>{initials(user.name)}</AvatarFallback>
			</Avatar>
			<div className="grid flex-1 text-left text-sm leading-tight">
				<span className="truncate font-medium">{user.name}</span>
				<span className="truncate text-xs">{user.email}</span>
			</div>
		</>
	);
}

export function NavUser({
	user,
	onSignOut,
	onLeaveOrganization,
}: {
	user: WorkspaceUser;
	onSignOut: () => void;
	/** Shown as "Leave organization" when given. */
	onLeaveOrganization?: () => void;
}) {
	const { isMobile } = useSidebar();

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />
						}
					>
						<UserSummary user={user} />
						<HugeiconsIcon
							icon={UnfoldMoreIcon}
							strokeWidth={2}
							className="ml-auto"
						/>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						className="w-fit"
						side={isMobile ? "bottom" : "right"}
						align="end"
						sideOffset={4}
					>
						<DropdownMenuGroup>
							<DropdownMenuLabel className="p-0 font-normal">
								<div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
									<UserSummary user={user} />
								</div>
							</DropdownMenuLabel>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							<DropdownMenuItem render={<Link to="/settings/account" />}>
								<HugeiconsIcon icon={UserCircleIcon} strokeWidth={2} />
								{m.org_account_settings()}
							</DropdownMenuItem>
							<DropdownMenuItem render={<Link to="/settings/security" />}>
								<HugeiconsIcon icon={SecurityCheckIcon} strokeWidth={2} />
								{m.org_security_settings()}
							</DropdownMenuItem>
							{onLeaveOrganization && (
								<DropdownMenuItem onClick={onLeaveOrganization}>
									<HugeiconsIcon icon={Logout03Icon} strokeWidth={2} />
									{m.org_settings_leave_title()}
								</DropdownMenuItem>
							)}
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							<DropdownMenuItem onClick={onSignOut}>
								<HugeiconsIcon icon={LogoutIcon} strokeWidth={2} />
								{m.org_sign_out()}
							</DropdownMenuItem>
						</DropdownMenuGroup>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
