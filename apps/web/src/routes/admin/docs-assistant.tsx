import { createFileRoute } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";
import { AdminDocsAssistantContainer } from "@/containers/admin-docs-assistant";

export const Route = createFileRoute("/admin/docs-assistant")({
	component: AdminDocsAssistantContainer,
	staticData: { title: () => m.admin_nav_docs_assistant() },
});
