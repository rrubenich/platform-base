import { describe, expect, it } from "vite-plus/test";
import { parseOrganizationsSearch } from "./admin-organizations.search";

describe("parseOrganizationsSearch", () => {
	it("keeps a valid query and page, dropping the rest", () => {
		expect(parseOrganizationsSearch({ q: "acme", page: "2" })).toEqual({
			q: "acme",
			page: 2,
		});
		expect(parseOrganizationsSearch({ q: "", page: "0" })).toEqual({});
	});
});
