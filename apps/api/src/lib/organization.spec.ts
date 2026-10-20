import { m } from "@workspace/i18n/messages";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";

// The production organization plugin config, end to end over HTTP, against an
// in-memory database. Resend is mocked to capture the emails that are sent.
const { sent } = vi.hoisted(() => {
	process.env.BETTER_AUTH_URL = "http://localhost:3000";
	process.env.WEB_URL = "http://localhost:5173";
	return {
		sent: [] as { to: string; subject: string; html: string }[],
	};
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

const password = "s3cret-pass";

/** A browser: keeps cookies between requests, like the web app does. */
function createClient() {
	const cookies = new Map<string, string>();
	const cookieHeader = () =>
		[...cookies].map(([k, v]) => `${k}=${v}`).join("; ");

	async function request(
		path: string,
		body?: object,
		extraHeaders: Record<string, string> = {},
	) {
		const response = await testAuth.handler(
			new Request(`http://localhost:3000/api/auth${path}`, {
				method: body ? "POST" : "GET",
				headers: {
					"content-type": "application/json",
					origin: "http://localhost:5173",
					cookie: cookieHeader(),
					...extraHeaders,
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

	return request;
}

type Client = ReturnType<typeof createClient>;

function findUser(email: string) {
	const found = db.user.find((user) => user.email === email);
	if (!found) throw new Error(`No user ${email}`);
	return found;
}

/** Signs up, marks the email verified and returns a signed-in client. */
async function signUp(
	email: string,
	{ name = email, locale, verified = true } = {} as {
		name?: string;
		locale?: string;
		verified?: boolean;
	},
): Promise<Client> {
	await createClient()("/sign-up/email", { name, email, password, locale });
	// Skip the emailed verification link: sign-in requires a verified email.
	Object.assign(findUser(email), { emailVerified: true });
	const client = createClient();
	const signIn = await client("/sign-in/email", { email, password });
	if (signIn.status !== 200) {
		throw new Error(`Sign-in failed: ${JSON.stringify(signIn.data)}`);
	}
	Object.assign(findUser(email), { emailVerified: verified });
	return client;
}

async function createOrg(client: Client, name: string, slug: string) {
	const created = await client("/organization/create", { name, slug });
	if (created.status !== 200) {
		throw new Error(`Create failed: ${JSON.stringify(created.data)}`);
	}
	return created.data as { id: string };
}

describe("organization plugin", () => {
	beforeEach(() => {
		sent.length = 0;
	});

	it("sends the invitation in the invitee's locale with org, inviter, role and link", async () => {
		const owner = await signUp("owner1@example.com", { name: "Olivia Owner" });
		await signUp("pt@example.com", { locale: "pt-BR" });
		const org = await createOrg(owner, "Acme", "acme");

		sent.length = 0;

		const invite = await owner("/organization/invite-member", {
			email: "pt@example.com",
			role: "member",
			organizationId: org.id,
		});

		expect(invite.status).toBe(200);
		expect(sent).toHaveLength(1);
		const [email] = sent;
		expect(email.to).toBe("pt@example.com");
		expect(email.subject).toBe(
			m.email_invitation_subject({ organization: "Acme" }, { locale: "pt-BR" }),
		);
		expect(email.html).toContain(
			`/invitations/${invite.data.id}?email=pt%40example.com`,
		);
		expect(email.html).toContain("Olivia Owner");
		expect(email.html).toContain(
			m.admin_member_role_member({}, { locale: "pt-BR" }),
		);
	});

	it("falls back to the inviter's request locale for an unknown invitee", async () => {
		const owner = await signUp("owner2@example.com");
		const org = await createOrg(owner, "Beta", "beta");

		sent.length = 0;

		await owner(
			"/organization/invite-member",
			{ email: "nobody@example.com", role: "admin", organizationId: org.id },
			{ "accept-language": "pt-BR" },
		);

		expect(sent).toHaveLength(1);
		expect(sent[0].subject).toBe(
			m.email_invitation_subject({ organization: "Beta" }, { locale: "pt-BR" }),
		);
	});

	it("re-inviting cancels the previous invitation", async () => {
		const owner = await signUp("owner3@example.com");
		const org = await createOrg(owner, "Gamma", "gamma");
		const body = {
			email: "again@example.com",
			role: "member",
			organizationId: org.id,
		};

		sent.length = 0;

		const first = await owner("/organization/invite-member", body);
		const second = await owner("/organization/invite-member", body);

		expect(second.status).toBe(200);
		expect(second.data.id).not.toBe(first.data.id);
		const firstRow = db.invitation.find((row) => row.id === first.data.id);
		expect(firstRow?.status).toBe("canceled");
		expect(sent).toHaveLength(2);
	});

	it("requires a verified email to accept", async () => {
		const owner = await signUp("owner4@example.com");
		const unverified = await signUp("unverified@example.com", {
			verified: false,
		});
		const org = await createOrg(owner, "Delta", "delta");
		const invite = await owner("/organization/invite-member", {
			email: "unverified@example.com",
			role: "member",
			organizationId: org.id,
		});

		const accepted = await unverified("/organization/accept-invitation", {
			invitationId: invite.data.id,
		});

		expect(accepted.status).toBe(403);
		expect(accepted.data.code).toBe(
			"EMAIL_VERIFICATION_REQUIRED_BEFORE_ACCEPTING_OR_REJECTING_INVITATION",
		);
	});

	it("refuses an invitation for someone already in an organization", async () => {
		const owner = await signUp("owner5@example.com");
		const busy = await signUp("busy@example.com");
		const org = await createOrg(owner, "Epsilon", "epsilon");
		const other = await createOrg(busy, "Busy Inc", "busy-inc");
		const invite = await owner("/organization/invite-member", {
			email: "busy@example.com",
			role: "member",
			organizationId: org.id,
		});

		const accepted = await busy(
			"/organization/accept-invitation",
			{ invitationId: invite.data.id },
			{ "accept-language": "en" },
		);

		expect(accepted.status).toBe(403);
		expect(accepted.data.code).toBe("ALREADY_IN_AN_ORGANIZATION");
		expect(accepted.data.message).toBe(
			m.auth_error_ALREADY_IN_AN_ORGANIZATION({}, { locale: "en" }),
		);
		const rows = db.member.filter(
			(row) => row.userId === findUser("busy@example.com").id,
		);
		expect(rows).toHaveLength(1);
		expect(rows[0].organizationId).toBe(other.id);
	});

	it("blocks creating a second organization", async () => {
		const owner = await signUp("owner6@example.com");
		await createOrg(owner, "Zeta", "zeta");

		const second = await owner("/organization/create", {
			name: "Zeta 2",
			slug: "zeta-2",
		});

		expect(second.status).toBe(403);
		expect(second.data.code).toBe(
			"YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_ORGANIZATIONS",
		);
	});

	it("invitations expire after 7 days", async () => {
		const owner = await signUp("owner7@example.com");
		const org = await createOrg(owner, "Eta", "eta");

		const invite = await owner("/organization/invite-member", {
			email: "week@example.com",
			role: "member",
			organizationId: org.id,
		});

		const row = db.invitation.find((r) => r.id === invite.data.id);
		const lifetime =
			new Date(row?.expiresAt as string).getTime() -
			new Date(row?.createdAt as string).getTime();
		expect(Math.abs(lifetime - 7 * 24 * 60 * 60 * 1000)).toBeLessThan(5000);
	});
});
