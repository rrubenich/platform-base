import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceContainer } from "@/containers/workspace";
import { requireOrganization } from "@/lib/auth-guards";

export const Route = createFileRoute("/_workspace")({
	beforeLoad: requireOrganization,
	component: WorkspaceContainer,
});
