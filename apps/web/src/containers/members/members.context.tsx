import { useMutation, useQueryClient } from "@tanstack/react-query";
import { m } from "@workspace/i18n/messages";
import { createContext, type ReactNode, useContext } from "react";
import { toast } from "sonner";
import { useWorkspace } from "@/containers/workspace/workspace.context";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-error";
import { ORGANIZATION_QUERY_KEY, type OrgRole } from "@/lib/organization";

type AuthResult = {
	error?: { message?: string; status?: number } | null;
};

// The client types `getFullOrganization` loosely (`any`), so the shape this
// feature reads is spelled out here.
export type OrganizationMember = {
	id: string;
	userId: string;
	role: string;
	createdAt: Date | string;
	user: { id: string; name: string; email: string; image?: string | null };
};
export type OrganizationInvitation = {
	id: string;
	email: string;
	role?: string | null;
	status: string;
	teamId?: string | null;
	expiresAt: Date | string;
};
export type MembersOrganization = {
	id: string;
	name: string;
	members: OrganizationMember[];
	invitations: OrganizationInvitation[];
	teams?: { id: string; name: string }[];
};

type MembersContextValue = {
	organization: MembersOrganization | undefined;
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
	const queryClient = useQueryClient();

	const mutation = useMutation({
		mutationFn: async ({
			request,
		}: {
			request: () => Promise<AuthResult>;
			success: string;
		}) => {
			const { error } = await request();
			if (error) {
				throw Object.assign(new Error(error.message), {
					status: error.status,
				});
			}
		},
		onSuccess: async (_data, { success }) => {
			toast.success(success);
			await queryClient.invalidateQueries({ queryKey: ORGANIZATION_QUERY_KEY });
		},
	});

	/** For the dialog: the error comes back to show inline. */
	const submit = (
		request: () => Promise<AuthResult>,
		success: string,
		fallback: string,
	) =>
		mutation.mutateAsync({ request, success }).then(
			() => null,
			(error: { status?: number; message?: string }) =>
				authErrorMessage(error, fallback),
		);

	/** For one-click actions: the error is toasted. */
	const fire = (request: () => Promise<AuthResult>, success: string) =>
		void submit(request, success, m.members_action_error()).then((error) => {
			if (error) toast.error(error);
		});

	const value: MembersContextValue = {
		organization: organization as MembersOrganization | undefined,
		isLoading,
		userId,
		viewerRole: role,
		can,
		isPending: mutation.isPending,
		invite: ({ email, role: inviteRole, teamId }) =>
			submit(
				() =>
					authClient.organization.inviteMember({
						email,
						role: inviteRole,
						teamId,
					}),
				m.members_toast_invited(),
				m.members_invite_error(),
			),
		resend: (invitation) =>
			fire(
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
			fire(
				() => authClient.organization.cancelInvitation({ invitationId }),
				m.members_toast_cancelled(),
			),
		updateRole: (memberId, newRole) =>
			fire(
				() =>
					authClient.organization.updateMemberRole({
						memberId,
						role: newRole,
					}),
				m.members_toast_role_updated(),
			),
		remove: (memberId) =>
			fire(
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
