import { createFileRoute } from "@tanstack/react-router";
import { RouteError } from "@/components/route-error";
import { WorkspaceContainer } from "@/containers/workspace";
import { requireOrganization } from "@/lib/auth-guards";

export const Route = createFileRoute("/_workspace")({
	beforeLoad: requireOrganization,
	component: WorkspaceContainer,
	// e.g. the guard couldn't load or activate the user's organization.
	errorComponent: RouteError,
});
