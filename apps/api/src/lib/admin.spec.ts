import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { RequirePermissions } from "../auth/auth.decorators.js";
import { type AuthApi, AuthGuard } from "../auth/auth.guard.js";

// The production admin plugin config, end to end over HTTP, against an
// in-memory database. Resend is mocked so sign-up's verification email
// isn't actually sent.
vi.hoisted(() => {
	process.env.BETTER_AUTH_URL = "http://localhost:3000";
	process.env.WEB_URL = "http://localhost:5173";
	process.env.ADMIN_USER_IDS = "bootstrap-admin-id, other-admin-id";
});

vi.mock("resend", () => ({
	Resend: class {
		emails = { send: async () => ({ data: { id: "email-id" }, error: null }) };
	},
}));

import { authOptions } from "./auth.js";

const db = {
	user: [] as Record<string, unknown>[],
	session: [] as Record<string, unknown>[],
	account: [],
	verification: [],
	twoFactor: [],
	organization: [],
	member: [],
	invitation: [],
};

const testAuth = betterAuth({
	...authOptions,
	database: memoryAdapter(db),
	secret: "test-secret-that-is-long-enough-for-better-auth",
});

const password = "s3cret-pass";
const adminUser = { name: "Ada Admin", email: "ada@example.com", password };
const regularUser = { name: "Jane Doe", email: "jane@example.com", password };

/** A browser: keeps cookies between requests, like the web app does. */
function createClient() {
	const cookies = new Map<string, string>();
	const cookieHeader = () =>
		[...cookies].map(([k, v]) => `${k}=${v}`).join("; ");

	async function request(path: string, body?: object) {
		const response = await testAuth.handler(
			new Request(`http://localhost:3000/api/auth${path}`, {
				method: body ? "POST" : "GET",
				headers: {
					"content-type": "application/json",
					origin: "http://localhost:5173",
					cookie: cookieHeader(),
				},
				body: body && JSON.stringify(body),
			}),
		);

		for (const header of response.headers.getSetCookie()) {
			const [pair] = header.split(";");
			const [name, ...value] = pair.split("=");
			if (/max-age=0/i.test(header)) cookies.delete(name);
			else cookies.set(name, value.join("="));
		}

		return {
			status: response.status,
			data: await response.json().catch(() => null),
		};
	}

	return Object.assign(request, { cookieHeader });
}

type Client = ReturnType<typeof createClient>;

function findUser(email: string) {
	const found = db.user.find((user) => user.email === email);
	if (!found) throw new Error(`No user ${email}`);
	return found as { id: string; role?: string | null } & Record<
		string,
		unknown
	>;
}

async function signedInAs(credentials: typeof adminUser): Promise<Client> {
	const request = createClient();
	const signIn = await request("/sign-in/email", credentials);
	if (signIn.status !== 200) {
		throw new Error(`Sign-in failed: ${JSON.stringify(signIn.data)}`);
	}
	return request;
}

describe("admin plugin", () => {
	let admin: Client;
	let jane: Client;

	beforeAll(async () => {
		for (const credentials of [adminUser, regularUser]) {
			await createClient()("/sign-up/email", credentials);
			// Skip the emailed verification link: sign-in requires a verified email.
			Object.assign(findUser(credentials.email), { emailVerified: true });
		}
		// There's no admin yet to call set-role, as in production before
		// ADMIN_USER_IDS bootstraps one.
		Object.assign(findUser(adminUser.email), { role: "admin" });
	});

	beforeEach(async () => {
		admin = await signedInAs(adminUser);
		jane = await signedInAs(regularUser);
	});

	it("gives new users the default role", () => {
		expect(findUser(regularUser.email).role).toBe("user");
	});

	it("lets admins list users", async () => {
		const listed = await admin("/admin/list-users?sortBy=email");

		expect(listed.status).toBe(200);
		expect(listed.data.total).toBe(2);
		expect(
			listed.data.users.map((user: { email: string }) => user.email),
		).toEqual([adminUser.email, regularUser.email]);
	});

	it("forbids regular users from admin endpoints", async () => {
		const listed = await jane("/admin/list-users");

		expect(listed.status).toBe(403);
		expect(listed.data.code).toBe("YOU_ARE_NOT_ALLOWED_TO_LIST_USERS");
	});

	it("only assigns roles that are defined", async () => {
		const { id } = findUser(regularUser.email);

		const rejected = await admin("/admin/set-role", {
			userId: id,
			role: "owner",
		});
		expect(rejected.status).toBe(400);
		expect(rejected.data.code).toBe(
			"YOU_ARE_NOT_ALLOWED_TO_SET_NON_EXISTENT_VALUE",
		);

		const promoted = await admin("/admin/set-role", {
			userId: id,
			role: "admin",
		});
		expect(promoted.status).toBe(200);
		expect((await jane("/admin/list-users")).status).toBe(200);

		await admin("/admin/set-role", { userId: id, role: "user" });
		expect((await jane("/admin/list-users")).status).toBe(403);
	});

	describe("banning", () => {
		afterEach(async () => {
			await admin("/admin/unban-user", {
				userId: findUser(regularUser.email).id,
			});
		});

		it("signs the user out everywhere and blocks sign-in until unbanned", async () => {
			const { id } = findUser(regularUser.email);

			const banned = await admin("/admin/ban-user", {
				userId: id,
				banReason: "Spamming",
			});
			expect(banned.status).toBe(200);
			expect(banned.data.user).toMatchObject({
				banned: true,
				banReason: "Spamming",
			});
			expect((await jane("/get-session")).data).toBeNull();

			const signIn = await createClient()("/sign-in/email", regularUser);
			expect(signIn.status).toBe(403);
			expect(signIn.data.code).toBe("BANNED_USER");

			await admin("/admin/unban-user", { userId: id });
			expect((await createClient()("/sign-in/email", regularUser)).status).toBe(
				200,
			);
		});

		it("doesn't let an admin ban themselves", async () => {
			const banned = await admin("/admin/ban-user", {
				userId: findUser(adminUser.email).id,
			});

			expect(banned.status).toBe(400);
			expect(banned.data.code).toBe("YOU_CANNOT_BAN_YOURSELF");
		});
	});

	it("lets an admin impersonate a user and switch back", async () => {
		const adminId = findUser(adminUser.email).id;

		const impersonated = await admin("/admin/impersonate-user", {
			userId: findUser(regularUser.email).id,
		});
		expect(impersonated.status).toBe(200);

		const asJane = (await admin("/get-session")).data;
		expect(asJane.user.email).toBe(regularUser.email);
		expect(asJane.session.impersonatedBy).toBe(adminId);
		// Capped at an hour, not the regular 7-day session.
		const lifetime = new Date(asJane.session.expiresAt).getTime() - Date.now();
		expect(lifetime).toBeLessThanOrEqual(60 * 60 * 1000);
		expect(lifetime).toBeGreaterThan(59 * 60 * 1000);

		expect((await admin("/admin/stop-impersonating", {})).status).toBe(200);
		expect((await admin("/get-session")).data.user.email).toBe(adminUser.email);
	});

	it("grants ADMIN_USER_IDS every permission, whatever their role", async () => {
		const check = (userId: string) =>
			(testAuth as unknown as AuthApi).api.userHasPermission({
				body: { userId, role: "user", permissions: { user: ["ban"] } },
			});

		expect((await check("bootstrap-admin-id")).success).toBe(true);
		expect((await check("other-admin-id")).success).toBe(true);
		expect((await check("someone-else")).success).toBe(false);
	});

	it("lets only admins use the docs assistant", async () => {
		const check = (role: string) =>
			(testAuth as unknown as AuthApi).api.userHasPermission({
				body: {
					userId: "someone-else",
					role,
					permissions: { "docs-assistant": ["use"] },
				},
			});

		expect((await check("admin")).success).toBe(true);
		expect((await check("user")).success).toBe(false);
	});

	// The Nest guard, against the real plugin rather than a mock, so the
	// permission check it delegates to stays in sync with the roles config.
	describe("AuthGuard", () => {
		class StatsController {
			@RequirePermissions({ user: ["list"], session: ["list"] })
			stats() {}

			open() {}
		}

		const guard = new AuthGuard(
			testAuth as unknown as AuthApi,
			new Reflector(),
		);

		function canActivate(
			handler: keyof StatsController,
			cookie: string,
		): Promise<boolean> {
			const request = { headers: { cookie } };
			const context = {
				getHandler: () => StatsController.prototype[handler],
				getClass: () => StatsController,
				switchToHttp: () => ({ getRequest: () => request }),
			} as unknown as ExecutionContext;
			return guard.canActivate(context);
		}

		it("rejects requests without a session", async () => {
			await expect(canActivate("open", "")).rejects.toMatchObject({
				status: 401,
			});
		});

		it("lets any signed-in user through routes without permissions", async () => {
			await expect(canActivate("open", jane.cookieHeader())).resolves.toBe(
				true,
			);
		});

		it("gates permission-restricted routes on the user's role", async () => {
			await expect(canActivate("stats", admin.cookieHeader())).resolves.toBe(
				true,
			);
			await expect(
				canActivate("stats", jane.cookieHeader()),
			).rejects.toMatchObject({ status: 403 });
		});
	});
});
