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

	it("refuses it in the user's own locale", async () => {
		const owner = await signUp("owner10@example.com");
		const busy = await signUp("ocupado@example.com", { locale: "pt-BR" });
		const org = await createOrg(owner, "Lambda", "lambda");
		await createOrg(busy, "Ocupado", "ocupado");
		const invite = await owner("/organization/invite-member", {
			email: "ocupado@example.com",
			role: "member",
			organizationId: org.id,
		});

		const accepted = await busy(
			"/organization/accept-invitation",
			{ invitationId: invite.data.id },
			{ "accept-language": "en" },
		);

		expect(accepted.status).toBe(403);
		expect(accepted.data.message).toBe(
			m.auth_error_ALREADY_IN_AN_ORGANIZATION({}, { locale: "pt-BR" }),
		);
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

	it("lets an owner who is not in a team list its members", async () => {
		const owner = await signUp("owner8@example.com");
		const org = await createOrg(owner, "Theta", "theta");
		const team = await owner("/organization/create-team", {
			name: "Design",
			organizationId: org.id,
		});
		expect(team.status).toBe(200);
		const memberUser = await signUp("teammate@example.com");
		const invite = await owner("/organization/invite-member", {
			email: "teammate@example.com",
			role: "member",
			organizationId: org.id,
			teamId: team.data.id,
		});
		const accepted = await memberUser("/organization/accept-invitation", {
			invitationId: invite.data.id,
		});
		expect(accepted.status).toBe(200);

		const listed = await owner(
			`/organization/team-members?teamId=${team.data.id}`,
		);

		expect(listed.status).toBe(200);
		expect(listed.data).toEqual([
			expect.objectContaining({
				teamId: team.data.id,
				userId: findUser("teammate@example.com").id,
			}),
		]);
		expect(listed.data[0]).not.toHaveProperty("membershipKey");
	});

	it("refuses to list a team's members to someone from another organization", async () => {
		const owner = await signUp("owner9@example.com");
		const org = await createOrg(owner, "Iota", "iota");
		const team = await owner("/organization/create-team", {
			name: "Ops",
			organizationId: org.id,
		});
		const outsider = await signUp("outsider@example.com");
		await createOrg(outsider, "Kappa", "kappa");

		const listed = await outsider(
			`/organization/team-members?teamId=${team.data.id}`,
		);

		expect(listed.status).toBe(403);
		expect(listed.data.code).toBe("USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION");
	});

	it("requires a session to list a team's members", async () => {
		const listed = await createClient()(
			"/organization/team-members?teamId=anything",
		);
		expect(listed.status).toBe(401);
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

describe("account", () => {
	beforeEach(() => {
		sent.length = 0;
	});

	it("refuses to delete the account of an organization's only owner, in their locale", async () => {
		const owner = await signUp("sole@example.com", { locale: "pt-BR" });
		await createOrg(owner, "Sole Co", "account-sole");

		const deleted = await owner("/delete-user", { password });

		expect(deleted.status).toBe(403);
		expect(deleted.data.code).toBe("ONLY_OWNER_OF_AN_ORGANIZATION");
		expect(deleted.data.message).toBe(
			m.auth_error_ONLY_OWNER_OF_AN_ORGANIZATION({}, { locale: "pt-BR" }),
		);
		expect(db.user.some((user) => user.email === "sole@example.com")).toBe(
			true,
		);
	});

	it("deletes an owner's account once someone else also owns the organization", async () => {
		const owner = await signUp("coowner@example.com");
		const org = await createOrg(owner, "Co-owned", "account-coowned");
		await signUp("other-owner@example.com");
		db.member.push({
			id: "member-other-owner",
			organizationId: org.id,
			userId: findUser("other-owner@example.com").id,
			role: "owner",
			createdAt: new Date(),
		});

		const deleted = await owner("/delete-user", { password });

		expect(deleted.status).toBe(200);
		expect(db.user.some((user) => user.email === "coowner@example.com")).toBe(
			false,
		);
	});

	it("deletes an account with its password, and only with the right one", async () => {
		const client = await signUp("leaving@example.com");

		const wrong = await client("/delete-user", { password: "not-it-at-all" });
		expect(wrong.status).toBe(400);

		const deleted = await client("/delete-user", { password });
		expect(deleted.status).toBe(200);
		expect(deleted.data.message).toBe("User deleted");
		expect(db.user.some((user) => user.email === "leaving@example.com")).toBe(
			false,
		);
	});

	it("asks the current address to confirm an email change first", async () => {
		const client = await signUp("old-address@example.com", {
			locale: "pt-BR",
		});
		sent.length = 0;

		const changed = await client("/change-email", {
			newEmail: "new-address@example.com",
			callbackURL: "http://localhost:5173/settings/account",
		});

		expect(changed.status).toBe(200);
		expect(sent).toHaveLength(1);
		expect(sent[0]?.to).toBe("old-address@example.com");
		expect(sent[0]?.subject).toBe(
			m.email_change_email_subject({}, { locale: "pt-BR" }),
		);
		expect(sent[0]?.html).toContain("new-address@example.com");
		expect(findUser("old-address@example.com").email).toBe(
			"old-address@example.com",
		);
	});
});

describe("password reset", () => {
	beforeEach(() => {
		sent.length = 0;
	});

	/** The reset token from the emailed link (…/reset-password/<token>?…). */
	function emailedToken() {
		const link = sent.at(-1)?.html.match(/reset-password\/([^?"]+)/);
		if (!link?.[1]) throw new Error("No reset link was emailed");
		return link[1];
	}

	it("emails a link back to the web app, then sets the new password", async () => {
		await signUp("forgetful@example.com");
		sent.length = 0;

		const requested = await createClient()("/request-password-reset", {
			email: "forgetful@example.com",
			redirectTo: "http://localhost:5173/reset-password",
		});
		expect(requested.status).toBe(200);
		expect(sent[0]?.to).toBe("forgetful@example.com");
		expect(sent[0]?.html).toContain(
			encodeURIComponent("http://localhost:5173/reset-password"),
		);

		const reset = await createClient()("/reset-password", {
			newPassword: "a-brand-new-pass",
			token: emailedToken(),
		});
		expect(reset.status).toBe(200);

		const signIn = await createClient()("/sign-in/email", {
			email: "forgetful@example.com",
			password: "a-brand-new-pass",
		});
		expect(signIn.status).toBe(200);
	});

	it("answers the same for an unknown email, without sending anything", async () => {
		const requested = await createClient()("/request-password-reset", {
			email: "nobody-here@example.com",
			redirectTo: "http://localhost:5173/reset-password",
		});

		expect(requested.status).toBe(200);
		expect(sent).toHaveLength(0);
	});

	it("refuses a link that was already used", async () => {
		await signUp("twice@example.com");
		await createClient()("/request-password-reset", {
			email: "twice@example.com",
			redirectTo: "http://localhost:5173/reset-password",
		});
		const token = emailedToken();
		await createClient()("/reset-password", {
			newPassword: "first-new-pass",
			token,
		});

		const again = await createClient()("/reset-password", {
			newPassword: "second-new-pass",
			token,
		});

		expect(again.status).toBe(400);
		expect(again.data.code).toBe("INVALID_TOKEN");
	});
});
