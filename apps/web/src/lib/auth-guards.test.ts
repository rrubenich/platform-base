import { beforeEach, describe, expect, it, vi } from "vitest";
import { authClient } from "@/lib/auth-client";
import {
	redirectIfSignedIn,
	requireAdmin,
	requireUser,
	resetAdminAccessCache,
} from "./auth-guards";

vi.mock("@tanstack/react-router", () => ({
	redirect: (options: { to: string }) => ({ redirect: options.to }),
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		getSession: vi.fn(),
		admin: { hasPermission: vi.fn() },
	},
}));

function signedOut() {
	vi.mocked(authClient.getSession).mockResolvedValue({
		data: null,
		error: null,
	} as never);
}

function signedIn(sessionId = "session-1") {
	vi.mocked(authClient.getSession).mockResolvedValue({
		data: { session: { id: sessionId }, user: { id: "user-1" } },
		error: null,
	} as never);
}

function permission(success: boolean) {
	vi.mocked(authClient.admin.hasPermission).mockResolvedValue({
		data: { success, error: null },
		error: null,
	} as never);
}

beforeEach(() => {
	resetAdminAccessCache();
	vi.mocked(authClient.getSession).mockReset();
	vi.mocked(authClient.admin.hasPermission).mockReset();
});

describe("requireUser", () => {
	it("sends signed-out visitors to sign-in", async () => {
		signedOut();

		await expect(requireUser()).rejects.toEqual({ redirect: "/sign-in" });
	});

	it("sends admins to the admin console", async () => {
		signedIn();
		permission(true);

		await expect(requireUser()).rejects.toEqual({ redirect: "/admin" });
	});

	it("lets regular users in", async () => {
		signedIn();
		permission(false);

		await expect(requireUser()).resolves.toMatchObject({
			session: { session: { id: "session-1" } },
		});
	});
});

describe("redirectIfSignedIn", () => {
	it("leaves signed-out visitors on the page", async () => {
		signedOut();

		await expect(redirectIfSignedIn()).resolves.toBeUndefined();
	});

	it("sends signed-in visitors home, which routes them on", async () => {
		signedIn();

		await expect(redirectIfSignedIn()).rejects.toEqual({ redirect: "/" });
	});
});

describe("requireAdmin", () => {
	it("sends signed-out visitors to sign-in", async () => {
		signedOut();

		await expect(requireAdmin()).rejects.toEqual({ redirect: "/sign-in" });
		expect(authClient.admin.hasPermission).not.toHaveBeenCalled();
	});

	it("sends users without admin access home", async () => {
		signedIn();
		permission(false);

		await expect(requireAdmin()).rejects.toEqual({ redirect: "/" });
	});

	it("lets admins in, asking the API rather than reading the role", async () => {
		signedIn();
		permission(true);

		await expect(requireAdmin()).resolves.toMatchObject({
			session: { session: { id: "session-1" } },
		});
		expect(authClient.admin.hasPermission).toHaveBeenCalledWith({
			permissions: { user: ["list"] },
		});
	});

	it("checks once per session, not on every navigation", async () => {
		signedIn("session-1");
		permission(true);

		await requireAdmin();
		await requireAdmin();
		expect(authClient.admin.hasPermission).toHaveBeenCalledTimes(1);

		signedIn("session-2");
		permission(false);
		await expect(requireAdmin()).rejects.toEqual({ redirect: "/" });
		expect(authClient.admin.hasPermission).toHaveBeenCalledTimes(2);
	});
});
