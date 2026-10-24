import { describe, expect, it } from "vite-plus/test";
import { slugify } from "./slugify";

describe("slugify", () => {
	it.each([
		["Acme, Inc.", "acme-inc"],
		["  São Paulo Ltda  ", "sao-paulo-ltda"],
		["Über--Cool__Team", "uber-cool-team"],
		["!!!", ""],
	])("%s → %s", (name, slug) => {
		expect(slugify(name)).toBe(slug);
	});

	it("matches the API's slug rule", () => {
		expect(slugify("Ação & Reação 2026")).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
	});
});
