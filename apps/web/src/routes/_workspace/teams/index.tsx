import { createFileRoute } from "@tanstack/react-router";
import { parseTeamsSearch, TeamsContainer } from "@/containers/teams";

export const Route = createFileRoute("/_workspace/teams/")({
	validateSearch: parseTeamsSearch,
	component: TeamsContainer,
});
