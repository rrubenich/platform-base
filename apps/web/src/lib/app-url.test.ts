import { describe, expect, it } from "vite-plus/test";
import { appURL } from "./app-url";

describe("appURL", () => {
	it("resolves a path against the current origin", () => {
		expect(appURL("/")).toBe(`${window.location.origin}/`);
		expect(appURL("/sign-in")).toBe(`${window.location.origin}/sign-in`);
	});
});
