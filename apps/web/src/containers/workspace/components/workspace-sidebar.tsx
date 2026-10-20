import { DashboardSquare01Icon } from "@hugeicons/core-free-icons";
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
import { type NavItem, NavMain } from "@/components/shell/nav-main";
import { initials } from "@/lib/initials";
import { useWorkspace } from "../workspace.context";
import { NavUser } from "./nav-user";

// The sidebar-07 block, headed by the organization instead of the product.
export function WorkspaceSidebar(props: ComponentProps<typeof Sidebar>) {
	const { organization, user, signOut } = useWorkspace();

	// Later tasks append Members, Teams and Settings.
	const items: NavItem[] = [
		{
			title: m.org_nav_dashboard(),
			to: "/",
			icon: <HugeiconsIcon icon={DashboardSquare01Icon} strokeWidth={2} />,
		},
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
				{user && <NavUser user={user} onSignOut={signOut} />}
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
