import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { authClient } from "@/lib/auth-client";
import {
	redirectIfSignedIn,
	requireAdmin,
	requireNoOrganization,
	requireOrganization,
	resetAdminAccessCache,
} from "./auth-guards";

vi.mock("@tanstack/react-router", () => ({
	redirect: (options: { to?: string; href?: string }) => ({
		redirect: options.to ?? options.href,
	}),
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		getSession: vi.fn(),
		admin: { hasPermission: vi.fn() },
		organization: { list: vi.fn(), setActive: vi.fn() },
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
	vi.mocked(authClient.organization.list).mockReset();
	vi.mocked(authClient.organization.setActive).mockReset();
});

describe("redirectIfSignedIn", () => {
	it("leaves signed-out visitors on the page", async () => {
		signedOut();

		await expect(redirectIfSignedIn({ search: {} })).resolves.toBeUndefined();
	});

	it("sends signed-in visitors home, which routes them on", async () => {
		signedIn();

		await expect(redirectIfSignedIn({ search: {} })).rejects.toEqual({
			redirect: "/",
		});
	});

	it("sends them to the page they asked for", async () => {
		signedIn();

		await expect(
			redirectIfSignedIn({ search: { redirect: "/invitations/i1" } }),
		).rejects.toEqual({ redirect: "/invitations/i1" });
	});

	it("keeps the query string of that page", async () => {
		signedIn();

		await expect(
			redirectIfSignedIn({
				search: { redirect: "/invitations/i1?email=a%40b.c" },
			}),
		).rejects.toEqual({ redirect: "/invitations/i1?email=a%40b.c" });
	});

	it("ignores redirects that leave the app", async () => {
		signedIn();

		await expect(
			redirectIfSignedIn({ search: { redirect: "//evil.example" } }),
		).rejects.toEqual({ redirect: "/" });
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

function signedInWith(activeOrganizationId: string | null) {
	vi.mocked(authClient.getSession).mockResolvedValue({
		data: {
			session: { id: "session-1", activeOrganizationId },
			user: { id: "user-1" },
		},
		error: null,
	} as never);
}

function organizations(ids: string[]) {
	vi.mocked(authClient.organization.list).mockResolvedValue({
		data: ids.map((id) => ({ id })),
		error: null,
	} as never);
}

describe("requireOrganization", () => {
	it("sends signed-out visitors to sign-in", async () => {
		signedOut();

		await expect(requireOrganization()).rejects.toEqual({
			redirect: "/sign-in",
		});
	});

	it("sends admins to the admin console", async () => {
		signedInWith(null);
		permission(true);

		await expect(requireOrganization()).rejects.toEqual({ redirect: "/admin" });
	});

	it("sends users without an organization to onboarding", async () => {
		signedInWith(null);
		permission(false);
		organizations([]);

		await expect(requireOrganization()).rejects.toEqual({
			redirect: "/onboarding",
		});
	});

	it("activates the first organization when none is active", async () => {
		signedInWith(null);
		permission(false);
		organizations(["org-1", "org-2"]);
		vi.mocked(authClient.organization.setActive).mockResolvedValue({} as never);

		await expect(requireOrganization()).resolves.toBeDefined();
		expect(authClient.organization.setActive).toHaveBeenCalledWith({
			organizationId: "org-1",
		});
	});

	it("activates the user's organization when another one is active", async () => {
		signedInWith("org-stale");
		permission(false);
		organizations(["org-1"]);
		vi.mocked(authClient.organization.setActive).mockResolvedValue({} as never);

		await expect(requireOrganization()).resolves.toBeDefined();
		expect(authClient.organization.setActive).toHaveBeenCalledWith({
			organizationId: "org-1",
		});
	});

	it("leaves an already active organization alone", async () => {
		signedInWith("org-1");
		permission(false);
		organizations(["org-1"]);

		await expect(requireOrganization()).resolves.toBeDefined();
		expect(authClient.organization.setActive).not.toHaveBeenCalled();
	});
});

describe("organization lookup failures", () => {
	it("does not treat a failed lookup as no organization", async () => {
		signedInWith(null);
		permission(false);
		vi.mocked(authClient.organization.list).mockResolvedValue({
			data: null,
			error: { message: "boom" },
		} as never);

		await expect(requireOrganization()).rejects.toThrow("boom");
	});

	it("does not let a member into onboarding when the lookup fails", async () => {
		signedInWith(null);
		permission(false);
		vi.mocked(authClient.organization.list).mockResolvedValue({
			data: null,
			error: { message: "boom" },
		} as never);

		await expect(requireNoOrganization()).rejects.toThrow("boom");
	});

	it("fails when the organization cannot be activated", async () => {
		signedInWith(null);
		permission(false);
		organizations(["org-1"]);
		vi.mocked(authClient.organization.setActive).mockResolvedValue({
			data: null,
			error: { message: "nope" },
		} as never);

		await expect(requireOrganization()).rejects.toThrow("nope");
	});
});

describe("requireNoOrganization", () => {
	it("sends signed-out visitors to sign-in", async () => {
		signedOut();

		await expect(requireNoOrganization()).rejects.toEqual({
			redirect: "/sign-in",
		});
	});

	it("sends superadmins to the admin console", async () => {
		signedInWith(null);
		permission(true);
		organizations([]);

		await expect(requireNoOrganization()).rejects.toEqual({
			redirect: "/admin",
		});
	});

	it("sends members home", async () => {
		signedInWith(null);
		permission(false);
		organizations(["org-1"]);

		await expect(requireNoOrganization()).rejects.toEqual({ redirect: "/" });
	});

	it("lets users without an organization through", async () => {
		signedInWith(null);
		permission(false);
		organizations([]);

		await expect(requireNoOrganization()).resolves.toBeDefined();
	});
});
