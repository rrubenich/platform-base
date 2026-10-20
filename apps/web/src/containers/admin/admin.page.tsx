import { Outlet } from "@tanstack/react-router";
import {
	SidebarInset,
	SidebarProvider,
} from "@workspace/ui/components/sidebar";
import type { CSSProperties } from "react";
import { AppHeader } from "@/components/shell/app-header";
import { AdminSidebar } from "./components/admin-sidebar";

// dashboard-01's layout, around the sidebar-07 sidebar.
export function AdminPage() {
	return (
		<SidebarProvider
			style={
				{ "--header-height": "calc(var(--spacing) * 12)" } as CSSProperties
			}
		>
			<AdminSidebar />
			<SidebarInset>
				<AppHeader />
				<div className="@container/main flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
					<Outlet />
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
