import { createFileRoute } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";
import { OrganizationSettingsContainer } from "@/containers/organization-settings";

export const Route = createFileRoute("/_workspace/settings/organization")({
	staticData: { title: () => m.org_nav_settings() },
	component: OrganizationSettingsContainer,
});
