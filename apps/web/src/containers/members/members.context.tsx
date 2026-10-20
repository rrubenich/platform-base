import { m } from "@workspace/i18n/messages";
import { createContext, type ReactNode, useContext } from "react";
import { useWorkspace } from "@/containers/workspace/workspace.context";
import { authClient } from "@/lib/auth-client";
import {
	isPendingInvitation,
	type OrganizationDetails,
	type OrganizationInvitation,
	type OrgRole,
} from "@/lib/organization";
import { useOrganizationAction } from "@/lib/use-organization-action";

export type {
	OrganizationInvitation,
	OrganizationMember,
} from "@/lib/organization";
export type MembersOrganization = OrganizationDetails;

type MembersContextValue = {
	organization: MembersOrganization | undefined;
	/** Invitations that can still be accepted (pending and not expired). */
	pendingInvitations: OrganizationInvitation[];
	isLoading: boolean;
	userId: string | undefined;
	viewerRole: OrgRole | undefined;
	can: (permissions: Record<string, string[]>) => boolean;
	isPending: boolean;
	/** Resolves to an error message for the form, or null once sent. */
	invite: (input: {
		email: string;
		role: OrgRole;
		teamId?: string;
	}) => Promise<string | null>;
	resend: (invitation: OrganizationInvitation) => void;
	cancel: (invitationId: string) => void;
	updateRole: (memberId: string, role: OrgRole) => void;
	remove: (memberId: string) => void;
};

const MembersContext = createContext<MembersContextValue | undefined>(
	undefined,
);

export function MembersProvider({ children }: { children: ReactNode }) {
	const { organization, isLoading, userId, role, can } = useWorkspace();
	const { submit, fire, isPending } = useOrganizationAction();
	const details = organization as MembersOrganization | undefined;

	const act = (request: Parameters<typeof fire>[0], success: string) =>
		fire(request, { success, fallback: m.members_action_error() });

	const value: MembersContextValue = {
		organization: details,
		pendingInvitations:
			details?.invitations.filter((invitation) =>
				isPendingInvitation(invitation),
			) ?? [],
		isLoading,
		userId,
		viewerRole: role,
		can,
		isPending,
		invite: ({ email, role: inviteRole, teamId }) =>
			submit(
				() =>
					authClient.organization.inviteMember({
						email,
						role: inviteRole,
						teamId,
					}),
				{
					success: m.members_toast_invited(),
					fallback: m.members_invite_error(),
				},
			),
		resend: (invitation) =>
			act(
				() =>
					authClient.organization.inviteMember({
						email: invitation.email,
						role: (invitation.role ?? "member") as OrgRole,
						teamId: invitation.teamId ?? undefined,
						resend: true,
					}),
				m.members_toast_resent(),
			),
		cancel: (invitationId) =>
			act(
				() => authClient.organization.cancelInvitation({ invitationId }),
				m.members_toast_cancelled(),
			),
		updateRole: (memberId, newRole) =>
			act(
				() =>
					authClient.organization.updateMemberRole({
						memberId,
						role: newRole,
					}),
				m.members_toast_role_updated(),
			),
		remove: (memberId) =>
			act(
				() =>
					authClient.organization.removeMember({ memberIdOrEmail: memberId }),
				m.members_toast_removed(),
			),
	};

	return (
		<MembersContext.Provider value={value}>{children}</MembersContext.Provider>
	);
}

export function useMembersContext() {
	const context = useContext(MembersContext);

	if (context === undefined) {
		throw new Error("useMembersContext must be used within a MembersProvider");
	}

	return context;
}
