import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiGet, apiJson } from "./api";

function jsonResponse(status: number, body: unknown) {
	return {
		ok: status >= 200 && status < 300,
		status,
		json: () => Promise.resolve(body),
	};
}

describe("apiJson", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("sends JSON with the session cookie and the app's locale", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue(jsonResponse(201, { id: "o1" }));
		vi.stubGlobal("fetch", fetchMock);

		const result = await apiJson("/admin/organizations", {
			method: "POST",
			body: { name: "Acme" },
		});

		expect(result).toEqual({ id: "o1" });
		expect(fetchMock).toHaveBeenCalledWith("/api/admin/organizations", {
			method: "POST",
			credentials: "include",
			headers: {
				"Accept-Language": "en",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ name: "Acme" }),
		});
	});

	it("resolves to undefined for 204 No Content", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(204, null)));

		await expect(
			apiJson("/admin/organizations/o1", { method: "DELETE" }),
		).resolves.toBeUndefined();
	});

	it("throws an ApiError with Nest's message, joining validation errors", async () => {
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValue(
					jsonResponse(400, { message: ["slug is invalid", "name is empty"] }),
				),
		);

		const error = await apiJson("/admin/organizations").catch((e) => e);

		expect(error).toBeInstanceOf(ApiError);
		expect(error).toMatchObject({
			status: 400,
			message: "slug is invalid, name is empty",
		});
	});

	it("carries the error's code when the API sends one", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				jsonResponse(409, {
					message: "Email is already in use",
					code: "EMAIL_TAKEN",
				}),
			),
		);

		await expect(apiJson("/admin/account-invitations")).rejects.toMatchObject({
			status: 409,
			code: "EMAIL_TAKEN",
			message: "Email is already in use",
		});
	});

	it("falls back to the status when the error has no body", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: false,
				status: 502,
				json: () => Promise.reject(new SyntaxError("not json")),
			}),
		);

		await expect(apiJson("/admin/stats")).rejects.toMatchObject({
			status: 502,
			message: "API request failed: 502",
		});
	});
});

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
