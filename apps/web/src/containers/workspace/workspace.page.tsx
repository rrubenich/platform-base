import { Outlet } from "@tanstack/react-router";
import {
	SidebarInset,
	SidebarProvider,
} from "@workspace/ui/components/sidebar";
import { Toaster } from "@workspace/ui/components/sonner";
import type { CSSProperties } from "react";
import { AppHeader } from "@/components/shell/app-header";
import { useTheme } from "@/components/theme-provider";
import { WorkspaceSidebar } from "./components/workspace-sidebar";

// Same shell as the admin console, around the organization's own nav.
export function WorkspacePage() {
	const { theme } = useTheme();

	return (
		<SidebarProvider
			style={
				{ "--header-height": "calc(var(--spacing) * 12)" } as CSSProperties
			}
		>
			<WorkspaceSidebar />
			<SidebarInset>
				<AppHeader />
				<div className="@container/main flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
					<Outlet />
				</div>
			</SidebarInset>
			<Toaster theme={theme} position="bottom-right" />
		</SidebarProvider>
	);
}
