import { createFileRoute } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";
import { AdminOrganizationContainer } from "@/containers/admin-organization";

export const Route = createFileRoute("/admin/organizations/$organizationId")({
	component: AdminOrganizationContainer,
	staticData: { title: () => m.admin_breadcrumb_organization() },
});
