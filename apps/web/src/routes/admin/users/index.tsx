import { createFileRoute } from "@tanstack/react-router";
import {
	AdminUsersContainer,
	parseUsersSearch,
} from "@/containers/admin-users";

export const Route = createFileRoute("/admin/users/")({
	validateSearch: parseUsersSearch,
	component: AdminUsersContainer,
});
