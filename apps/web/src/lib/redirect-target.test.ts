import { describe, expect, it } from "vite-plus/test";
import {
	parseAuthSearch,
	redirectNavigation,
	safeRedirect,
} from "./redirect-target";

describe("safeRedirect", () => {
	it("keeps same-origin paths, query included", () => {
		expect(safeRedirect("/invitations/abc?email=a%40b.c")).toBe(
			"/invitations/abc?email=a%40b.c",
		);
	});

	it.each([
		undefined,
		"https://evil.example",
		"//evil.example",
		"javascript:alert(1)",
		"/\\evil.example",
		"/\t/evil.example",
		"/\n/evil.example",
		"",
	])("falls back to / for %s", (target) => {
		expect(safeRedirect(target)).toBe("/");
	});
});

describe("parseAuthSearch", () => {
	it("keeps only redirect and email", () => {
		expect(
			parseAuthSearch({ redirect: "/x", email: "a@b.c", other: 1 }),
		).toEqual({ redirect: "/x", email: "a@b.c" });
	});

	it("drops non-string values", () => {
		expect(parseAuthSearch({ redirect: 1, email: {} })).toEqual({});
	});
});

describe("redirectNavigation", () => {
	it("uses to for plain paths and href when there is a query", () => {
		expect(redirectNavigation("/invitations/i1")).toEqual({
			to: "/invitations/i1",
		});
		expect(redirectNavigation("/i/1?email=a")).toEqual({
			href: "/i/1?email=a",
		});
		expect(redirectNavigation("//evil")).toEqual({ to: "/" });
	});
});
