// Mock accounts for trying the product as every kind of user. Written by
// `bun run db:seed` (see seed.ts); everyone signs in with SEED_PASSWORD.

export const SEED_PASSWORD = "Password123!";

export type SeedUser = {
	email: string;
	name: string;
	/** Platform role (`user.role`); "admin" is a superadmin. */
	role: "user" | "admin";
};

export type SeedOrganization = {
	name: string;
	slug: string;
	/** Organization roles, by user email. */
	members: { email: string; role: "owner" | "admin" | "member" }[];
	/** Teams besides the default one (named after the organization, with
	 * every member in it, as the plugin creates it). */
	teams: { name: string; members: string[] }[];
	/** Invitations still waiting for an answer, sent by the first owner. */
	invitations: { email: string; role: "admin" | "member"; team?: string }[];
};

export const SEED_USERS: SeedUser[] = [
	{ email: "superadmin@example.com", name: "Sam Superadmin", role: "admin" },
	{ email: "owner@example.com", name: "Olivia Owner", role: "user" },
	{ email: "admin@example.com", name: "Adam Admin", role: "user" },
	{ email: "member@example.com", name: "Mia Member", role: "user" },
	{ email: "member2@example.com", name: "Max Member", role: "user" },
	{ email: "globex-owner@example.com", name: "Grace Globex", role: "user" },
	{ email: "globex-member@example.com", name: "Gus Globex", role: "user" },
	// Signed up but in no organization yet: lands on /onboarding.
	{ email: "solo@example.com", name: "Sofia Solo", role: "user" },
];

export const SEED_ORGANIZATIONS: SeedOrganization[] = [
	{
		name: "Acme Inc",
		slug: "acme",
		members: [
			{ email: "owner@example.com", role: "owner" },
			{ email: "admin@example.com", role: "admin" },
			{ email: "member@example.com", role: "member" },
			{ email: "member2@example.com", role: "member" },
		],
		teams: [
			{
				name: "Engineering",
				members: ["admin@example.com", "member@example.com"],
			},
			{ name: "Design", members: ["member2@example.com"] },
		],
		invitations: [
			{ email: "invitee@example.com", role: "member", team: "Design" },
		],
	},
	{
		// A second tenant, to check that nothing leaks between organizations.
		name: "Globex",
		slug: "globex",
		members: [
			{ email: "globex-owner@example.com", role: "owner" },
			{ email: "globex-member@example.com", role: "member" },
		],
		teams: [],
		invitations: [],
	},
];
