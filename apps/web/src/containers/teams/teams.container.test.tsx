import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspace } from "@/containers/workspace/workspace.context";
import { authClient } from "@/lib/auth-client";
import { TeamsContainer } from "./teams.container";

const navigate = vi.fn();
let search: { new?: 1 } = {};

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => navigate,
	useSearch: () => search,
	Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
		<a href={to}>{children}</a>
	),
}));

vi.mock("@/containers/workspace/workspace.context", () => ({
	useWorkspace: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		organization: {
			createTeam: vi.fn(),
			updateTeam: vi.fn(),
			removeTeam: vi.fn(),
		},
	},
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const ORGANIZATION = {
	id: "org-1",
	name: "Acme Inc",
	members: [],
	invitations: [],
	teams: [
		{ id: "t1", name: "Design", memberCount: 3 },
		{ id: "t2", name: "Ops", memberCount: 0 },
	],
};

const MANAGE = ["team:create", "team:update", "team:delete"];

function setViewer(allowed: string[]) {
	vi.mocked(useWorkspace).mockReturnValue({
		organization: ORGANIZATION,
		can: (permissions: Record<string, string[]>) =>
			Object.entries(permissions).every(([resource, actions]) =>
				actions.every((action) => allowed.includes(`${resource}:${action}`)),
			),
		isLoading: false,
	} as never);
}

function renderTeams() {
	const queryClient = new QueryClient();
	const invalidate = vi.spyOn(queryClient, "invalidateQueries");
	render(
		<QueryClientProvider client={queryClient}>
			<TeamsContainer />
		</QueryClientProvider>,
	);
	return { invalidate };
}

describe("TeamsContainer", () => {
	beforeEach(() => {
		search = {};
		navigate.mockReset();
		toast.success.mockReset();
		toast.error.mockReset();
		for (const fn of Object.values(authClient.organization)) {
			vi.mocked(fn)
				.mockReset()
				.mockResolvedValue({ data: {}, error: null } as never);
		}
		setViewer(MANAGE);
	});

	it("lists the teams with their member count, linked to the team", () => {
		renderTeams();

		const row = screen.getByRole("row", { name: /Design/ });
		expect(within(row).getByText("3")).toBeInTheDocument();
		expect(within(row).getByRole("link", { name: "Design" })).toHaveAttribute(
			"href",
			"/teams/$teamId",
		);
		expect(screen.getByRole("row", { name: /Ops/ })).toHaveTextContent("0");
	});

	it("creates a team and refreshes the organization", async () => {
		const { invalidate } = renderTeams();

		await userEvent.click(screen.getByRole("button", { name: "New team" }));
		const dialog = await screen.findByRole("dialog");
		await userEvent.type(within(dialog).getByLabelText("Team name"), "Sales");
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Create team" }),
		);

		await waitFor(() =>
			expect(authClient.organization.createTeam).toHaveBeenCalledWith({
				name: "Sales",
			}),
		);
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		expect(invalidate).toHaveBeenCalledWith({ queryKey: ["organization"] });
	});

	it("keeps the dialog open and shows the error when creating fails", async () => {
		vi.mocked(authClient.organization.createTeam).mockResolvedValue({
			data: null,
			error: { message: "Team exists", status: 400 },
		} as never);
		renderTeams();

		await userEvent.click(screen.getByRole("button", { name: "New team" }));
		const dialog = await screen.findByRole("dialog");
		await userEvent.type(within(dialog).getByLabelText("Team name"), "Sales");
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Create team" }),
		);

		expect(await within(dialog).findByText("Team exists")).toBeVisible();
	});

	it("opens the create dialog from ?new=1", async () => {
		search = { new: 1 };
		renderTeams();

		expect(
			await screen.findByRole("dialog", { name: "Create a team" }),
		).toBeInTheDocument();
	});

	it("renames a team", async () => {
		renderTeams();

		await userEvent.click(
			screen.getByRole("button", { name: "Rename Design" }),
		);
		const dialog = await screen.findByRole("dialog");
		const input = within(dialog).getByLabelText("Team name");
		expect(input).toHaveValue("Design");
		await userEvent.clear(input);
		await userEvent.type(input, "Product");
		await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));

		await waitFor(() =>
			expect(authClient.organization.updateTeam).toHaveBeenCalledWith({
				teamId: "t1",
				data: { name: "Product" },
			}),
		);
	});

	it("asks for confirmation before deleting a team", async () => {
		const { invalidate } = renderTeams();

		await userEvent.click(
			screen.getByRole("button", { name: "Delete Design" }),
		);
		expect(authClient.organization.removeTeam).not.toHaveBeenCalled();
		await userEvent.click(
			within(await screen.findByRole("alertdialog")).getByRole("button", {
				name: "Delete",
			}),
		);

		await waitFor(() =>
			expect(authClient.organization.removeTeam).toHaveBeenCalledWith({
				teamId: "t1",
			}),
		);
		await waitFor(() =>
			expect(invalidate).toHaveBeenCalledWith({ queryKey: ["organization"] }),
		);
	});

	it("shows a plain member the list without any controls", () => {
		setViewer([]);
		search = { new: 1 };
		renderTeams();

		expect(screen.getByRole("row", { name: /Design/ })).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "New team" })).toBeNull();
		expect(screen.queryByRole("button", { name: /^Rename/ })).toBeNull();
		expect(screen.queryByRole("button", { name: /^Delete/ })).toBeNull();
		expect(screen.queryByRole("dialog")).toBeNull();
	});
});
