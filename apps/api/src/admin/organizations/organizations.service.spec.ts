import { Test } from "@nestjs/testing";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq } from "drizzle-orm";
import { AUTH_INSTANCE } from "../../auth/auth.constants.js";
import { DATABASE_CONNECTION } from "../../database/database.module.js";
import * as schema from "../../database/schema.js";
import { createTestDatabase } from "../../testing/test-database.js";
import {
	type OrganizationDetail,
	OrganizationsService,
	teamMembershipKey,
} from "./organizations.service.js";

// The service against a real (in-memory) Postgres with the app's migrations
// applied, and the production auth config on top of it — so rows the admin
// API writes are checked against what the organization plugin reads.
vi.hoisted(() => {
	process.env.BETTER_AUTH_URL = "http://localhost:3000";
	process.env.WEB_URL = "http://localhost:5173";
});

vi.mock("resend", () => ({
	Resend: class {
		emails = { send: async () => ({ data: { id: "email-id" }, error: null }) };
	},
}));

import { authOptions } from "../../lib/auth.js";

const { db, close } = await createTestDatabase();

const testAuth = betterAuth({
	...authOptions,
	database: drizzleAdapter(db, { provider: "pg", schema }),
	secret: "test-secret-that-is-long-enough-for-better-auth",
});

type OrgApi = {
	listTeamMembers: (input: {
		headers: Headers;
		query: { teamId: string };
	}) => Promise<{ userId: string }[]>;
	addTeamMember: (input: {
		headers: Headers;
		body: { teamId: string; userId: string };
	}) => Promise<unknown>;
	setActiveOrganization: (input: {
		headers: Headers;
		body: { organizationId: string };
	}) => Promise<unknown>;
};
const orgApi = testAuth.api as unknown as OrgApi;

let service: OrganizationsService;
let ownerId: string;
let ownerHeaders: Headers;
let counter = 0;

async function createUser(name: string) {
	const id = `user-${++counter}`;
	await db.insert(schema.user).values({
		id,
		name,
		email: `${id}@example.com`,
		emailVerified: true,
	});
	return id;
}

async function createOrganization(): Promise<OrganizationDetail> {
	const n = ++counter;
	return service.create({
		name: `Org ${n}`,
		slug: `org-${n}`,
		ownerUserId: ownerId,
	});
}

const memberOf = (org: OrganizationDetail, userId: string) => {
	const found = org.members.find(({ user }) => user.id === userId);
	if (!found) throw new Error(`${userId} is not a member`);
	return found;
};

beforeAll(async () => {
	const moduleRef = await Test.createTestingModule({
		providers: [
			OrganizationsService,
			{ provide: DATABASE_CONNECTION, useValue: db },
			{ provide: AUTH_INSTANCE, useValue: testAuth },
		],
	}).compile();
	service = moduleRef.get(OrganizationsService);

	// A real, signed-in owner, to call the plugin's own endpoints with.
	await testAuth.api.signUpEmail({
		body: {
			name: "Olivia Owner",
			email: "owner@example.com",
			password: "s3cret-pass",
		},
	});
	await db
		.update(schema.user)
		.set({ emailVerified: true })
		.where(eq(schema.user.email, "owner@example.com"));
	const signIn = await testAuth.api.signInEmail({
		body: { email: "owner@example.com", password: "s3cret-pass" },
		returnHeaders: true,
	});
	ownerId = signIn.response.user.id;
	const cookie = signIn.headers.get("set-cookie")?.split(";")[0] ?? "";
	ownerHeaders = new Headers({ cookie });
});

afterAll(async () => {
	await close();
});

describe("OrganizationsService", () => {
	describe("create", () => {
		it("makes the user owner and adds the plugin's default team", async () => {
			const org = await createOrganization();

			expect(org.members).toEqual([
				expect.objectContaining({
					role: "owner",
					user: expect.objectContaining({ id: ownerId }),
				}),
			]);
			expect(org.teams).toHaveLength(1);
			expect(org.teams[0].userIds).toEqual([ownerId]);
		});

		it("rejects a slug that's taken", async () => {
			const org = await createOrganization();

			await expect(
				service.create({ name: "Dup", slug: org.slug, ownerUserId: ownerId }),
			).rejects.toMatchObject({ status: 400 });
		});

		it("404s for an unknown owner", async () => {
			await expect(
				service.create({ name: "X", slug: "x-org", ownerUserId: "nobody" }),
			).rejects.toMatchObject({ status: 404 });
		});
	});

	describe("list", () => {
		it("searches name and slug, with counts and a total", async () => {
			const org = await createOrganization();
			await service.createTeam(org.id, "Design");

			const { organizations, total } = await service.list({
				search: org.slug,
				limit: 20,
				offset: 0,
			});

			expect(total).toBe(1);
			expect(organizations).toEqual([
				expect.objectContaining({ id: org.id, memberCount: 1, teamCount: 2 }),
			]);
		});

		it("treats LIKE wildcards in the search literally", async () => {
			await createOrganization();

			const { total } = await service.list({
				search: "%",
				limit: 20,
				offset: 0,
			});

			expect(total).toBe(0);
		});

		it("paginates", async () => {
			const { total } = await service.list({ limit: 1, offset: 0 });
			const page = await service.list({ limit: 1, offset: 1 });

			expect(total).toBeGreaterThan(1);
			expect(page.organizations).toHaveLength(1);
		});
	});

	describe("update", () => {
		it("renames and re-slugs", async () => {
			const org = await createOrganization();

			const updated = await service.update(org.id, {
				name: "Renamed",
				slug: `${org.slug}-renamed`,
			});

			expect(updated).toMatchObject({
				name: "Renamed",
				slug: `${org.slug}-renamed`,
			});
		});

		it("409s on a taken slug", async () => {
			const a = await createOrganization();
			const b = await createOrganization();

			await expect(
				service.update(b.id, { slug: a.slug }),
			).rejects.toMatchObject({ status: 409 });
		});

		it("404s for an unknown organization", async () => {
			await expect(
				service.update("missing", { name: "X" }),
			).rejects.toMatchObject({ status: 404 });
		});
	});

	it("deletes an organization with its members and teams, clearing active sessions", async () => {
		const org = await createOrganization();
		await orgApi.setActiveOrganization({
			headers: ownerHeaders,
			body: { organizationId: org.id },
		});

		await service.remove(org.id);

		await expect(service.get(org.id)).rejects.toMatchObject({ status: 404 });
		expect(
			await db.$count(schema.member, eq(schema.member.organizationId, org.id)),
		).toBe(0);
		expect(
			await db.$count(schema.team, eq(schema.team.organizationId, org.id)),
		).toBe(0);
		expect(
			await db.$count(
				schema.session,
				eq(schema.session.activeOrganizationId, org.id),
			),
		).toBe(0);
	});

	describe("members", () => {
		it("adds an existing user once", async () => {
			const org = await createOrganization();
			const userId = await createUser("Max Member");

			const updated = await service.addMember(org.id, {
				userId,
				role: "member",
			});
			expect(memberOf(updated, userId).role).toBe("member");

			await expect(
				service.addMember(org.id, { userId, role: "admin" }),
			).rejects.toMatchObject({ status: 409 });
		});

		it("changes roles but never leaves the organization without an owner", async () => {
			const org = await createOrganization();
			const owner = memberOf(org, ownerId);

			await expect(
				service.updateMemberRole(org.id, owner.id, "admin"),
			).rejects.toMatchObject({ status: 400 });
			await expect(
				service.removeMember(org.id, owner.id),
			).rejects.toMatchObject({ status: 400 });

			const userId = await createUser("Next Owner");
			const withSecond = await service.addMember(org.id, {
				userId,
				role: "owner",
			});
			const demoted = await service.updateMemberRole(org.id, owner.id, "admin");
			expect(memberOf(demoted, ownerId).role).toBe("admin");
			expect(memberOf(withSecond, userId).role).toBe("owner");
		});

		it("drops a removed member from the organization's teams", async () => {
			const org = await createOrganization();
			const userId = await createUser("Leaving");
			const withMember = await service.addMember(org.id, {
				userId,
				role: "member",
			});
			const [defaultTeam] = withMember.teams;
			await service.addTeamMember(org.id, defaultTeam.id, userId);

			const updated = await service.removeMember(
				org.id,
				memberOf(withMember, userId).id,
			);

			expect(updated.members.map(({ user }) => user.id)).toEqual([ownerId]);
			expect(updated.teams[0]).toMatchObject({
				userIds: [ownerId],
				memberCount: 1,
			});
		});

		it("404s for a member of another organization", async () => {
			const a = await createOrganization();
			const b = await createOrganization();

			await expect(
				service.removeMember(b.id, memberOf(a, ownerId).id),
			).rejects.toMatchObject({ status: 404 });
		});
	});

	describe("teams", () => {
		it("creates, renames and deletes a team", async () => {
			const org = await createOrganization();

			const created = await service.createTeam(org.id, "Engineering");
			const engineering = created.teams.find((t) => t.name === "Engineering");
			expect(engineering).toMatchObject({ memberCount: 0, userIds: [] });
			if (!engineering) return;

			const renamed = await service.renameTeam(org.id, engineering.id, "Eng");
			expect(renamed.teams.map(({ name }) => name)).toContain("Eng");

			const removed = await service.removeTeam(org.id, engineering.id);
			expect(removed.teams.map(({ id }) => id)).not.toContain(engineering.id);
		});

		it("only adds organization members, once, keeping the count", async () => {
			const org = await createOrganization();
			const created = await service.createTeam(org.id, "Ops");
			const ops = created.teams.find((t) => t.name === "Ops");
			if (!ops) throw new Error("no team");
			const outsider = await createUser("Outsider");

			await expect(
				service.addTeamMember(org.id, ops.id, outsider),
			).rejects.toMatchObject({ status: 400 });

			const added = await service.addTeamMember(org.id, ops.id, ownerId);
			expect(added.teams.find((t) => t.id === ops.id)).toMatchObject({
				userIds: [ownerId],
				memberCount: 1,
			});
			await expect(
				service.addTeamMember(org.id, ops.id, ownerId),
			).rejects.toMatchObject({ status: 409 });

			const removed = await service.removeTeamMember(org.id, ops.id, ownerId);
			expect(removed.teams.find((t) => t.id === ops.id)).toMatchObject({
				userIds: [],
				memberCount: 0,
			});
			await expect(
				service.removeTeamMember(org.id, ops.id, ownerId),
			).rejects.toMatchObject({ status: 404 });
		});

		it("writes memberships the organization plugin recognizes", async () => {
			const org = await createOrganization();
			const created = await service.createTeam(org.id, "Support");
			const support = created.teams.find((t) => t.name === "Support");
			if (!support) throw new Error("no team");
			await orgApi.setActiveOrganization({
				headers: ownerHeaders,
				body: { organizationId: org.id },
			});

			await service.addTeamMember(org.id, support.id, ownerId);

			const members = await orgApi.listTeamMembers({
				headers: ownerHeaders,
				query: { teamId: support.id },
			});
			expect(members.map(({ userId }) => userId)).toEqual([ownerId]);
			// Same membership key as the plugin computes: re-adding is a no-op
			// that returns the row written here, not a second membership.
			const [written] = await db
				.select({ id: schema.teamMember.id })
				.from(schema.teamMember)
				.where(eq(schema.teamMember.teamId, support.id));
			await expect(
				orgApi.addTeamMember({
					headers: ownerHeaders,
					body: { teamId: support.id, userId: ownerId },
				}),
			).resolves.toMatchObject({ id: written.id });
			expect(
				(await service.get(org.id)).teams.find((t) => t.id === support.id),
			).toMatchObject({ userIds: [ownerId], memberCount: 1 });
		});

		it("computes the same membership key as the plugin", async () => {
			const org = await createOrganization();
			const userId = await createUser("Keyed");
			await service.addMember(org.id, { userId, role: "member" });
			await orgApi.setActiveOrganization({
				headers: ownerHeaders,
				body: { organizationId: org.id },
			});
			const teamId = org.teams[0].id;

			await orgApi.addTeamMember({
				headers: ownerHeaders,
				body: { teamId, userId },
			});

			const [row] = await db
				.select({ key: schema.teamMember.membershipKey })
				.from(schema.teamMember)
				.where(eq(schema.teamMember.userId, userId));
			expect(row.key).toBe(teamMembershipKey(teamId, userId));
		});

		it("404s for a team of another organization", async () => {
			const a = await createOrganization();
			const b = await createOrganization();

			await expect(
				service.renameTeam(b.id, a.teams[0].id, "Nope"),
			).rejects.toMatchObject({ status: 404 });
		});
	});
});
