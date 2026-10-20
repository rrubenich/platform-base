import { describe, expect, it } from "vitest";
import { parseUsersSearch } from "./admin-users.search";

describe("parseUsersSearch", () => {
	it("keeps a valid query, filter and page", () => {
		expect(
			parseUsersSearch({ q: " jane ", filter: "banned", page: "3" }),
		).toEqual({ q: "jane", filter: "banned", page: 3 });
	});

	it("drops unknown filters, blank queries and pages below two", () => {
		expect(parseUsersSearch({ q: "  ", filter: "owners", page: 1 })).toEqual(
			{},
		);
		expect(parseUsersSearch({ page: "abc" })).toEqual({});
		expect(parseUsersSearch({ page: 2.5 })).toEqual({});
	});
});
