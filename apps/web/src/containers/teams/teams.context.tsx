import { m } from "@workspace/i18n/messages";
import { createContext, type ReactNode, useContext } from "react";
import { useWorkspace } from "@/containers/workspace/workspace.context";
import { authClient } from "@/lib/auth-client";
import type { OrganizationTeam } from "@/lib/organization";
import { useOrganizationAction } from "@/lib/use-organization-action";

type TeamsContextValue = {
	teams: OrganizationTeam[];
	isLoading: boolean;
	can: (permissions: Record<string, string[]>) => boolean;
	isPending: boolean;
	/** Resolve to an error message for the dialog, or null once saved. */
	create: (name: string) => Promise<string | null>;
	rename: (teamId: string, name: string) => Promise<string | null>;
	remove: (teamId: string) => void;
};

const TeamsContext = createContext<TeamsContextValue | undefined>(undefined);

export function TeamsProvider({ children }: { children: ReactNode }) {
	const { organization, isLoading, can } = useWorkspace();
	const { submit, fire, isPending } = useOrganizationAction();

	const value: TeamsContextValue = {
		teams: (organization?.teams ?? []) as OrganizationTeam[],
		isLoading,
		can,
		isPending,
		create: (name) =>
			submit(() => authClient.organization.createTeam({ name }), {
				success: m.teams_toast_created(),
				fallback: m.teams_create_error(),
			}),
		rename: (teamId, name) =>
			submit(
				() => authClient.organization.updateTeam({ teamId, data: { name } }),
				{
					success: m.teams_toast_renamed(),
					fallback: m.teams_rename_error(),
				},
			),
		remove: (teamId) =>
			fire(() => authClient.organization.removeTeam({ teamId }), {
				success: m.teams_toast_deleted(),
				fallback: m.teams_action_error(),
			}),
	};

	return (
		<TeamsContext.Provider value={value}>{children}</TeamsContext.Provider>
	);
}

export function useTeamsContext() {
	const context = useContext(TeamsContext);

	if (context === undefined) {
		throw new Error("useTeamsContext must be used within a TeamsProvider");
	}

	return context;
}
