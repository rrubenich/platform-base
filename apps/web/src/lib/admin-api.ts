import { apiJson } from "@/lib/api";
import { authClient } from "@/lib/auth-client";

// Client for the superadmin routes in apps/api/src/admin. User management
// goes through Better Auth's admin plugin (`authClient.admin.*`) instead.

export type AdminStats = {
	users: number;
	admins: number;
	bannedUsers: number;
	organizations: number;
	teams: number;
	activeSessions: number;
	impersonatedSessions: number;
};

export type GrowthPoint = {
	/** YYYY-MM-DD (UTC). */
	date: string;
	users: number;
	organizations: number;
};

export const MEMBER_ROLES = ["owner", "admin", "member"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export type OrganizationSummary = {
	id: string;
	name: string;
	slug: string;
	logo: string | null;
	createdAt: string;
	memberCount: number;
	teamCount: number;
};

export type OrganizationMember = {
	id: string;
	role: string;
	createdAt: string;
	user: { id: string; name: string; email: string; image: string | null };
};

export type OrganizationTeam = {
	id: string;
	name: string;
	createdAt: string;
	memberCount: number;
	userIds: string[];
};

/** The owner's account invitation while they haven't set up their login. */
export type OwnerSetup = {
	id: string;
	email: string;
	expiresAt: string;
	status: "pending" | "expired";
};

export type OrganizationDetail = Omit<
	OrganizationSummary,
	"memberCount" | "teamCount"
> & {
	members: OrganizationMember[];
	teams: OrganizationTeam[];
	invitations: {
		id: string;
		email: string;
		role: string | null;
		teamId: string | null;
		expiresAt: string;
	}[];
	ownerSetup: OwnerSetup | null;
};

const orgPath = (id: string) =>
	`/admin/organizations/${encodeURIComponent(id)}`;

export const adminApi = {
	stats: () => apiJson<AdminStats>("/admin/stats"),

	growth: (days: number) =>
		apiJson<GrowthPoint[]>(`/admin/stats/growth?days=${days}`),

	listOrganizations: (query: {
		search?: string;
		limit: number;
		offset: number;
	}) => {
		const params = new URLSearchParams({
			limit: String(query.limit),
			offset: String(query.offset),
		});
		if (query.search) params.set("search", query.search);
		return apiJson<{ organizations: OrganizationSummary[]; total: number }>(
			`/admin/organizations?${params}`,
		);
	},

	getOrganization: (id: string) => apiJson<OrganizationDetail>(orgPath(id)),

	createOrganization: (body: {
		name: string;
		slug: string;
		ownerUserId: string;
	}) =>
		apiJson<OrganizationDetail>("/admin/organizations", {
			method: "POST",
			body,
		}),

	/** Creates the account (owner of a new organization) and emails its link. */
	inviteClient: (body: {
		email: string;
		organizationName: string;
		slug: string;
	}) =>
		apiJson<{ id: string; organizationId: string; userId: string }>(
			"/admin/account-invitations",
			{ method: "POST", body },
		),

	resendAccountInvitation: (id: string) =>
		apiJson<OwnerSetup>(
			`/admin/account-invitations/${encodeURIComponent(id)}/resend`,
			{ method: "POST" },
		),

	cancelAccountInvitation: (id: string) =>
		apiJson<void>(`/admin/account-invitations/${encodeURIComponent(id)}`, {
			method: "DELETE",
		}),

	accountInvitationsFor: (userIds: string[]) =>
		apiJson<(OwnerSetup & { userId: string })[]>(
			`/admin/account-invitations?${new URLSearchParams({ userIds: userIds.join(",") })}`,
		),

	updateOrganization: (id: string, body: { name?: string; slug?: string }) =>
		apiJson<OrganizationDetail>(orgPath(id), { method: "PATCH", body }),

	deleteOrganization: (id: string) =>
		apiJson<void>(orgPath(id), { method: "DELETE" }),

	addMember: (id: string, body: { userId: string; role: MemberRole }) =>
		apiJson<OrganizationDetail>(`${orgPath(id)}/members`, {
			method: "POST",
			body,
		}),

	updateMemberRole: (id: string, memberId: string, role: MemberRole) =>
		apiJson<OrganizationDetail>(`${orgPath(id)}/members/${memberId}`, {
			method: "PATCH",
			body: { role },
		}),

	removeMember: (id: string, memberId: string) =>
		apiJson<OrganizationDetail>(`${orgPath(id)}/members/${memberId}`, {
			method: "DELETE",
		}),

	createTeam: (id: string, name: string) =>
		apiJson<OrganizationDetail>(`${orgPath(id)}/teams`, {
			method: "POST",
			body: { name },
		}),

	renameTeam: (id: string, teamId: string, name: string) =>
		apiJson<OrganizationDetail>(`${orgPath(id)}/teams/${teamId}`, {
			method: "PATCH",
			body: { name },
		}),

	deleteTeam: (id: string, teamId: string) =>
		apiJson<OrganizationDetail>(`${orgPath(id)}/teams/${teamId}`, {
			method: "DELETE",
		}),

	addTeamMember: (id: string, teamId: string, userId: string) =>
		apiJson<OrganizationDetail>(`${orgPath(id)}/teams/${teamId}/members`, {
			method: "POST",
			body: { userId },
		}),

	removeTeamMember: (id: string, teamId: string, userId: string) =>
		apiJson<OrganizationDetail>(
			`${orgPath(id)}/teams/${teamId}/members/${userId}`,
			{ method: "DELETE" },
		),

	/** Exact-email lookup through the admin plugin, for picking a user. */
	findUserByEmail: async (email: string) => {
		const { data, error } = await authClient.admin.listUsers({
			query: {
				filterField: "email",
				filterOperator: "eq",
				filterValue: email.trim().toLowerCase(),
				limit: 1,
			},
		});
		if (error) throw error;
		return data.users[0] ?? null;
	},
};
