import { useQuery } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext } from "react";
import { useWorkspace } from "@/containers/workspace/workspace.context";
import { authClient } from "@/lib/auth-client";
import {
	ORGANIZATION_QUERY_KEY,
	type OrganizationDetails,
	type OrganizationMember,
} from "@/lib/organization";

const RECENT_MEMBERS = 5;

type DashboardContextValue = {
	isLoading: boolean;
	/** Loading the viewer's teams failed. */
	isTeamsError: boolean;
	memberCount: number | undefined;
	teamCount: number | undefined;
	pendingInvitationCount: number | undefined;
	/** The teams the viewer belongs to; undefined while loading. */
	myTeams: { id: string; name: string }[] | undefined;
	recentMembers: OrganizationMember[];
	canInvite: boolean;
	canCreateTeam: boolean;
};

const DashboardContext = createContext<DashboardContextValue | undefined>(
	undefined,
);

export function DashboardProvider({ children }: { children: ReactNode }) {
	// The workspace shell shows the organization's own load error.
	const { organization, isLoading, can } = useWorkspace();
	const details = organization as OrganizationDetails | undefined;

	const { data: myTeams, isError: isTeamsError } = useQuery({
		queryKey: [...ORGANIZATION_QUERY_KEY, "my-teams"],
		queryFn: async () => {
			const { data, error } = await authClient.organization.listUserTeams();
			if (error) throw new Error(error.message);
			return (data ?? []) as { id: string; name: string }[];
		},
	});

	const recentMembers = [...(details?.members ?? [])]
		.sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
		)
		.slice(0, RECENT_MEMBERS);

	return (
		<DashboardContext.Provider
			value={{
				isLoading,
				isTeamsError,
				memberCount: details?.members.length,
				teamCount: details ? (details.teams ?? []).length : undefined,
				pendingInvitationCount: details?.invitations.filter(
					({ status }) => status === "pending",
				).length,
				myTeams,
				recentMembers,
				canInvite: can({ invitation: ["create"] }),
				canCreateTeam: can({ team: ["create"] }),
			}}
		>
			{children}
		</DashboardContext.Provider>
	);
}

export function useDashboardContext() {
	const context = useContext(DashboardContext);

	if (context === undefined) {
		throw new Error(
			"useDashboardContext must be used within a DashboardProvider",
		);
	}

	return context;
}
