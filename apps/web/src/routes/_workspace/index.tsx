import { createFileRoute } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";
import { DashboardContainer } from "@/containers/dashboard";

export const Route = createFileRoute("/_workspace/")({
	staticData: { title: () => m.org_nav_dashboard() },
	component: DashboardContainer,
});
