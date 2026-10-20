import { describe, expect, it } from "vitest";
import { can, isPendingInvitation } from "./organization";

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

describe("isPendingInvitation", () => {
	const now = new Date("2026-10-20T12:00:00.000Z");

	it("keeps a pending invitation that hasn't expired", () => {
		expect(
			isPendingInvitation(
				{ status: "pending", expiresAt: "2026-10-27T12:00:00.000Z" },
				now,
			),
		).toBe(true);
	});

	it("drops a pending invitation past its expiry", () => {
		expect(
			isPendingInvitation(
				{ status: "pending", expiresAt: "2026-10-19T12:00:00.000Z" },
				now,
			),
		).toBe(false);
	});

	it("drops invitations that aren't pending", () => {
		expect(
			isPendingInvitation(
				{ status: "canceled", expiresAt: "2026-10-27T12:00:00.000Z" },
				now,
			),
		).toBe(false);
	});
});
