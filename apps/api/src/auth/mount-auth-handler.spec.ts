import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import request from "supertest";
import { mountAuthHandler } from "./mount-auth-handler.js";

// The handler as main.ts mounts it, through Nest's Express adapter: the
// other auth specs call `auth.handler` directly, which skips Express's
// routing (and once hid a query string being dropped there).
const WEB_URL = "http://localhost:5173";

describe("mountAuthHandler", () => {
	let app: INestApplication;
	let verificationUrl = "";
	const db = {
		user: [] as Record<string, unknown>[],
		session: [],
		account: [],
		verification: [],
	};

	beforeAll(async () => {
		const auth = betterAuth({
			database: memoryAdapter(db),
			baseURL: "http://localhost:3000",
			secret: "test-secret-that-is-long-enough-for-better-auth",
			trustedOrigins: [WEB_URL],
			emailAndPassword: { enabled: true, requireEmailVerification: true },
			emailVerification: {
				sendOnSignUp: true,
				sendVerificationEmail: async ({ url }) => {
					verificationUrl = url;
				},
			},
		});

		const moduleRef = await Test.createTestingModule({}).compile();
		app = moduleRef.createNestApplication({ bodyParser: false });
		mountAuthHandler(app, auth);
		await app.init();
	});

	afterAll(async () => {
		await app.close();
	});

	it("reads the raw JSON body (no body parser in front of it)", async () => {
		await request(app.getHttpServer())
			.post("/api/auth/sign-up/email")
			.set("Origin", WEB_URL)
			.send({
				email: "jane@example.com",
				password: "s3cret-pass",
				name: "Jane Doe",
				callbackURL: `${WEB_URL}/`,
			})
			.expect(200);

		expect(verificationUrl).toContain("token=");
	});

	it("passes the query string through, so email verification links work", async () => {
		const { pathname, search } = new URL(verificationUrl);

		const response = await request(app.getHttpServer())
			.get(`${pathname}${search}`)
			.expect(302);

		expect(response.headers.location).toBe(`${WEB_URL}/`);
		expect(db.user[0]).toMatchObject({ emailVerified: true });
	});

	it("rejects a bad token on its merits, not as a missing one", async () => {
		const response = await request(app.getHttpServer())
			.get("/api/auth/verify-email")
			.query({ token: "not-a-token", callbackURL: `${WEB_URL}/` })
			.expect(302);

		expect(response.headers.location).toMatch(/error=invalid_token/i);
	});
});
