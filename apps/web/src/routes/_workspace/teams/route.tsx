import { createFileRoute, Outlet } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";

export const Route = createFileRoute("/_workspace/teams")({
	component: Outlet,
	staticData: { title: () => m.org_nav_teams() },
});
