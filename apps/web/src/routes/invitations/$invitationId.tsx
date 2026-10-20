import { createFileRoute } from "@tanstack/react-router";
import { InvitationContainer } from "@/containers/invitation";

export const Route = createFileRoute("/invitations/$invitationId")({
	validateSearch: (search: Record<string, unknown>): { email?: string } =>
		typeof search.email === "string" ? { email: search.email } : {},
	component: InvitationContainer,
});
