import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspace } from "@/containers/workspace/workspace.context";
import { authClient } from "@/lib/auth-client";
import { OrganizationSettingsContainer } from "./organization-settings.container";

const navigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => navigate,
}));

vi.mock("@/containers/workspace/workspace.context", () => ({
	useWorkspace: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		organization: {
			update: vi.fn(),
			checkSlug: vi.fn(),
			updateMemberRole: vi.fn(),
			leave: vi.fn(),
			delete: vi.fn(),
		},
	},
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const ORGANIZATION = {
	id: "org-1",
	name: "Acme Inc",
	slug: "acme",
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
	invitations: [],
	teams: [],
};

const OWNER = ["organization:update", "organization:delete"];

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

function renderSettings() {
	const queryClient = new QueryClient();
	const invalidate = vi.spyOn(queryClient, "invalidateQueries");
	render(
		<QueryClientProvider client={queryClient}>
			<OrganizationSettingsContainer />
		</QueryClientProvider>,
	);
	return { invalidate };
}

describe("OrganizationSettingsContainer", () => {
	beforeEach(() => {
		navigate.mockReset();
		toast.success.mockReset();
		toast.error.mockReset();
		for (const fn of Object.values(authClient.organization)) {
			vi.mocked(fn)
				.mockReset()
				.mockResolvedValue({ data: {}, error: null } as never);
		}
		vi.mocked(authClient.organization.checkSlug).mockResolvedValue({
			data: { status: true },
			error: null,
		} as never);
		setViewer("owner", "user-1", OWNER);
	});

	describe("general", () => {
		it("saves the name and slug and refreshes the organization", async () => {
			const { invalidate } = renderSettings();

			const name = screen.getByLabelText("Organization name");
			await userEvent.clear(name);
			await userEvent.type(name, "Acme Corp");
			const slug = screen.getByLabelText("URL slug");
			await userEvent.clear(slug);
			await userEvent.type(slug, "acme-corp");
			await userEvent.click(
				screen.getByRole("button", { name: "Save changes" }),
			);

			await waitFor(() =>
				expect(authClient.organization.update).toHaveBeenCalledWith({
					data: { name: "Acme Corp", slug: "acme-corp" },
				}),
			);
			await waitFor(() =>
				expect(invalidate).toHaveBeenCalledWith({ queryKey: ["organization"] }),
			);
			expect(toast.success).toHaveBeenCalled();
		});

		it("flags a slug that is taken", async () => {
			vi.mocked(authClient.organization.checkSlug).mockResolvedValue({
				data: null,
				error: { code: "SLUG_IS_TAKEN", message: "taken" },
			} as never);
			renderSettings();

			const slug = screen.getByLabelText("URL slug");
			await userEvent.clear(slug);
			await userEvent.type(slug, "taken-one");

			expect(
				await screen.findByText("This slug is already taken."),
			).toBeInTheDocument();
			expect(
				screen.getByRole("button", { name: "Save changes" }),
			).toBeDisabled();
		});

		it("does not check the organization's own slug", async () => {
			renderSettings();
			await userEvent.type(screen.getByLabelText("Organization name"), "!");

			await new Promise((resolve) => setTimeout(resolve, 400));
			expect(authClient.organization.checkSlug).not.toHaveBeenCalled();
			expect(screen.queryByText("This slug is already taken.")).toBeNull();
		});

		it("shows a failed save inline", async () => {
			vi.mocked(authClient.organization.update).mockResolvedValue({
				data: null,
				error: { message: "Slug in use", status: 400 },
			} as never);
			renderSettings();

			await userEvent.type(screen.getByLabelText("Organization name"), "!");
			await userEvent.click(
				screen.getByRole("button", { name: "Save changes" }),
			);

			expect(await screen.findByText("Slug in use")).toBeVisible();
		});

		it("is read-only without the update permission", () => {
			setViewer("member", "user-2", []);
			renderSettings();

			expect(screen.getByLabelText("Organization name")).toBeDisabled();
			expect(screen.getByLabelText("URL slug")).toBeDisabled();
			expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
		});
	});

	describe("danger zone", () => {
		it("shows an admin only Leave", () => {
			setViewer("admin", "user-3", ["organization:update"]);
			renderSettings();

			expect(
				screen.getByRole("button", { name: "Leave organization" }),
			).toBeInTheDocument();
			expect(
				screen.getByRole("button", { name: "Save changes" }),
			).toBeVisible();
			expect(
				screen.queryByRole("button", { name: "Transfer ownership" }),
			).toBeNull();
			expect(
				screen.queryByRole("button", { name: "Delete organization" }),
			).toBeNull();
		});

		async function openTransfer() {
			await userEvent.click(
				screen.getByRole("button", { name: "Transfer ownership" }),
			);
			const dialog = await screen.findByRole("dialog");
			await userEvent.click(within(dialog).getByLabelText("New owner"));
			await userEvent.click(
				await screen.findByRole("option", { name: "Bob Builder" }),
			);
			return dialog;
		}

		it("promotes the new owner first, then demotes the old one", async () => {
			const { invalidate } = renderSettings();
			const dialog = await openTransfer();

			await userEvent.click(
				within(dialog).getByRole("button", { name: "Transfer ownership" }),
			);

			await waitFor(() =>
				expect(authClient.organization.updateMemberRole).toHaveBeenCalledTimes(
					2,
				),
			);
			const update = vi.mocked(authClient.organization.updateMemberRole);
			expect(update).toHaveBeenNthCalledWith(1, {
				memberId: "member-2",
				role: "owner",
			});
			expect(update).toHaveBeenNthCalledWith(2, {
				memberId: "member-1",
				role: "admin",
			});
			expect(update.mock.invocationCallOrder[0]).toBeLessThan(
				update.mock.invocationCallOrder[1],
			);
			await waitFor(() =>
				expect(invalidate).toHaveBeenCalledWith({ queryKey: ["organization"] }),
			);
		});

		it("shows the error and does not retry when the demotion fails", async () => {
			vi.mocked(authClient.organization.updateMemberRole)
				.mockResolvedValueOnce({ data: {}, error: null } as never)
				.mockResolvedValueOnce({
					data: null,
					error: { message: "Cannot demote", status: 403 },
				} as never);
			renderSettings();
			const dialog = await openTransfer();

			await userEvent.click(
				within(dialog).getByRole("button", { name: "Transfer ownership" }),
			);

			expect(await within(dialog).findByText("Cannot demote")).toBeVisible();
			expect(authClient.organization.updateMemberRole).toHaveBeenCalledTimes(2);
		});

		it("does not demote when the promotion fails", async () => {
			vi.mocked(authClient.organization.updateMemberRole).mockResolvedValueOnce(
				{
					data: null,
					error: { message: "Cannot promote", status: 403 },
				} as never,
			);
			renderSettings();
			const dialog = await openTransfer();

			await userEvent.click(
				within(dialog).getByRole("button", { name: "Transfer ownership" }),
			);

			expect(await within(dialog).findByText("Cannot promote")).toBeVisible();
			expect(authClient.organization.updateMemberRole).toHaveBeenCalledTimes(1);
		});

		it("leaves the organization and goes to onboarding", async () => {
			setViewer("admin", "user-3", ["organization:update"]);
			const { invalidate } = renderSettings();

			await userEvent.click(
				screen.getByRole("button", { name: "Leave organization" }),
			);
			await userEvent.click(
				within(await screen.findByRole("alertdialog")).getByRole("button", {
					name: "Leave",
				}),
			);

			await waitFor(() =>
				expect(authClient.organization.leave).toHaveBeenCalledWith({
					organizationId: "org-1",
				}),
			);
			await waitFor(() =>
				expect(navigate).toHaveBeenCalledWith({ to: "/onboarding" }),
			);
			expect(invalidate).toHaveBeenCalledWith({ queryKey: ["organization"] });
		});

		it("tells the only owner to transfer ownership first", async () => {
			vi.mocked(authClient.organization.leave).mockResolvedValue({
				data: null,
				error: {
					code: "YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER",
					message: "You cannot leave",
					status: 400,
				},
			} as never);
			renderSettings();

			await userEvent.click(
				screen.getByRole("button", { name: "Leave organization" }),
			);
			await userEvent.click(
				within(await screen.findByRole("alertdialog")).getByRole("button", {
					name: "Leave",
				}),
			);

			await waitFor(() =>
				expect(toast.error).toHaveBeenCalledWith(
					"You are the only owner. Transfer ownership to another member before leaving.",
				),
			);
			expect(navigate).not.toHaveBeenCalled();
		});

		it("deletes the organization only once its name is typed exactly", async () => {
			const { invalidate } = renderSettings();

			await userEvent.click(
				screen.getByRole("button", { name: "Delete organization" }),
			);
			const dialog = await screen.findByRole("dialog");
			const submit = within(dialog).getByRole("button", {
				name: "Delete organization",
			});
			const input = within(dialog).getByLabelText("Type Acme Inc to confirm");
			expect(submit).toBeDisabled();

			await userEvent.type(input, "acme inc");
			expect(submit).toBeDisabled();

			await userEvent.clear(input);
			await userEvent.type(input, "Acme Inc");
			expect(submit).toBeEnabled();
			await userEvent.click(submit);

			await waitFor(() =>
				expect(authClient.organization.delete).toHaveBeenCalledWith({
					organizationId: "org-1",
				}),
			);
			await waitFor(() =>
				expect(navigate).toHaveBeenCalledWith({ to: "/onboarding" }),
			);
			expect(invalidate).toHaveBeenCalledWith({ queryKey: ["organization"] });
		});
	});
});
