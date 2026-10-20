import { createFileRoute, Outlet } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";

export const Route = createFileRoute("/admin/users")({
	component: Outlet,
	staticData: { title: () => m.admin_nav_users() },
});
