// auth.ts reads provider credentials from the environment at import time, so
// they're set before it loads. Placeholder values: nothing here talks to the
// providers or the database.
vi.hoisted(() => {
	Object.assign(process.env, {
		BETTER_AUTH_URL: "http://localhost:3000",
		GOOGLE_CLIENT_ID: "google-client-id",
		GOOGLE_CLIENT_SECRET: "google-client-secret",
		APPLE_CLIENT_ID: "com.example.platform-base",
		APPLE_CLIENT_SECRET: "apple-client-secret",
		MICROSOFT_CLIENT_ID: "microsoft-client-id",
		MICROSOFT_CLIENT_SECRET: "microsoft-client-secret",
	});
	delete process.env.MICROSOFT_TENANT_ID;
});

import { auth } from "./auth.js";

// The URL a provider's sign-in redirects to, built the same way the
// /sign-in/social endpoint does, minus the database write for its state.
async function authorizationURL(providerId: string) {
	const context = await auth.$context;
	const provider = context.socialProviders.find(({ id }) => id === providerId);
	if (!provider) throw new Error(`Provider ${providerId} is not configured`);

	return provider.createAuthorizationURL({
		state: "test-state",
		codeVerifier: "test-code-verifier-that-is-at-least-43-characters",
		redirectURI: `http://localhost:3000/api/auth/callback/${providerId}`,
	});
}

describe("auth config", () => {
	describe("social providers", () => {
		it("enables Google, Apple and Microsoft", async () => {
			const context = await auth.$context;

			expect(context.socialProviders.map(({ id }) => id)).toEqual([
				"google",
				"apple",
				"microsoft",
			]);
		});

		it("sends Apple users to Apple with a form_post callback", async () => {
			const url = await authorizationURL("apple");

			expect(url.origin).toBe("https://appleid.apple.com");
			expect(url.searchParams.get("client_id")).toBe(
				"com.example.platform-base",
			);
			expect(url.searchParams.get("response_mode")).toBe("form_post");
			expect(url.searchParams.get("redirect_uri")).toBe(
				"http://localhost:3000/api/auth/callback/apple",
			);
		});

		it("sends Microsoft users to the common tenant's account picker", async () => {
			const url = await authorizationURL("microsoft");

			expect(url.origin).toBe("https://login.microsoftonline.com");
			expect(url.pathname).toBe("/common/oauth2/v2.0/authorize");
			expect(url.searchParams.get("client_id")).toBe("microsoft-client-id");
			expect(url.searchParams.get("prompt")).toBe("select_account");
			expect(url.searchParams.get("redirect_uri")).toBe(
				"http://localhost:3000/api/auth/callback/microsoft",
			);
		});

		it("trusts Apple's origin, which posts the OAuth callback", async () => {
			const context = await auth.$context;

			expect(context.trustedOrigins).toContain("https://appleid.apple.com");
		});
	});

	// apps/web/src/lib/password-policy.ts mirrors these for client-side
	// validation; update both together.
	it("enforces the password length the web app validates against", async () => {
		const context = await auth.$context;

		expect(context.password.config).toEqual({
			minPasswordLength: 8,
			maxPasswordLength: 128,
		});
	});
});
