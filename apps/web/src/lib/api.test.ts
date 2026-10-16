import { afterEach, describe, expect, it, vi } from "vitest";
import { apiGet } from "./api";

describe("apiGet", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("requests the given path under the API base URL in the app's locale", async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			text: () => Promise.resolve("Hello World!"),
		});
		vi.stubGlobal("fetch", fetchMock);

		const result = await apiGet("");

		expect(fetchMock).toHaveBeenCalledWith("/api", {
			headers: { "Accept-Language": "en" },
		});
		expect(result).toBe("Hello World!");
	});

	it("throws when the response is not ok", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: false,
				status: 500,
				text: () => Promise.resolve(""),
			}),
		);

		await expect(apiGet("")).rejects.toThrow("API request failed: 500");
	});
});
