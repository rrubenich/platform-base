import { createAccessControl } from "better-auth/plugins/access";
import {
	adminAc,
	defaultStatements,
	userAc,
} from "better-auth/plugins/admin/access";

// Every resource/action the admin plugin can authorize: Better Auth's own
// (`user`, `session`) plus app-specific ones, granted per role below.
export const statements = {
	...defaultStatements,
	// Cross-tenant management of every organization, its members and teams
	// (the /api/admin/organizations routes). Unrelated to the organization
	// plugin's own per-org `member.role` permissions.
	organization: ["list", "create", "update", "delete"],
	"organization-member": ["create", "update", "delete"],
	team: ["create", "update", "delete"],
	// The admin console's docs assistant (/api/admin/docs-assistant).
	"docs-assistant": ["use"],
} as const;

export const ac = createAccessControl(statements);

// Platform-wide roles, stored in `user.role` (comma-separated for several).
// Distinct from organization roles (`member.role`), which scope a user's
// access inside one tenant.
export const roles = {
	user: ac.newRole({ ...userAc.statements }),
	admin: ac.newRole({
		...adminAc.statements,
		organization: ["list", "create", "update", "delete"],
		"organization-member": ["create", "update", "delete"],
		team: ["create", "update", "delete"],
		"docs-assistant": ["use"],
	}),
};

export type Role = keyof typeof roles;

export type Permissions = {
	[
		Resource in keyof typeof statements
	]?: (typeof statements)[Resource][number][];
};
