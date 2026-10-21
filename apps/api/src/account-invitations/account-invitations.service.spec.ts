import { createHash } from "node:crypto";
import { Test } from "@nestjs/testing";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq } from "drizzle-orm";
import { AUTH_INSTANCE } from "../auth/auth.constants.js";
import { DATABASE_CONNECTION } from "../database/database.module.js";
import * as schema from "../database/schema.js";
import { createTestDatabase } from "../testing/test-database.js";
import { AccountInvitationsService } from "./account-invitations.service.js";

// The service against an in-memory Postgres with the app's migrations and
// the production auth config (sign-up gate included), so the account it
// writes on acceptance is checked by a real email/password sign-in.
const { sent, resendControl } = vi.hoisted(() => {
	process.env.BETTER_AUTH_URL = "http://localhost:3000";
	process.env.WEB_URL = "http://localhost:5173";
	return {
		sent: [] as { to: string; subject: string; html: string }[],
		resendControl: { failNext: false },
	};
});

vi.mock("resend", () => ({
	Resend: class {
		emails = {
			send: async (email: { to: string; subject: string; html: string }) => {
				if (resendControl.failNext) {
					resendControl.failNext = false;
					return { data: null, error: { message: "invalid recipient" } };
				}
				sent.push(email);
				return { data: { id: "email-id" }, error: null };
			},
		};
	},
}));

import { authOptions } from "../lib/auth.js";

const { db, close } = await createTestDatabase();

const testAuth = betterAuth({
	...authOptions,
	database: drizzleAdapter(db, { provider: "pg", schema }),
	secret: "test-secret-that-is-long-enough-for-better-auth",
});

const DAY = 24 * 60 * 60 * 1000;
const password = "s3cret-pass";
const inviter = { id: "superadmin", name: "Sam Superadmin" };

let service: AccountInvitationsService;
let counter = 0;

/** The token in the last email's link. */
function lastToken(): string {
	const html = sent.at(-1)?.html ?? "";
	const token = /\/welcome\/([\w-]+)/.exec(html)?.[1];
	if (!token) throw new Error(`No welcome link in ${html}`);
	return token;
}

async function invite(overrides: { email?: string; slug?: string } = {}) {
	const n = ++counter;
	const input = {
		email: overrides.email ?? `client${n}@example.com`,
		organizationName: `Client ${n}`,
		slug: overrides.slug ?? `client-${n}`,
	};
	const created = await service.create(input, inviter, "en");
	return { ...created, ...input, token: lastToken() };
}

const findUser = (email: string) =>
	db.query.user.findFirst({ where: eq(schema.user.email, email) });

const invitationRow = (id: string) =>
	db.query.accountInvitation.findFirst({
		where: eq(schema.accountInvitation.id, id),
	});

beforeAll(async () => {
	const moduleRef = await Test.createTestingModule({
		providers: [
			AccountInvitationsService,
			{ provide: DATABASE_CONNECTION, useValue: db },
			{ provide: AUTH_INSTANCE, useValue: testAuth },
		],
	}).compile();
	service = moduleRef.get(AccountInvitationsService);

	await db.insert(schema.user).values({
		id: inviter.id,
		name: inviter.name,
		email: "sam@example.com",
		emailVerified: true,
		role: "admin",
	});
});

beforeEach(() => {
	sent.length = 0;
});

afterAll(async () => {
	await close();
});

describe("AccountInvitationsService", () => {
	describe("create", () => {
		it("creates the user without a password, as owner of a new organization", async () => {
			const created = await invite({ email: "Jane@Example.com" });

			const user = await findUser("jane@example.com");
			expect(user).toMatchObject({
				id: created.userId,
				emailVerified: false,
				role: "user",
			});
			const accounts = await db
				.select()
				.from(schema.account)
				.where(eq(schema.account.userId, created.userId));
			expect(accounts).toHaveLength(0);

			const members = await db
				.select()
				.from(schema.member)
				.where(eq(schema.member.organizationId, created.organizationId));
			expect(members).toEqual([
				expect.objectContaining({ userId: created.userId, role: "owner" }),
			]);
			const teams = await db
				.select()
				.from(schema.team)
				.where(eq(schema.team.organizationId, created.organizationId));
			expect(teams).toHaveLength(1);
		});

		it("emails a 7-day link and stores only the token's hash", async () => {
			const created = await invite();

			expect(sent).toHaveLength(1);
			expect(sent[0].to).toBe(created.email);
			expect(sent[0].html).toContain(created.organizationName);
			expect(sent[0].html).toContain("Sam Superadmin");
			expect(sent[0].html).toContain("http://localhost:5173/welcome/");

			const row = await invitationRow(created.id);
			expect(row?.tokenHash).toBe(
				createHash("sha256").update(created.token).digest("hex"),
			);
			expect(row?.tokenHash).not.toContain(created.token);
			expect(row?.invitedById).toBe(inviter.id);
			expect(row?.expiresAt.getTime()).toBeGreaterThan(
				Date.now() + 7 * DAY - 60_000,
			);
			expect(row?.expiresAt.getTime()).toBeLessThanOrEqual(
				Date.now() + 7 * DAY,
			);
		});

		it("refuses an email that already has an account, whatever its case", async () => {
			await invite({ email: "taken@example.com" });

			await expect(
				invite({ email: "Taken@Example.com" }),
			).rejects.toMatchObject({
				status: 409,
				response: { code: "EMAIL_TAKEN" },
			});
		});

		it("refuses a taken slug and leaves no user behind", async () => {
			await invite({ slug: "acme" });

			await expect(
				invite({ email: "second-acme@example.com", slug: "acme" }),
			).rejects.toMatchObject({
				status: 409,
				response: { code: "SLUG_TAKEN" },
			});
			expect(await findUser("second-acme@example.com")).toBeUndefined();
		});

		it("leaves nothing behind when the email can't be sent", async () => {
			resendControl.failNext = true;

			await expect(
				invite({ email: "bounce@example.com", slug: "bounce" }),
			).rejects.toThrow();

			expect(await findUser("bounce@example.com")).toBeUndefined();
			const orgs = await db
				.select()
				.from(schema.organization)
				.where(eq(schema.organization.slug, "bounce"));
			expect(orgs).toHaveLength(0);
		});
	});

	describe("preview", () => {
		it("names the email and the organization", async () => {
			const created = await invite();

			await expect(service.preview(created.token)).resolves.toEqual({
				email: created.email,
				organizationName: created.organizationName,
			});
		});

		it("doesn't know an unknown token", async () => {
			await expect(service.preview("not-a-token")).rejects.toMatchObject({
				status: 404,
			});
		});

		it("is gone once expired", async () => {
			const created = await invite();
			await db
				.update(schema.accountInvitation)
				.set({ expiresAt: new Date(Date.now() - 1000) })
				.where(eq(schema.accountInvitation.id, created.id));

			await expect(service.preview(created.token)).rejects.toMatchObject({
				status: 410,
				response: { code: "INVITATION_EXPIRED" },
			});
		});
	});

	describe("accept", () => {
		it("sets the name and password, so the person can sign in", async () => {
			const created = await invite();

			await expect(
				service.accept(created.token, { name: "Jane Client", password }),
			).resolves.toEqual({ email: created.email });

			const user = await findUser(created.email);
			expect(user).toMatchObject({ name: "Jane Client", emailVerified: true });
			const signIn = await testAuth.api.signInEmail({
				body: { email: created.email, password },
			});
			expect(signIn.user.id).toBe(created.userId);
		});

		it("can be used once", async () => {
			const created = await invite();
			await service.accept(created.token, { name: "Once", password });

			await expect(service.preview(created.token)).rejects.toMatchObject({
				status: 410,
				response: { code: "INVITATION_ACCEPTED" },
			});
			await expect(
				service.accept(created.token, { name: "Twice", password }),
			).rejects.toMatchObject({ status: 410 });
		});

		it("lets only one of two simultaneous accepts through", async () => {
			const created = await invite();

			const results = await Promise.allSettled([
				service.accept(created.token, { name: "First", password }),
				service.accept(created.token, { name: "Second", password }),
			]);

			expect(results.map(({ status }) => status).sort()).toEqual([
				"fulfilled",
				"rejected",
			]);
			const accounts = await db
				.select()
				.from(schema.account)
				.where(eq(schema.account.userId, created.userId));
			expect(accounts).toHaveLength(1);
		});

		it("enforces the password policy", async () => {
			const created = await invite();

			await expect(
				service.accept(created.token, { name: "Short", password: "1234567" }),
			).rejects.toMatchObject({ status: 400 });
			await expect(service.preview(created.token)).resolves.toBeDefined();
		});
	});

	describe("resend", () => {
		it("sends a new link and retires the old one", async () => {
			const created = await invite();
			await db
				.update(schema.accountInvitation)
				.set({ expiresAt: new Date(Date.now() - 1000) })
				.where(eq(schema.accountInvitation.id, created.id));
			sent.length = 0;

			const setup = await service.resend(created.id, inviter.name, "en");

			expect(setup.status).toBe("pending");
			expect(sent).toHaveLength(1);
			const token = lastToken();
			expect(token).not.toBe(created.token);
			await expect(service.preview(created.token)).rejects.toMatchObject({
				status: 404,
			});
			await expect(service.preview(token)).resolves.toBeDefined();
		});

		it("refuses once accepted", async () => {
			const created = await invite();
			await service.accept(created.token, { name: "Done", password });

			await expect(
				service.resend(created.id, inviter.name, "en"),
			).rejects.toMatchObject({
				status: 409,
				response: { code: "ALREADY_ACCEPTED" },
			});
		});
	});

	describe("cancel", () => {
		it("deletes the pending account and its organization", async () => {
			const created = await invite();

			await service.cancel(created.id);

			expect(await findUser(created.email)).toBeUndefined();
			const orgs = await db
				.select()
				.from(schema.organization)
				.where(eq(schema.organization.id, created.organizationId));
			expect(orgs).toHaveLength(0);
			expect(await invitationRow(created.id)).toBeUndefined();
		});

		it("refuses once accepted, keeping the account", async () => {
			const created = await invite();
			await service.accept(created.token, { name: "Kept", password });

			await expect(service.cancel(created.id)).rejects.toMatchObject({
				status: 409,
				response: { code: "ALREADY_ACCEPTED" },
			});
			expect(await findUser(created.email)).toBeDefined();
		});
	});

	describe("owner setup summaries", () => {
		it("reports pending, expired and (by omission) accepted invitations", async () => {
			const pending = await invite();
			const expired = await invite();
			await db
				.update(schema.accountInvitation)
				.set({ expiresAt: new Date(Date.now() - 1000) })
				.where(eq(schema.accountInvitation.id, expired.id));
			const accepted = await invite();
			await service.accept(accepted.token, { name: "Done", password });

			await expect(
				service.forOrganization(pending.organizationId),
			).resolves.toMatchObject({
				id: pending.id,
				email: pending.email,
				status: "pending",
			});
			await expect(
				service.forOrganization(expired.organizationId),
			).resolves.toMatchObject({ status: "expired" });
			await expect(
				service.forOrganization(accepted.organizationId),
			).resolves.toBeNull();

			const forUsers = await service.forUsers([
				pending.userId,
				expired.userId,
				accepted.userId,
			]);
			expect(
				forUsers.map(({ userId, status }) => [userId, status]).sort(),
			).toEqual(
				[
					[pending.userId, "pending"],
					[expired.userId, "expired"],
				].sort(),
			);
		});
	});
});
