import { createFileRoute } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";
import { AdminContainer } from "@/containers/admin";
import { requireAdmin } from "@/lib/auth-guards";

export const Route = createFileRoute("/admin")({
	beforeLoad: requireAdmin,
	component: AdminContainer,
	staticData: { title: () => m.admin_breadcrumb_root() },
});
