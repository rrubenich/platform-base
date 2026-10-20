import { createFileRoute } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";
import { TeamContainer } from "@/containers/team";

export const Route = createFileRoute("/_workspace/teams/$teamId")({
	staticData: { title: () => m.teams_breadcrumb_team() },
	component: TeamContainer,
});
