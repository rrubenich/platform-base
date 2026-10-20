import { createFileRoute } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";
import { AdminDashboardContainer } from "@/containers/admin-dashboard";

export const Route = createFileRoute("/admin/")({
	component: AdminDashboardContainer,
	staticData: { title: () => m.admin_nav_dashboard() },
});
