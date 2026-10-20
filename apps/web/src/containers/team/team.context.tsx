import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";
import { createContext, type ReactNode, useContext } from "react";
import { useWorkspace } from "@/containers/workspace/workspace.context";
import { authClient } from "@/lib/auth-client";
import {
	ORGANIZATION_QUERY_KEY,
	type OrganizationMember,
	type OrganizationTeam,
} from "@/lib/organization";
import { useOrganizationAction } from "@/lib/use-organization-action";

type TeamContextValue = {
	team: OrganizationTeam | undefined;
	/** The team's members, as organization members. */
	members: OrganizationMember[];
	/** Organization members who are not in the team yet. */
	candidates: OrganizationMember[];
	isLoading: boolean;
	can: (permissions: Record<string, string[]>) => boolean;
	isPending: boolean;
	/** Resolves to an error message for the dialog, or null once added. */
	add: (userId: string) => Promise<string | null>;
	remove: (userId: string) => void;
};

const TeamContext = createContext<TeamContextValue | undefined>(undefined);

export function TeamProvider({ children }: { children: ReactNode }) {
	const { teamId } = useParams({ from: "/_workspace/teams/$teamId" });
	const { organization, isLoading: organizationLoading, can } = useWorkspace();
	const { submit, fire, isPending } = useOrganizationAction();

	const team = (organization?.teams as OrganizationTeam[] | undefined)?.find(
		({ id }) => id === teamId,
	);
	const organizationMembers = (organization?.members ??
		[]) as OrganizationMember[];

	const { data: teamUserIds, isLoading: membersLoading } = useQuery({
		queryKey: [...ORGANIZATION_QUERY_KEY, "team", teamId],
		enabled: team !== undefined,
		queryFn: async () => {
			const { data, error } = await authClient.organization.listTeamMembers({
				query: { teamId },
			});
			if (error) throw new Error(error.message);
			return (data ?? []).map(({ userId }) => userId);
		},
	});

	const inTeam = new Set(teamUserIds);
	const value: TeamContextValue = {
		team,
		members: organizationMembers.filter(({ userId }) => inTeam.has(userId)),
		candidates: organizationMembers.filter(({ userId }) => !inTeam.has(userId)),
		isLoading: organizationLoading || membersLoading,
		can,
		isPending,
		add: (userId) =>
			submit(() => authClient.organization.addTeamMember({ teamId, userId }), {
				success: m.teams_toast_member_added(),
				fallback: m.teams_member_add_error(),
			}),
		remove: (userId) =>
			fire(() => authClient.organization.removeTeamMember({ teamId, userId }), {
				success: m.teams_toast_member_removed(),
				fallback: m.teams_action_error(),
			}),
	};

	return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
}

export function useTeamContext() {
	const context = useContext(TeamContext);

	if (context === undefined) {
		throw new Error("useTeamContext must be used within a TeamProvider");
	}

	return context;
}
