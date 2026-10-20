import { Outlet } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import {
	SidebarInset,
	SidebarProvider,
} from "@workspace/ui/components/sidebar";
import type { CSSProperties } from "react";
import { AppHeader } from "@/components/shell/app-header";
import { WorkspaceSidebar } from "./components/workspace-sidebar";
import { useWorkspace } from "./workspace.context";

// Same shell as the admin console, around the organization's own nav.
export function WorkspacePage() {
	// Every page reads the organization: without it they would only show
	// skeletons, so say so here once, with a retry. (A failed background
	// refetch keeps the organization already loaded, and the page.)
	const { organization, isError, retry } = useWorkspace();
	const failed = isError && organization === undefined;

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
					{failed ? (
						<div className="p-4 md:p-6">
							<Alert variant="destructive">
								<AlertDescription className="flex flex-wrap items-center justify-between gap-2">
									{m.workspace_load_error()}
									<Button variant="outline" size="sm" onClick={retry}>
										{m.workspace_retry()}
									</Button>
								</AlertDescription>
							</Alert>
						</div>
					) : (
						<Outlet />
					)}
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
