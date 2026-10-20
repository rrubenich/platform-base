import { createFileRoute } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";
import { MembersContainer, parseMembersSearch } from "@/containers/members";

export const Route = createFileRoute("/_workspace/members")({
	staticData: { title: () => m.org_nav_members() },
	validateSearch: parseMembersSearch,
	component: MembersContainer,
});
