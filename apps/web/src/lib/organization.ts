import { authClient } from "@/lib/auth-client";

export const ORGANIZATION_QUERY_KEY = ["organization"] as const;

export type OrgRole = "owner" | "admin" | "member";

/** Whether `role` holds every one of `permissions` (false without a role). */
export function can(
	role: OrgRole | undefined,
	permissions: Record<string, string[]>,
): boolean {
	if (!role) return false;
	return authClient.organization.checkRolePermission({ role, permissions });
}

// The client types `getFullOrganization` loosely (`any`), so the shape the
// workspace features read is spelled out here.
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
export type OrganizationTeam = {
	id: string;
	name: string;
	/** Kept in step by the plugin as members join and leave the team. */
	memberCount?: number;
};
export type OrganizationDetails = {
	id: string;
	name: string;
	slug?: string;
	members: OrganizationMember[];
	invitations: OrganizationInvitation[];
	teams?: OrganizationTeam[];
};
