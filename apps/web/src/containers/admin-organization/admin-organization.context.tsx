import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";
import { createContext, type ReactNode, useContext } from "react";
import { toast } from "sonner";
import {
	adminApi,
	type MemberRole,
	type OrganizationDetail,
} from "@/lib/admin-api";
import { adminErrorMessage } from "@/lib/admin-errors";

/** Resolves to an error message for the form, or null on success. */
type FormResult = Promise<string | null>;

type AdminOrganizationContextValue = {
	organization: OrganizationDetail | undefined;
	isLoading: boolean;
	isError: boolean;
	isPending: boolean;
	update: (changes: { name: string; slug: string }) => FormResult;
	remove: () => void;
	addMember: (input: { email: string; role: MemberRole }) => FormResult;
	updateMemberRole: (memberId: string, role: MemberRole) => void;
	removeMember: (memberId: string) => void;
	createTeam: (name: string) => FormResult;
	renameTeam: (teamId: string, name: string) => FormResult;
	deleteTeam: (teamId: string) => void;
	setTeamMembership: (teamId: string, userId: string, inTeam: boolean) => void;
};

const AdminOrganizationContext = createContext<
	AdminOrganizationContextValue | undefined
>(undefined);

export function AdminOrganizationProvider({
	children,
}: {
	children: ReactNode;
}) {
	const { organizationId } = useParams({
		from: "/admin/organizations/$organizationId",
	});
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const queryKey = ["admin", "organization", organizationId];

	const organization = useQuery({
		queryKey,
		queryFn: () => adminApi.getOrganization(organizationId),
	});

	// Every change answers with the updated organization.
	const mutation = useMutation({
		mutationFn: ({
			request,
		}: {
			request: () => Promise<OrganizationDetail | undefined>;
			success: string;
		}) => request(),
		onSuccess: async (updated, { success }) => {
			toast.success(success);
			if (updated) queryClient.setQueryData(queryKey, updated);
			await queryClient.invalidateQueries({
				queryKey: ["admin"],
				predicate: (query) => query.queryKey[1] !== "organization",
			});
		},
	});

	/** For dialogs: the error comes back to show inline. */
	const submit = (
		request: () => Promise<OrganizationDetail | undefined>,
		success: string,
	): FormResult =>
		mutation.mutateAsync({ request, success }).then(
			() => null,
			(error: unknown) => adminErrorMessage(error, m.admin_action_error()),
		);

	/** For one-click actions: the error is toasted. */
	const fire = (
		request: () => Promise<OrganizationDetail | undefined>,
		success: string,
	) =>
		void submit(request, success).then((error) => {
			if (error) toast.error(error);
		});

	const value: AdminOrganizationContextValue = {
		organization: organization.data,
		isLoading: organization.isLoading,
		isError: organization.isError,
		isPending: mutation.isPending,
		update: (changes) =>
			submit(
				() => adminApi.updateOrganization(organizationId, changes),
				m.admin_toast_org_updated(),
			),
		remove: () =>
			void adminApi.deleteOrganization(organizationId).then(
				async () => {
					toast.success(m.admin_toast_org_deleted());
					queryClient.removeQueries({ queryKey });
					await queryClient.invalidateQueries({ queryKey: ["admin"] });
					await navigate({ to: "/admin/organizations" });
				},
				(error: unknown) =>
					toast.error(adminErrorMessage(error, m.admin_action_error())),
			),
		addMember: async ({ email, role }) => {
			const user = await adminApi.findUserByEmail(email).catch(() => null);
			if (!user) return m.admin_org_owner_not_found();
			return submit(
				() => adminApi.addMember(organizationId, { userId: user.id, role }),
				m.admin_toast_member_added(),
			);
		},
		updateMemberRole: (memberId, role) =>
			fire(
				() => adminApi.updateMemberRole(organizationId, memberId, role),
				m.admin_toast_member_updated(),
			),
		removeMember: (memberId) =>
			fire(
				() => adminApi.removeMember(organizationId, memberId),
				m.admin_toast_member_removed(),
			),
		createTeam: (name) =>
			submit(
				() => adminApi.createTeam(organizationId, name),
				m.admin_toast_team_created(),
			),
		renameTeam: (teamId, name) =>
			submit(
				() => adminApi.renameTeam(organizationId, teamId, name),
				m.admin_toast_team_updated(),
			),
		deleteTeam: (teamId) =>
			fire(
				() => adminApi.deleteTeam(organizationId, teamId),
				m.admin_toast_team_deleted(),
			),
		setTeamMembership: (teamId, userId, inTeam) =>
			fire(
				() =>
					inTeam
						? adminApi.addTeamMember(organizationId, teamId, userId)
						: adminApi.removeTeamMember(organizationId, teamId, userId),
				m.admin_toast_team_updated(),
			),
	};

	return (
		<AdminOrganizationContext.Provider value={value}>
			{children}
		</AdminOrganizationContext.Provider>
	);
}

export function useAdminOrganizationContext() {
	const context = useContext(AdminOrganizationContext);

	if (context === undefined) {
		throw new Error(
			"useAdminOrganizationContext must be used within an AdminOrganizationProvider",
		);
	}

	return context;
}
