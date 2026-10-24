import { useQueries, useQuery } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext } from "react";
import { useWorkspace } from "@/containers/workspace/workspace.context";
import { authClient } from "@/lib/auth-client";
import {
	isPendingInvitation,
	ORGANIZATION_QUERY_KEY,
	type OrganizationDetails,
	type OrganizationInvitation,
	type OrganizationMember,
	type OrgRole,
} from "@/lib/organization";

const RECENT_MEMBERS = 5;
const PENDING_INVITATIONS = 5;

export type SetupStep = "invite" | "team" | "assign";

export type TeamWithMembers = {
	id: string;
	name: string;
	/** Undefined while the team's members are loading. */
	members: OrganizationMember[] | undefined;
};

type DashboardContextValue = {
	isLoading: boolean;
	/** Owners and admins get the organization overview; members their hub. */
	isManager: boolean;
	viewerName: string;
	viewerRole: OrgRole | undefined;
	organizationName: string;
	/** Loading the viewer's teams failed. */
	isTeamsError: boolean;
	memberCount: number | undefined;
	teamCount: number | undefined;
	pendingInvitationCount: number | undefined;
	/** The teams the viewer belongs to; undefined while loading. */
	myTeams: { id: string; name: string }[] | undefined;
	/** The viewer's teams with the people in them (the member hub). */
	myTeamsWithMembers: TeamWithMembers[] | undefined;
	recentMembers: OrganizationMember[];
	/** The soonest to expire first. */
	pendingInvitations: OrganizationInvitation[];
	/** First-run steps for a new organization, each with whether it's done. */
	setupSteps: { step: SetupStep; done: boolean }[];
	/** Owners and admins other than the viewer: who a member asks for help. */
	contacts: OrganizationMember[];
	canInvite: boolean;
	canCreateTeam: boolean;
};

const DashboardContext = createContext<DashboardContextValue | undefined>(
	undefined,
);

const time = (value: Date | string | undefined) =>
	value ? new Date(value).getTime() : 0;

export function DashboardProvider({ children }: { children: ReactNode }) {
	// The workspace shell shows the organization's own load error.
	const { organization, isLoading, can, role, user, userId } = useWorkspace();
	const details = organization as OrganizationDetails | undefined;
	const members = details?.members ?? [];
	const teams = details?.teams ?? [];
	const isManager = can({ invitation: ["create"] });

	const { data: myTeams, isError: isTeamsError } = useQuery({
		queryKey: [...ORGANIZATION_QUERY_KEY, "my-teams"],
		queryFn: async () => {
			const { data, error } = await authClient.organization.listUserTeams();
			if (error) throw new Error(error.message);
			return (data ?? []) as { id: string; name: string }[];
		},
	});

	// Only the member hub shows who is in each of the viewer's teams.
	const teamMembers = useQueries({
		queries: (isManager ? [] : (myTeams ?? [])).map((team) => ({
			queryKey: [...ORGANIZATION_QUERY_KEY, "team", team.id],
			queryFn: async () => {
				const { data, error } = await authClient.$fetch<{ userId: string }[]>(
					"/organization/team-members",
					{ method: "GET", query: { teamId: team.id } },
				);
				if (error) throw new Error(error.message);
				return (data ?? []).map(({ userId }) => userId);
			},
		})),
	});

	const myTeamsWithMembers = myTeams?.map((team, index) => {
		const userIds = teamMembers[index]?.data;
		return {
			...team,
			members: userIds
				? members.filter((member) => userIds.includes(member.userId))
				: undefined,
		};
	});

	const recentMembers = [...members]
		.sort((a, b) => time(b.createdAt) - time(a.createdAt))
		.slice(0, RECENT_MEMBERS);

	const pending = (details?.invitations ?? []).filter((invitation) =>
		isPendingInvitation(invitation),
	);

	// Every organization starts with a default team (the oldest one), so the
	// "team" steps look at the teams made after it.
	const createdTeams = [...teams]
		.sort((a, b) => time(a.createdAt) - time(b.createdAt))
		.slice(1);
	const setupSteps: DashboardContextValue["setupSteps"] = [
		{ step: "invite", done: members.length > 1 || pending.length > 0 },
		{ step: "team", done: createdTeams.length > 0 },
		{
			step: "assign",
			done: createdTeams.some((team) => (team.memberCount ?? 0) > 0),
		},
	];

	return (
		<DashboardContext.Provider
			value={{
				isLoading,
				isManager,
				viewerName: user?.name.split(" ")[0] ?? "",
				viewerRole: role,
				organizationName: details?.name ?? "",
				isTeamsError,
				memberCount: details?.members.length,
				teamCount: details ? teams.length : undefined,
				pendingInvitationCount: details ? pending.length : undefined,
				myTeams,
				myTeamsWithMembers,
				recentMembers,
				pendingInvitations: [...pending]
					.sort((a, b) => time(a.expiresAt) - time(b.expiresAt))
					.slice(0, PENDING_INVITATIONS),
				setupSteps,
				contacts: members.filter(
					(member) =>
						member.userId !== userId &&
						(member.role === "owner" || member.role === "admin"),
				),
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
