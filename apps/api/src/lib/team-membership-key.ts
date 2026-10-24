import { createHash } from "node:crypto";

/**
 * The organization plugin's team membership key: a hash of [teamId, userId]
 * behind a unique index. Mirrors `computeTeamMembershipKey` in
 * better-auth/dist/plugins/organization/adapter.mjs so rows written outside
 * the plugin are indistinguishable from the plugin's own.
 */
export function teamMembershipKey(teamId: string, userId: string): string {
	return createHash("sha256")
		.update(JSON.stringify([teamId, userId]))
		.digest("base64url");
}
