import { m } from "@workspace/i18n/messages";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";

// Sign-up is by invitation only: the production auth config over HTTP,
// against an in-memory database, with Resend mocked to capture emails.
const { sent } = vi.hoisted(() => {
	process.env.BETTER_AUTH_URL = "http://localhost:3000";
	process.env.WEB_URL = "http://localhost:5173";
	return { sent: [] as { to: string; subject: string; html: string }[] };
});

vi.mock("resend", () => ({
	Resend: class {
		emails = {
			send: async (email: { to: string; subject: string; html: string }) => {
				sent.push(email);
				return { data: { id: "email-id" }, error: null };
			},
		};
	},
}));

import { authOptions } from "./auth.js";
import { signUpGate } from "./sign-up-gate.js";

type Row = Record<string, unknown>;

const db = {
	user: [] as Row[],
	session: [] as Row[],
	account: [] as Row[],
	verification: [] as Row[],
	twoFactor: [] as Row[],
	organization: [] as Row[],
	member: [] as Row[],
	invitation: [] as Row[],
	team: [] as Row[],
	teamMember: [] as Row[],
};

const testAuth = betterAuth({
	...authOptions,
	database: memoryAdapter(db),
	secret: "test-secret-that-is-long-enough-for-better-auth",
});

type ServerApi = {
	createUser: (input: {
		body: { email: string; name: string };
	}) => Promise<{ user: { id: string; email: string } }>;
	createOrganization: (input: {
		body: { name: string; slug: string; userId: string };
	}) => Promise<{ id: string } | null>;
};
const serverApi = testAuth.api as unknown as ServerApi;

const password = "s3cret-pass";

/** A browser: keeps cookies between requests, like the web app does. */
function createClient() {
	const cookies = new Map<string, string>();
	return async (
		path: string,
		body?: object,
		extraHeaders: Record<string, string> = {},
	) => {
		const response = await testAuth.handler(
			new Request(`http://localhost:3000/api/auth${path}`, {
				method: body ? "POST" : "GET",
				headers: {
					"content-type": "application/json",
					origin: "http://localhost:5173",
					cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
					...extraHeaders,
				},
				body: body && JSON.stringify(body),
			}),
		);
		for (const header of response.headers.getSetCookie()) {
			const [pair] = header.split(";");
			const [name, ...value] = pair.split("=");
			cookies.set(name, value.join("="));
		}
		return {
			status: response.status,
			headers: response.headers,
			data: await response.json().catch(() => null),
		};
	};
}

function pendingInvitation(email: string, expiresAt: Date) {
	const organizationId = `org-${db.organization.length + 1}`;
	db.organization.push({
		id: organizationId,
		name: "Acme",
		slug: organizationId,
		createdAt: new Date(),
	});
	db.invitation.push({
		id: `inv-${db.invitation.length + 1}`,
		organizationId,
		email,
		role: "member",
		status: "pending",
		expiresAt,
		createdAt: new Date(),
		inviterId: "someone",
	});
}

const usersWith = (email: string) =>
	db.user.filter((user) => user.email === email);

describe("sign-up gate", () => {
	beforeEach(() => {
		sent.length = 0;
	});

	// Better Auth answers a refused email sign-up like a duplicate one
	// (generic success, nothing sent) so it can't be used to probe emails.
	it("refuses email sign-up without an invitation", async () => {
		const response = await createClient()("/sign-up/email", {
			name: "Nobody",
			email: "nobody@example.com",
			password,
		});

		expect(response.data.token).toBeNull();
		expect(usersWith("nobody@example.com")).toHaveLength(0);
		expect(sent).toHaveLength(0);
	});

	it("refuses with SIGN_UP_DISABLED in the request's locale", async () => {
		const before = signUpGate.user?.create?.before;
		const ctx = {
			path: "/sign-up/email",
			headers: new Headers({ "accept-language": "pt-BR" }),
			context: { adapter: { findMany: async () => [] } },
		} as unknown as Parameters<NonNullable<typeof before>>[1];

		await expect(
			before?.(
				{ email: "ninguem@example.com" } as Parameters<
					NonNullable<typeof before>
				>[0],
				ctx,
			),
		).rejects.toMatchObject({
			statusCode: 403,
			body: {
				code: "SIGN_UP_DISABLED",
				message: m.auth_error_SIGN_UP_DISABLED({}, { locale: "pt-BR" }),
			},
		});
	});

	it("refuses a magic-link sign-up without an invitation", async () => {
		const client = createClient();
		await client("/sign-in/magic-link", { email: "magic@example.com" });
		const [email] = sent;
		const token = /token=([^&"]+)/.exec(email.html)?.[1];
		expect(token).toBeDefined();

		await client(`/magic-link/verify?token=${token}`);

		expect(usersWith("magic@example.com")).toHaveLength(0);
	});

	it("allows sign-up for an email with a pending organization invitation", async () => {
		pendingInvitation(
			"jane@example.com",
			new Date(Date.now() + 24 * 60 * 60 * 1000),
		);

		const response = await createClient()("/sign-up/email", {
			name: "Jane",
			email: "Jane@Example.com",
			password,
		});

		expect(response.status).toBe(200);
		expect(usersWith("jane@example.com")).toHaveLength(1);
	});

	it("refuses it when that invitation expired", async () => {
		pendingInvitation("late@example.com", new Date(Date.now() - 1000));

		const response = await createClient()("/sign-up/email", {
			name: "Late",
			email: "late@example.com",
			password,
		});

		expect(response.data.token).toBeNull();
		expect(usersWith("late@example.com")).toHaveLength(0);
	});

	it("allows an admin to create a user", async () => {
		const { user } = await serverApi.createUser({
			body: { email: "created@example.com", name: "Created" },
		});

		expect(user.email).toBe("created@example.com");
	});

	describe("organizations", () => {
		async function signedInUser(email: string) {
			const { user } = await serverApi.createUser({
				body: { email, name: email },
			});
			Object.assign(db.user.find((row) => row.id === user.id) ?? {}, {
				emailVerified: true,
			});
			const context = await testAuth.$context;
			db.account.push({
				id: `account-${user.id}`,
				accountId: user.id,
				providerId: "credential",
				userId: user.id,
				password: await context.password.hash(password),
				createdAt: new Date(),
				updatedAt: new Date(),
			});
			const client = createClient();
			const signIn = await client("/sign-in/email", { email, password });
			expect(signIn.status).toBe(200);
			return { client, userId: user.id };
		}

		it("members can't create an organization", async () => {
			const { client } = await signedInUser("member@example.com");

			const response = await client("/organization/create", {
				name: "Mine",
				slug: "mine",
			});

			expect(response.status).toBe(403);
			expect(response.data.code).toBe(
				"YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_ORGANIZATION",
			);
		});

		it("the server can still create one for a user", async () => {
			const { user } = await serverApi.createUser({
				body: { email: "owner@example.com", name: "Owner" },
			});

			const organization = await serverApi.createOrganization({
				body: { name: "Theirs", slug: "theirs", userId: user.id },
			});

			expect(organization?.id).toBeDefined();
		});
	});
});
