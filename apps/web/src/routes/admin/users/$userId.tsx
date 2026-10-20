import { createFileRoute } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";
import { AdminUserContainer } from "@/containers/admin-user";

export const Route = createFileRoute("/admin/users/$userId")({
	component: AdminUserContainer,
	staticData: { title: () => m.admin_breadcrumb_user() },
});
