import { SEED_ORGANIZATIONS, SEED_USERS } from "./seed-data.js";

describe("seed data", () => {
	const emails = SEED_USERS.map((seeded) => seeded.email);

	it("has one account per email", () => {
		expect(new Set(emails).size).toBe(emails.length);
	});

	it("covers a superadmin, every organization role and a user without one", () => {
		expect(SEED_USERS.some((seeded) => seeded.role === "admin")).toBe(true);
		const roles = SEED_ORGANIZATIONS.flatMap((org) =>
			org.members.map((member) => member.role),
		);
		expect(new Set(roles)).toEqual(new Set(["owner", "admin", "member"]));
		const inAnOrganization = new Set(
			SEED_ORGANIZATIONS.flatMap((org) => org.members.map((m) => m.email)),
		);
		expect(
			SEED_USERS.some(
				(seeded) =>
					seeded.role === "user" && !inAnOrganization.has(seeded.email),
			),
		).toBe(true);
	});

	it("keeps each user in at most one organization, as the plugin does", () => {
		const memberships = SEED_ORGANIZATIONS.flatMap((org) =>
			org.members.map((member) => member.email),
		);
		expect(new Set(memberships).size).toBe(memberships.length);
	});

	it.each(SEED_ORGANIZATIONS)("$name refers only to its own people", (org) => {
		const members = org.members.map((member) => member.email);
		expect(members.every((email) => emails.includes(email))).toBe(true);
		expect(org.members.some((member) => member.role === "owner")).toBe(true);
		for (const team of org.teams) {
			expect(team.members.every((email) => members.includes(email))).toBe(true);
		}
		const teamNames = org.teams.map((team) => team.name);
		for (const invited of org.invitations) {
			expect(emails).not.toContain(invited.email);
			if (invited.team) expect(teamNames).toContain(invited.team);
		}
	});
});
