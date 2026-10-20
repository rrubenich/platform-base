import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspace } from "@/containers/workspace/workspace.context";
import { authClient } from "@/lib/auth-client";
import { formatDate } from "@/lib/format";
import { MembersContainer } from "./members.container";

const navigate = vi.fn();
let search: { tab?: "invitations"; invite?: 1 } = {};

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => navigate,
	useSearch: () => search,
}));

vi.mock("@/containers/workspace/workspace.context", () => ({
	useWorkspace: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		organization: {
			inviteMember: vi.fn(),
			cancelInvitation: vi.fn(),
			updateMemberRole: vi.fn(),
			removeMember: vi.fn(),
		},
	},
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const ORGANIZATION = {
	id: "org-1",
	name: "Acme Inc",
	members: [
		{
			id: "member-1",
			userId: "user-1",
			role: "owner",
			createdAt: "2026-10-01T00:00:00.000Z",
			user: { id: "user-1", name: "Olga Owner", email: "olga@example.com" },
		},
		{
			id: "member-2",
			userId: "user-2",
			role: "member",
			createdAt: "2026-10-02T00:00:00.000Z",
			user: { id: "user-2", name: "Bob Builder", email: "bob@example.com" },
		},
	],
	invitations: [
		{
			id: "inv-1",
			email: "carol@example.com",
			role: "admin",
			status: "pending",
			teamId: "t1",
			expiresAt: "2026-10-30T00:00:00.000Z",
		},
		{
			id: "inv-2",
			email: "dave@example.com",
			role: "member",
			status: "accepted",
			teamId: null,
			expiresAt: "2026-10-30T00:00:00.000Z",
		},
	],
	teams: [{ id: "t1", name: "Design" }],
};

const MANAGE = ["member:update", "member:delete", "invitation:create"];

function setViewer(role: string, userId: string, allowed: string[]) {
	vi.mocked(useWorkspace).mockReturnValue({
		organization: ORGANIZATION,
		role,
		userId,
		can: (permissions: Record<string, string[]>) =>
			Object.entries(permissions).every(([resource, actions]) =>
				actions.every((action) => allowed.includes(`${resource}:${action}`)),
			),
		isLoading: false,
	} as never);
}

function renderMembers() {
	const queryClient = new QueryClient();
	const invalidate = vi.spyOn(queryClient, "invalidateQueries");
	render(
		<QueryClientProvider client={queryClient}>
			<MembersContainer />
		</QueryClientProvider>,
	);
	return { invalidate };
}

describe("MembersContainer", () => {
	beforeEach(() => {
		search = {};
		navigate.mockReset();
		toast.success.mockReset();
		toast.error.mockReset();
		for (const fn of Object.values(authClient.organization)) {
			vi.mocked(fn)
				.mockReset()
				.mockResolvedValue({
					data: {},
					error: null,
				} as never);
		}
		setViewer("owner", "user-1", [...MANAGE, "invitation:cancel"]);
	});

	it("lists the members with name, email, role and joined date", () => {
		renderMembers();

		const row = screen.getByRole("row", { name: /Bob Builder/ });
		expect(within(row).getByText("bob@example.com")).toBeInTheDocument();
		expect(
			within(row).getByText(formatDate("2026-10-02T00:00:00.000Z")),
		).toBeInTheDocument();
		expect(screen.getByRole("row", { name: /Olga Owner/ })).toHaveTextContent(
			"Owner",
		);
	});

	it("changes a member's role and refreshes the organization", async () => {
		const { invalidate } = renderMembers();

		await userEvent.click(
			screen.getByRole("combobox", { name: "Role for Bob Builder" }),
		);
		await userEvent.click(await screen.findByRole("option", { name: "Admin" }));

		await waitFor(() =>
			expect(authClient.organization.updateMemberRole).toHaveBeenCalledWith({
				memberId: "member-2",
				role: "admin",
			}),
		);
		await waitFor(() =>
			expect(invalidate).toHaveBeenCalledWith({ queryKey: ["organization"] }),
		);
		expect(toast.success).toHaveBeenCalled();
	});

	it("offers the Owner role only to owners", async () => {
		renderMembers();
		await userEvent.click(
			screen.getByRole("combobox", { name: "Role for Bob Builder" }),
		);
		expect(
			await screen.findByRole("option", { name: "Owner" }),
		).toBeInTheDocument();
	});

	it("does not offer Owner to an admin", async () => {
		setViewer("admin", "user-3", MANAGE);
		renderMembers();

		await userEvent.click(
			screen.getByRole("combobox", { name: "Role for Bob Builder" }),
		);
		await screen.findByRole("option", { name: "Admin" });
		expect(screen.queryByRole("option", { name: "Owner" })).toBeNull();
	});

	it("asks for confirmation before removing a member", async () => {
		const { invalidate } = renderMembers();

		await userEvent.click(
			screen.getByRole("button", { name: "Remove Bob Builder" }),
		);
		expect(authClient.organization.removeMember).not.toHaveBeenCalled();
		await userEvent.click(
			within(await screen.findByRole("alertdialog")).getByRole("button", {
				name: "Remove",
			}),
		);

		await waitFor(() =>
			expect(authClient.organization.removeMember).toHaveBeenCalledWith({
				memberIdOrEmail: "member-2",
			}),
		);
		await waitFor(() =>
			expect(invalidate).toHaveBeenCalledWith({ queryKey: ["organization"] }),
		);
	});

	it("toasts when a one-click action fails", async () => {
		vi.mocked(authClient.organization.removeMember).mockResolvedValue({
			data: null,
			error: { message: "Nope", status: 403 },
		} as never);
		renderMembers();

		await userEvent.click(
			screen.getByRole("button", { name: "Remove Bob Builder" }),
		);
		await userEvent.click(
			within(await screen.findByRole("alertdialog")).getByRole("button", {
				name: "Remove",
			}),
		);

		await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Nope"));
	});

	async function fillInvite() {
		await userEvent.click(
			screen.getByRole("button", { name: "Invite member" }),
		);
		const dialog = await screen.findByRole("dialog");
		await userEvent.type(
			within(dialog).getByLabelText("Email"),
			"new@example.com",
		);
		await userEvent.click(within(dialog).getByLabelText("Team (optional)"));
		await userEvent.click(
			await screen.findByRole("option", { name: "Design" }),
		);
		return dialog;
	}

	it("invites someone, with a team, and closes the dialog", async () => {
		const { invalidate } = renderMembers();
		const dialog = await fillInvite();

		await userEvent.click(
			within(dialog).getByRole("button", { name: "Send invitation" }),
		);

		await waitFor(() =>
			expect(authClient.organization.inviteMember).toHaveBeenCalledWith({
				email: "new@example.com",
				role: "member",
				teamId: "t1",
			}),
		);
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		expect(invalidate).toHaveBeenCalledWith({ queryKey: ["organization"] });
	});

	it("keeps the dialog open and shows the error when inviting fails", async () => {
		vi.mocked(authClient.organization.inviteMember).mockResolvedValue({
			data: null,
			error: { message: "Already invited", status: 400 },
		} as never);
		renderMembers();
		const dialog = await fillInvite();

		await userEvent.click(
			within(dialog).getByRole("button", { name: "Send invitation" }),
		);

		expect(await within(dialog).findByText("Already invited")).toBeVisible();
		expect(screen.getByRole("dialog")).toBeInTheDocument();
	});

	it("opens the invite dialog from ?invite=1", async () => {
		search = { invite: 1 };
		renderMembers();

		expect(
			await screen.findByRole("dialog", { name: "Invite a member" }),
		).toBeInTheDocument();
	});

	it("does not open the invite dialog from ?invite=1 for a plain member", () => {
		setViewer("member", "user-2", []);
		search = { invite: 1 };
		renderMembers();

		expect(screen.queryByRole("dialog")).toBeNull();
	});

	describe("invitations", () => {
		beforeEach(() => {
			search = { tab: "invitations" };
		});

		it("lists pending invitations only", () => {
			renderMembers();

			expect(screen.getByText("carol@example.com")).toBeInTheDocument();
			expect(screen.getByText("Design")).toBeInTheDocument();
			expect(screen.queryByText("dave@example.com")).toBeNull();
		});

		it("resends an invitation", async () => {
			const { invalidate } = renderMembers();

			await userEvent.click(screen.getByRole("button", { name: "Resend" }));

			await waitFor(() =>
				expect(authClient.organization.inviteMember).toHaveBeenCalledWith({
					email: "carol@example.com",
					role: "admin",
					teamId: "t1",
					resend: true,
				}),
			);
			await waitFor(() =>
				expect(invalidate).toHaveBeenCalledWith({ queryKey: ["organization"] }),
			);
		});

		it("cancels an invitation", async () => {
			renderMembers();

			await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

			await waitFor(() =>
				expect(authClient.organization.cancelInvitation).toHaveBeenCalledWith({
					invitationId: "inv-1",
				}),
			);
		});

		it("switches tabs through the URL", async () => {
			search = {};
			renderMembers();

			await userEvent.click(screen.getByRole("tab", { name: /Invitations/ }));

			expect(navigate).toHaveBeenCalledWith(
				expect.objectContaining({ replace: true }),
			);
		});
	});

	it("shows a plain member the list without any controls", () => {
		setViewer("member", "user-2", []);
		renderMembers();

		expect(
			screen.getByRole("row", { name: /Bob Builder/ }),
		).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Invite member" })).toBeNull();
		expect(screen.queryByRole("combobox")).toBeNull();
		expect(screen.queryByRole("button", { name: /^Remove/ })).toBeNull();
	});
});
