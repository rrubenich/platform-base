import { createFileRoute } from "@tanstack/react-router";
import {
	AdminOrganizationsContainer,
	parseOrganizationsSearch,
} from "@/containers/admin-organizations";

export const Route = createFileRoute("/admin/organizations/")({
	validateSearch: parseOrganizationsSearch,
	component: AdminOrganizationsContainer,
});
