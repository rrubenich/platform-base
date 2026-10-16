import { describe, expect, it } from "vitest";
import { authErrorMessage } from "./auth-error";

describe("authErrorMessage", () => {
	it("shows the API's (already translated) message", () => {
		expect(
			authErrorMessage(
				{ status: 401, message: "Invalid email or password" },
				"fallback",
			),
		).toBe("Invalid email or password");
	});

	it("translates rate limiting, which the API answers untranslated", () => {
		expect(
			authErrorMessage(
				{ status: 429, message: "Too many requests. Please try again later." },
				"fallback",
			),
		).toBe("Too many requests. Please try again later.");
	});

	it("falls back when there is no message", () => {
		expect(authErrorMessage({ status: 500 }, "fallback")).toBe("fallback");
		expect(authErrorMessage({ status: 500, message: "" }, "fallback")).toBe(
			"fallback",
		);
	});
});
