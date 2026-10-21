import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { adminApi, type OrganizationDetail } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { AdminOrganizationContainer } from "./admin-organization.container";

const navigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
	useParams: () => ({ organizationId: "org-1" }),
	useNavigate: () => navigate,
	Link: ({ children }: { children: React.ReactNode }) => (
		<a href="/">{children}</a>
	),
}));

vi.mock("@/lib/admin-api", () => ({
	MEMBER_ROLES: ["owner", "admin", "member"],
	adminApi: {
		getOrganization: vi.fn(),
		updateOrganization: vi.fn(),
		deleteOrganization: vi.fn(),
		findUserByEmail: vi.fn(),
		addMember: vi.fn(),
		updateMemberRole: vi.fn(),
		removeMember: vi.fn(),
		createTeam: vi.fn(),
		renameTeam: vi.fn(),
		deleteTeam: vi.fn(),
		addTeamMember: vi.fn(),
		removeTeamMember: vi.fn(),
		resendAccountInvitation: vi.fn(),
		cancelAccountInvitation: vi.fn(),
	},
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: { admin: { impersonateUser: vi.fn() } },
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const OWNER = {
	id: "member-1",
	role: "owner",
	createdAt: "2026-10-01T00:00:00.000Z",
	user: {
		id: "user-1",
		name: "Olga Owner",
		email: "olga@example.com",
		image: null,
	},
};
const BOB = {
	id: "member-2",
	role: "member",
	createdAt: "2026-10-02T00:00:00.000Z",
	user: {
		id: "user-2",
		name: "Bob Builder",
		email: "bob@example.com",
		image: null,
	},
};

const ACME: OrganizationDetail = {
	id: "org-1",
	name: "Acme Inc",
	slug: "acme-inc",
	logo: null,
	createdAt: "2026-10-01T00:00:00.000Z",
	members: [OWNER, BOB],
	teams: [
		{
			id: "team-1",
			name: "Acme Inc",
			createdAt: "2026-10-01T00:00:00.000Z",
			memberCount: 1,
			userIds: ["user-1"],
		},
	],
	invitations: [
		{
			id: "inv-1",
			email: "new@example.com",
			role: "admin",
			teamId: "team-1",
			expiresAt: "2026-10-30T00:00:00.000Z",
		},
	],
	ownerSetup: null,
};

const PENDING_SETUP = {
	id: "setup-1",
	email: "olga@example.com",
	expiresAt: "2026-10-28T00:00:00.000Z",
	status: "pending" as const,
};

function renderOrganization() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={queryClient}>
			<AdminOrganizationContainer />
		</QueryClientProvider>,
	);
}

describe("AdminOrganizationContainer", () => {
	beforeEach(() => {
		navigate.mockReset();
		toast.success.mockReset();
		toast.error.mockReset();
		for (const fn of Object.values(adminApi)) {
			vi.mocked(fn)
				.mockReset()
				.mockResolvedValue(ACME as never);
		}
	});

	it("shows the organization with its members, teams and invitations", async () => {
		renderOrganization();

		expect(await screen.findByText(/^acme-inc · Created/)).toBeInTheDocument();
		expect(screen.getByText("Acme Inc")).toBeInTheDocument();
		expect(
			screen.getByRole("tab", { name: "Members (2)" }),
		).toBeInTheDocument();
		expect(screen.getByRole("tab", { name: "Teams (1)" })).toBeInTheDocument();
		expect(
			screen.getByRole("tab", { name: "Invitations (1)" }),
		).toBeInTheDocument();
		expect(screen.getByText("Bob Builder")).toBeInTheDocument();
		expect(adminApi.getOrganization).toHaveBeenCalledWith("org-1");
	});

	it("adds an existing user as a member by email", async () => {
		vi.mocked(adminApi.findUserByEmail).mockResolvedValue({
			id: "user-3",
		} as never);
		renderOrganization();

		await userEvent.click(
			await screen.findByRole("button", { name: "Add member" }),
		);
		const dialog = await screen.findByRole("dialog");
		await userEvent.type(
			within(dialog).getByLabelText("Email"),
			"cara@example.com",
		);
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Add member" }),
		);

		await waitFor(() =>
			expect(adminApi.addMember).toHaveBeenCalledWith("org-1", {
				userId: "user-3",
				role: "member",
			}),
		);
		expect(toast.success).toHaveBeenCalledWith("Member added.");
	});

	it("keeps the add-member dialog open with the API's reason", async () => {
		vi.mocked(adminApi.findUserByEmail).mockResolvedValue({
			id: "user-2",
		} as never);
		vi.mocked(adminApi.addMember).mockRejectedValue(
			new ApiError(409, "User is already a member of this organization"),
		);
		renderOrganization();

		await userEvent.click(
			await screen.findByRole("button", { name: "Add member" }),
		);
		const dialog = await screen.findByRole("dialog");
		await userEvent.type(
			within(dialog).getByLabelText("Email"),
			"bob@example.com",
		);
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Add member" }),
		);

		expect(
			await within(dialog).findByText(
				"User is already a member of this organization",
			),
		).toBeInTheDocument();
	});

	it("asks before removing a member", async () => {
		renderOrganization();

		await userEvent.click(
			await screen.findByRole("button", { name: "Remove Bob Builder" }),
		);
		const dialog = await screen.findByRole("alertdialog", {
			name: "Remove Bob Builder?",
		});
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Remove" }),
		);

		await waitFor(() =>
			expect(adminApi.removeMember).toHaveBeenCalledWith("org-1", "member-2"),
		);
	});

	it("toasts why a one-click change was refused", async () => {
		vi.mocked(adminApi.removeMember).mockRejectedValue(
			new ApiError(400, "An organization must keep at least one owner"),
		);
		renderOrganization();

		await userEvent.click(
			await screen.findByRole("button", { name: "Remove Olga Owner" }),
		);
		const dialog = await screen.findByRole("alertdialog");
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Remove" }),
		);

		await waitFor(() =>
			expect(toast.error).toHaveBeenCalledWith(
				"An organization must keep at least one owner",
			),
		);
	});

	it("creates a team", async () => {
		renderOrganization();

		await userEvent.click(
			await screen.findByRole("tab", { name: "Teams (1)" }),
		);
		await userEvent.click(screen.getByRole("button", { name: "New team" }));
		const dialog = await screen.findByRole("dialog");
		await userEvent.type(
			within(dialog).getByLabelText("Team name"),
			"  Design ",
		);
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Create team" }),
		);

		await waitFor(() =>
			expect(adminApi.createTeam).toHaveBeenCalledWith("org-1", "Design"),
		);
	});

	it("toggles team membership from the team's member list", async () => {
		renderOrganization();

		await userEvent.click(
			await screen.findByRole("tab", { name: "Teams (1)" }),
		);
		await userEvent.click(
			screen.getByRole("button", { name: "Actions for Acme Inc" }),
		);
		await userEvent.click(
			await screen.findByRole("menuitem", { name: "Manage members" }),
		);
		const dialog = await screen.findByRole("dialog", {
			name: "Members of Acme Inc",
		});

		expect(
			within(dialog).getByRole("checkbox", { name: /Olga Owner/ }),
		).toBeChecked();
		await userEvent.click(
			within(dialog).getByRole("checkbox", { name: /Bob Builder/ }),
		);

		await waitFor(() =>
			expect(adminApi.addTeamMember).toHaveBeenCalledWith(
				"org-1",
				"team-1",
				"user-2",
			),
		);
	});

	it("lists pending invitations with their team", async () => {
		renderOrganization();

		await userEvent.click(
			await screen.findByRole("tab", { name: "Invitations (1)" }),
		);

		const row = (await screen.findByText("new@example.com")).closest(
			"tr",
		) as HTMLElement;
		expect(within(row).getByText("Admin")).toBeInTheDocument();
		expect(within(row).getByText("Acme Inc")).toBeInTheDocument();
	});

	it("deletes the organization and goes back to the list", async () => {
		renderOrganization();

		await userEvent.click(
			await screen.findByRole("button", { name: "Delete" }),
		);
		const dialog = await screen.findByRole("alertdialog", {
			name: "Delete Acme Inc?",
		});
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Delete" }),
		);

		await waitFor(() =>
			expect(navigate).toHaveBeenCalledWith({ to: "/admin/organizations" }),
		);
		expect(adminApi.deleteOrganization).toHaveBeenCalledWith("org-1");
	});

	it("says so when the organization can't be loaded", async () => {
		vi.mocked(adminApi.getOrganization).mockRejectedValue(
			new ApiError(404, "Organization not found"),
		);

		renderOrganization();

		expect(
			await screen.findByText(
				"This organization doesn't exist or couldn't be loaded.",
			),
		).toBeInTheDocument();
	});
	describe("owner setup", () => {
		it("isn't shown once the owner has their login", async () => {
			renderOrganization();

			await screen.findAllByText("Olga Owner");
			expect(screen.queryByText("Owner setup")).toBeNull();
		});

		it("shows a pending invitation with its expiry", async () => {
			vi.mocked(adminApi.getOrganization).mockResolvedValue({
				...ACME,
				ownerSetup: PENDING_SETUP,
			});

			renderOrganization();

			const card = (await screen.findByText("Owner setup")).closest(
				"[data-slot=card]",
			) as HTMLElement;
			expect(within(card).getByText("Pending")).toBeInTheDocument();
			expect(
				within(card).getByText(/olga@example.com hasn't set up their login/),
			).toBeInTheDocument();
			expect(within(card).getByText(/Link expires/)).toBeInTheDocument();
		});

		it("marks an expired invitation", async () => {
			vi.mocked(adminApi.getOrganization).mockResolvedValue({
				...ACME,
				ownerSetup: { ...PENDING_SETUP, status: "expired" },
			});

			renderOrganization();

			expect(await screen.findByText("Expired")).toBeInTheDocument();
			expect(screen.getByText(/Link expired/)).toBeInTheDocument();
		});

		it("resends the link", async () => {
			vi.mocked(adminApi.getOrganization).mockResolvedValue({
				...ACME,
				ownerSetup: PENDING_SETUP,
			});
			vi.mocked(adminApi.resendAccountInvitation).mockResolvedValue(
				PENDING_SETUP as never,
			);
			renderOrganization();

			await userEvent.click(
				await screen.findByRole("button", { name: "Resend link" }),
			);

			await waitFor(() =>
				expect(adminApi.resendAccountInvitation).toHaveBeenCalledWith(
					"setup-1",
				),
			);
			await waitFor(() =>
				expect(toast.success).toHaveBeenCalledWith("New link sent."),
			);
		});

		it("cancels after confirming, deleting the organization", async () => {
			vi.mocked(adminApi.getOrganization).mockResolvedValue({
				...ACME,
				ownerSetup: PENDING_SETUP,
			});
			vi.mocked(adminApi.cancelAccountInvitation).mockResolvedValue(
				undefined as never,
			);
			renderOrganization();

			await userEvent.click(
				await screen.findByRole("button", { name: "Cancel invitation" }),
			);
			const dialog = await screen.findByRole("alertdialog", {
				name: "Cancel this invitation?",
			});
			expect(
				within(dialog).getByText(/deletes olga@example.com's account/),
			).toBeInTheDocument();
			await userEvent.click(
				within(dialog).getByRole("button", { name: "Cancel invitation" }),
			);

			await waitFor(() =>
				expect(adminApi.cancelAccountInvitation).toHaveBeenCalledWith(
					"setup-1",
				),
			);
			await waitFor(() =>
				expect(navigate).toHaveBeenCalledWith({ to: "/admin/organizations" }),
			);
		});
	});

	it("impersonates a member to work inside the organization", async () => {
		vi.mocked(authClient.admin.impersonateUser).mockResolvedValue({
			data: null,
			error: { status: 403, message: "nope" },
		} as never);
		renderOrganization();

		await userEvent.click(
			await screen.findByRole("button", { name: "Impersonate Olga Owner" }),
		);

		await waitFor(() =>
			expect(authClient.admin.impersonateUser).toHaveBeenCalledWith({
				userId: "user-1",
			}),
		);
	});
});
