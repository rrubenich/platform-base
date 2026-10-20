import { createHmac } from "node:crypto";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";

// The production auth config, end to end over HTTP, against an in-memory
// database. Resend is mocked so emails (verification, 2FA codes) are captured
// instead of sent.
const sentEmails = vi.hoisted(() => {
	process.env.BETTER_AUTH_URL = "http://localhost:3000";
	process.env.WEB_URL = "http://localhost:5173";
	return [] as { to: string; subject: string; html: string }[];
});

vi.mock("resend", () => ({
	Resend: class {
		emails = {
			send: async (email: (typeof sentEmails)[number]) => {
				sentEmails.push(email);
				return { data: { id: "email-id" }, error: null };
			},
		};
	},
}));

import { authOptions } from "./auth.js";

const db = {
	user: [] as Record<string, unknown>[],
	session: [],
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

const user = {
	name: "Jane Doe",
	email: "jane@example.com",
	password: "s3cret-pass",
};

/** A browser: keeps cookies between requests, like the web app does. */
function createClient() {
	const cookies = new Map<string, string>();

	return async function request(path: string, body?: object) {
		const response = await testAuth.handler(
			new Request(`http://localhost:3000/api/auth${path}`, {
				method: body ? "POST" : "GET",
				headers: {
					"content-type": "application/json",
					origin: "http://localhost:5173",
					"accept-language": "pt-BR",
					cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
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
	};
}

/** RFC 6238 TOTP, as an authenticator app would compute it. */
function totp(base32Secret: string, now = Date.now()) {
	const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
	const bits = [...base32Secret.replace(/=+$/, "")]
		.map((char) => alphabet.indexOf(char).toString(2).padStart(5, "0"))
		.join("");
	const key = Buffer.from(
		bits.match(/.{8}/g)?.map((byte) => Number.parseInt(byte, 2)) ?? [],
	);
	const counter = Buffer.alloc(8);
	counter.writeBigUInt64BE(BigInt(Math.floor(now / 1000 / 30)));
	const hmac = createHmac("sha1", key).update(counter).digest();
	const offset = hmac[hmac.length - 1] & 0xf;
	const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
	return code.toString().padStart(6, "0");
}

async function signedInSession(request: ReturnType<typeof createClient>) {
	return (await request("/get-session")).data;
}

describe("two-factor authentication", () => {
	let backupCodes: string[];

	beforeAll(async () => {
		await createClient()("/sign-up/email", user);
		// Skip the emailed verification link: sign-in requires a verified email.
		Object.assign(db.user[0], { emailVerified: true });
	});

	it("is enabled once the first authenticator code verifies", async () => {
		const request = createClient();
		await request("/sign-in/email", user);

		const enabled = await request("/two-factor/enable", {
			password: user.password,
		});
		expect(enabled.status).toBe(200);
		const uri = new URL(enabled.data.totpURI);
		expect(uri.protocol).toBe("otpauth:");
		expect(uri.searchParams.get("issuer")).toBe("Platform Base");
		expect(enabled.data.backupCodes).toHaveLength(10);
		backupCodes = enabled.data.backupCodes;

		// Not on yet: the app hasn't proven it has the secret.
		expect((await signedInSession(request)).user.twoFactorEnabled).toBe(false);

		const secret = uri.searchParams.get("secret") ?? "";
		const verified = await request("/two-factor/verify-totp", {
			code: totp(secret),
		});
		expect(verified.status).toBe(200);
		expect((await signedInSession(request)).user.twoFactorEnabled).toBe(true);
	});

	it("holds back the session at password sign-in until a code is given", async () => {
		const request = createClient();

		const signIn = await request("/sign-in/email", user);

		expect(signIn.data).toEqual({
			twoFactorRedirect: true,
			twoFactorMethods: ["totp", "otp"],
		});
		expect(await signedInSession(request)).toBeNull();
	});

	it("signs in with an emailed code, sent in the request's language", async () => {
		const request = createClient();
		await request("/sign-in/email", user);
		sentEmails.length = 0;

		expect((await request("/two-factor/send-otp", {})).status).toBe(200);

		expect(sentEmails).toHaveLength(1);
		expect(sentEmails[0]).toMatchObject({
			to: user.email,
			subject: "Seu código de verificação",
		});
		const code = sentEmails[0].html.match(/\b\d{6}\b/)?.[0];
		expect(code).toBeDefined();

		const verified = await request("/two-factor/verify-otp", { code });
		expect(verified.status).toBe(200);
		expect((await signedInSession(request)).user.email).toBe(user.email);
	});

	it("rejects a wrong code", async () => {
		const request = createClient();
		await request("/sign-in/email", user);

		const verified = await request("/two-factor/verify-totp", {
			code: "000000",
		});

		expect(verified.status).toBe(401);
		expect(verified.data.code).toBe("INVALID_CODE");
		expect(await signedInSession(request)).toBeNull();
	});

	it("accepts each backup code once", async () => {
		const first = createClient();
		await first("/sign-in/email", user);
		const used = await first("/two-factor/verify-backup-code", {
			code: backupCodes[0],
		});
		expect(used.status).toBe(200);
		expect((await signedInSession(first)).user.email).toBe(user.email);

		const second = createClient();
		await second("/sign-in/email", user);
		const reused = await second("/two-factor/verify-backup-code", {
			code: backupCodes[0],
		});
		expect(reused.status).toBe(401);
		expect(await signedInSession(second)).toBeNull();
	});

	it("skips the code on a trusted device", async () => {
		const request = createClient();
		await request("/sign-in/email", user);
		await request("/two-factor/verify-backup-code", {
			code: backupCodes[1],
			trustDevice: true,
		});
		await request("/sign-out", {});

		const signIn = await request("/sign-in/email", user);

		expect(signIn.data.twoFactorRedirect).toBeUndefined();
		expect((await signedInSession(request)).user.email).toBe(user.email);
	});
});
