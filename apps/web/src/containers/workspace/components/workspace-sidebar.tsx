import {
	AiChat02Icon,
	DashboardSquare01Icon,
	Settings01Icon,
	UserGroup02Icon,
	UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
} from "@workspace/ui/components/sidebar";
import { type ComponentProps, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { type NavItem, NavMain } from "@/components/shell/nav-main";
import { initials } from "@/lib/initials";
import { useLeaveOrganization } from "@/lib/use-leave-organization";
import { useWorkspace } from "../workspace.context";
import { NavUser } from "./nav-user";

// The sidebar-07 block, headed by the organization instead of the product.
export function WorkspaceSidebar(props: ComponentProps<typeof Sidebar>) {
	const { organization, user, signOut, can } = useWorkspace();
	const { leave } = useLeaveOrganization(organization?.id);
	const [leaveOpen, setLeaveOpen] = useState(false);
	// Owners and admins manage the organization from Settings (leaving
	// included); members get Leave in their user menu instead.
	const canManage = can({ organization: ["update"] });

	const items: NavItem[] = [
		{
			title: m.org_nav_dashboard(),
			to: "/",
			icon: <HugeiconsIcon icon={DashboardSquare01Icon} strokeWidth={2} />,
		},
		{
			title: m.org_nav_members(),
			to: "/members",
			icon: <HugeiconsIcon icon={UserGroupIcon} strokeWidth={2} />,
		},
		{
			title: m.org_nav_teams(),
			to: "/teams",
			icon: <HugeiconsIcon icon={UserGroup02Icon} strokeWidth={2} />,
		},
		{
			title: m.org_nav_assistant(),
			to: "/assistant",
			icon: <HugeiconsIcon icon={AiChat02Icon} strokeWidth={2} />,
		},
		...(canManage
			? [
					{
						title: m.org_nav_settings(),
						to: "/settings/organization",
						icon: <HugeiconsIcon icon={Settings01Icon} strokeWidth={2} />,
					},
				]
			: []),
	];

	return (
		<Sidebar collapsible="icon" {...props}>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton size="lg" render={<Link to="/" />}>
							<div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
								{organization ? initials(organization.name) : null}
							</div>
							<div className="grid flex-1 text-left text-sm leading-tight">
								<span className="truncate font-medium">
									{organization?.name}
								</span>
								<span className="truncate text-xs">Platform Base</span>
							</div>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				<NavMain label={m.org_nav_label()} items={items} />
			</SidebarContent>
			<SidebarFooter>
				{user && (
					<NavUser
						user={user}
						onSignOut={signOut}
						onLeaveOrganization={
							organization && !canManage ? () => setLeaveOpen(true) : undefined
						}
					/>
				)}
			</SidebarFooter>
			<SidebarRail />
			{organization && (
				<ConfirmDialog
					open={leaveOpen}
					onOpenChange={setLeaveOpen}
					title={m.org_settings_leave_confirm_title({
						name: organization.name,
					})}
					description={m.org_settings_leave_confirm_description()}
					confirmLabel={m.org_settings_leave_confirm()}
					onConfirm={() =>
						void leave().then((error) => {
							if (error) toast.error(error);
						})
					}
				/>
			)}
		</Sidebar>
	);
}
