import { describe, expect, it } from "vitest";
import { authClient } from "./auth-client";

describe("authClient", () => {
	// Better Auth throws "Invalid base URL" at construction time when given a
	// relative path, which is what VITE_API_URL falls back to in development.
	it("is constructed with an absolute base URL", () => {
		expect(authClient).toBeDefined();
		expect(authClient.signIn.magicLink).toBeTypeOf("function");
	});
});
