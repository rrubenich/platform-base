import {
	Building03Icon,
	DashboardSquare01Icon,
	ShieldUserIcon,
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
import type { ComponentProps } from "react";
import { useAdminContext } from "../admin.context";
import { type NavItem, NavMain } from "@/components/shell/nav-main";
import { NavUser } from "./nav-user";

// The sidebar-07 block: collapses to icons, with collapsible groups.
export function AdminSidebar(props: ComponentProps<typeof Sidebar>) {
	const { user, signOut } = useAdminContext();

	const items: NavItem[] = [
		{
			title: m.admin_nav_dashboard(),
			to: "/admin",
			icon: <HugeiconsIcon icon={DashboardSquare01Icon} strokeWidth={2} />,
		},
		{
			title: m.admin_nav_users(),
			to: "/admin/users",
			icon: <HugeiconsIcon icon={UserGroupIcon} strokeWidth={2} />,
			items: [
				{ title: m.admin_nav_users_all(), to: "/admin/users" },
				{
					title: m.admin_nav_users_admins(),
					to: "/admin/users",
					search: { filter: "admins" },
				},
				{
					title: m.admin_nav_users_banned(),
					to: "/admin/users",
					search: { filter: "banned" },
				},
			],
		},
		{
			title: m.admin_nav_organizations(),
			to: "/admin/organizations",
			icon: <HugeiconsIcon icon={Building03Icon} strokeWidth={2} />,
		},
	];

	return (
		<Sidebar collapsible="icon" {...props}>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton size="lg" render={<Link to="/admin" />}>
							<div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
								<HugeiconsIcon icon={ShieldUserIcon} strokeWidth={2} />
							</div>
							<div className="grid flex-1 text-left text-sm leading-tight">
								<span className="truncate font-medium">Platform Base</span>
								<span className="truncate text-xs">
									{m.admin_console_subtitle()}
								</span>
							</div>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				<NavMain label={m.admin_nav_label()} items={items} />
			</SidebarContent>
			<SidebarFooter>
				{user && <NavUser user={user} onSignOut={signOut} />}
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
