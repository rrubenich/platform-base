import { describe, expect, it } from "vitest";
import { can } from "./organization";

describe("can", () => {
	it("denies a member what only admins may do", () => {
		expect(can("member", { member: ["create"] })).toBe(false);
	});

	it("allows an admin to manage members", () => {
		expect(can("admin", { member: ["create"] })).toBe(true);
	});

	it("keeps organization deletion to the owner", () => {
		expect(can("admin", { organization: ["delete"] })).toBe(false);
		expect(can("owner", { organization: ["delete"] })).toBe(true);
	});

	it("denies everything without a role", () => {
		expect(can(undefined, { member: ["create"] })).toBe(false);
	});
});
