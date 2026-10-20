import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link, useRouterState } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@workspace/ui/components/collapsible";
import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
} from "@workspace/ui/components/sidebar";
import type { ReactNode } from "react";

export type NavLink = {
	title: string;
	to: string;
	search?: Record<string, string>;
};

export type NavItem = NavLink & {
	icon: ReactNode;
	/** Shown as a collapsible group (sidebar-07) when present. */
	items?: NavLink[];
};

function isCurrent(
	link: NavLink,
	location: { pathname: string; search: Record<string, unknown> },
) {
	const path = location.pathname.replace(/\/$/, "") || "/";
	if (path !== link.to) return false;
	return Object.entries(link.search ?? {}).every(
		([key, value]) => location.search[key] === value,
	);
}

export function NavMain({ items }: { items: NavItem[] }) {
	const location = useRouterState({ select: (state) => state.location });
	const current = { pathname: location.pathname, search: location.search };

	return (
		<SidebarGroup>
			<SidebarGroupLabel>{m.admin_nav_label()}</SidebarGroupLabel>
			<SidebarMenu>
				{items.map((item) =>
					item.items ? (
						<Collapsible
							key={item.title}
							defaultOpen={location.pathname.startsWith(item.to)}
							className="group/collapsible"
							render={<SidebarMenuItem />}
						>
							<CollapsibleTrigger
								render={<SidebarMenuButton tooltip={item.title} />}
							>
								{item.icon}
								<span>{item.title}</span>
								<HugeiconsIcon
									icon={ArrowRight01Icon}
									strokeWidth={2}
									className="ml-auto transition-transform duration-200 group-data-open/collapsible:rotate-90"
								/>
							</CollapsibleTrigger>
							<CollapsibleContent>
								<SidebarMenuSub>
									{item.items.map((subItem) => (
										<SidebarMenuSubItem key={subItem.title}>
											<SidebarMenuSubButton
												isActive={isCurrent(subItem, current)}
												render={
													<Link to={subItem.to} search={subItem.search} />
												}
											>
												<span>{subItem.title}</span>
											</SidebarMenuSubButton>
										</SidebarMenuSubItem>
									))}
								</SidebarMenuSub>
							</CollapsibleContent>
						</Collapsible>
					) : (
						<SidebarMenuItem key={item.title}>
							<SidebarMenuButton
								tooltip={item.title}
								isActive={isCurrent(item, current)}
								render={<Link to={item.to} search={item.search} />}
							>
								{item.icon}
								<span>{item.title}</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
					),
				)}
			</SidebarMenu>
		</SidebarGroup>
	);
}
