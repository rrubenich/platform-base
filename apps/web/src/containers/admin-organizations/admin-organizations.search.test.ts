import { describe, expect, it } from "vitest";
import {
	parseOrganizationsSearch,
	slugify,
} from "./admin-organizations.search";

describe("parseOrganizationsSearch", () => {
	it("keeps a valid query and page, dropping the rest", () => {
		expect(parseOrganizationsSearch({ q: "acme", page: "2" })).toEqual({
			q: "acme",
			page: 2,
		});
		expect(parseOrganizationsSearch({ q: "", page: "0" })).toEqual({});
	});
});

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
