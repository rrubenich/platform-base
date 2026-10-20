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
