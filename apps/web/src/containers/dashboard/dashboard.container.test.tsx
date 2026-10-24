import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspace } from "@/containers/workspace/workspace.context";
import { authClient } from "@/lib/auth-client";
import { DashboardContainer } from "./dashboard.container";

const navigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => navigate,
	Link: ({
		to,
		search,
		children,
	}: {
		to: string;
		search?: Record<string, unknown>;
		children: React.ReactNode;
	}) => (
		<a
			href={
				search
					? `${to}?${new URLSearchParams(search as Record<string, string>)}`
					: to
			}
		>
			{children}
		</a>
	),
}));

vi.mock("@/containers/workspace/workspace.context", () => ({
	useWorkspace: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: { organization: { listUserTeams: vi.fn() }, $fetch: vi.fn() },
}));

function member(n: number, name: string, role = "member") {
	return {
		id: `member-${n}`,
		userId: `user-${n}`,
		role,
		createdAt: `2026-10-0${n}T00:00:00.000Z`,
		user: { id: `user-${n}`, name, email: `${name.toLowerCase()}@example.com` },
	};
}

const NAMES = ["Anna", "Bruno", "Carla", "Diego", "Elena", "Fabio", "Gina"];

const ORGANIZATION = {
	id: "org-1",
	name: "Acme Inc",
	members: NAMES.map((name, index) =>
		member(
			index + 1,
			name,
			index === 0 ? "owner" : index === 1 ? "admin" : "member",
		),
	),
	invitations: [
		{
			id: "i1",
			email: "a@x.com",
			role: "admin",
			status: "pending",
			expiresAt: "2100-01-01",
		},
		{ id: "i2", email: "b@x.com", status: "pending", expiresAt: "2100-01-01" },
		{ id: "i3", email: "c@x.com", status: "accepted", expiresAt: "2100-01-01" },
		{ id: "i4", email: "d@x.com", status: "pending", expiresAt: "2020-01-01" },
	],
	teams: [
		{ id: "t0", name: "Acme Inc", memberCount: 7, createdAt: "2026-10-01" },
		{ id: "t1", name: "Design", memberCount: 3, createdAt: "2026-10-02" },
		{ id: "t2", name: "Platform", memberCount: 1, createdAt: "2026-10-03" },
	],
};

const MANAGER = ["invitation:create", "team:create"];

function setViewer(
	allowed: string[],
	{ organization = ORGANIZATION as object, userId = "user-1" } = {},
) {
	vi.mocked(useWorkspace).mockReturnValue({
		organization,
		role: allowed.length > 0 ? "owner" : "member",
		userId,
		user: { name: "Diego Silva", email: "diego@example.com" },
		can: (permissions: Record<string, string[]>) =>
			Object.entries(permissions).every(([resource, actions]) =>
				actions.every((action) => allowed.includes(`${resource}:${action}`)),
			),
		isLoading: false,
	} as never);
}

function renderDashboard() {
	render(
		<QueryClientProvider
			client={
				new QueryClient({ defaultOptions: { queries: { retry: false } } })
			}
		>
			<DashboardContainer />
		</QueryClientProvider>,
	);
}

describe("DashboardContainer", () => {
	beforeEach(() => {
		navigate.mockReset();
		vi.mocked(authClient.organization.listUserTeams).mockResolvedValue({
			data: [{ id: "t1", name: "Design" }],
			error: null,
		} as never);
		vi.mocked(authClient.$fetch).mockResolvedValue({
			data: [{ userId: "user-3" }, { userId: "user-4" }],
			error: null,
		} as never);
	});

	describe("owners and admins: the organization overview", () => {
		it("shows the member, team and unexpired pending invitation counts", async () => {
			setViewer(MANAGER);
			renderDashboard();

			const members = screen.getByText("Members").closest("[data-slot=card]");
			expect(within(members as HTMLElement).getByText("7")).toBeTruthy();
			const teams = screen.getByText("Teams").closest("[data-slot=card]");
			expect(within(teams as HTMLElement).getByText("3")).toBeTruthy();
			const pending = screen
				.getAllByText("Pending invitations")[0]
				.closest("[data-slot=card]");
			expect(within(pending as HTMLElement).getByText("2")).toBeTruthy();
			await waitFor(() =>
				expect(authClient.organization.listUserTeams).toHaveBeenCalled(),
			);
		});

		it("lists the unexpired pending invitations with a link to all of them", async () => {
			setViewer(MANAGER);
			renderDashboard();

			const card = screen
				.getByText("People who haven't answered yet.")
				.closest("[data-slot=card]") as HTMLElement;
			expect(within(card).getByText("a@x.com")).toBeTruthy();
			expect(within(card).getByText("Admin")).toBeTruthy();
			expect(within(card).getByText("b@x.com")).toBeTruthy();
			expect(within(card).queryByText("c@x.com")).toBeNull();
			expect(within(card).queryByText("d@x.com")).toBeNull();
			expect(
				within(card)
					.getByRole("link", { name: "View all" })
					.getAttribute("href"),
			).toBe("/members?tab=invitations");
			await waitFor(() =>
				expect(authClient.organization.listUserTeams).toHaveBeenCalled(),
			);
		});

		it("lists the viewer's own teams", async () => {
			setViewer(MANAGER);
			renderDashboard();

			const card = screen.getByText("My teams").closest("[data-slot=card]");
			expect(
				await within(card as HTMLElement).findByText("Design"),
			).toBeTruthy();
			expect(within(card as HTMLElement).queryByText("Platform")).toBeNull();
		});

		it("shows the five newest members, newest first", async () => {
			setViewer(MANAGER);
			renderDashboard();

			const card = screen
				.getByText("Recent members")
				.closest("[data-slot=card]");
			const scope = within(card as HTMLElement);
			const newestFirst = ["Gina", "Fabio", "Elena", "Diego", "Carla"];
			expect(
				scope
					.getAllByRole("listitem")
					.map((item) => within(item).getByText(/^[A-Z][a-z]+$/).textContent),
			).toEqual(newestFirst);
			expect(scope.queryByText("Bruno")).toBeNull();
			expect(scope.queryByText("Anna")).toBeNull();
			await waitFor(() =>
				expect(authClient.organization.listUserTeams).toHaveBeenCalled(),
			);
		});

		it("offers the invite and new team shortcuts", async () => {
			setViewer(MANAGER);
			renderDashboard();

			expect(
				screen
					.getByRole("link", { name: "Invite people" })
					.getAttribute("href"),
			).toBe("/members?invite=1");
			expect(
				screen.getByRole("link", { name: "New team" }).getAttribute("href"),
			).toBe("/teams?new=1");
			await waitFor(() =>
				expect(authClient.organization.listUserTeams).toHaveBeenCalled(),
			);
		});

		it("walks a new organization through its first steps", async () => {
			setViewer(MANAGER, {
				organization: {
					...ORGANIZATION,
					members: [ORGANIZATION.members[0]],
					invitations: [],
					teams: [ORGANIZATION.teams[0]],
				},
			});
			renderDashboard();

			const card = screen
				.getByText("Set up your organization")
				.closest("[data-slot=card]") as HTMLElement;
			expect(within(card).getByText("0 of 3 done")).toBeTruthy();
			expect(
				within(card)
					.getByRole("link", { name: "Invite your first teammate" })
					.getAttribute("href"),
			).toBe("/members?invite=1");
			expect(
				within(card)
					.getByRole("link", { name: "Create a team" })
					.getAttribute("href"),
			).toBe("/teams?new=1");
			await waitFor(() =>
				expect(authClient.organization.listUserTeams).toHaveBeenCalled(),
			);
		});

		it("drops the first steps once they're all done", async () => {
			setViewer(MANAGER);
			renderDashboard();

			expect(screen.queryByText("Set up your organization")).toBeNull();
			await waitFor(() =>
				expect(authClient.organization.listUserTeams).toHaveBeenCalled(),
			);
		});
	});

	describe("members: their own hub", () => {
		it("greets the member with their role, without the organization stats", async () => {
			setViewer([], { userId: "user-4" });
			renderDashboard();

			expect(screen.getByText("Welcome back, Diego")).toBeTruthy();
			expect(screen.getByText("You're a member of Acme Inc.")).toBeTruthy();
			expect(screen.queryByText("Recent members")).toBeNull();
			expect(screen.queryByRole("link", { name: "Invite people" })).toBeNull();
			expect(screen.queryByRole("link", { name: "New team" })).toBeNull();
			await waitFor(() =>
				expect(authClient.organization.listUserTeams).toHaveBeenCalled(),
			);
		});

		it("opens the assistant with the question asked", async () => {
			setViewer([], { userId: "user-4" });
			renderDashboard();

			await userEvent.type(
				screen.getByLabelText("What do you need help with?"),
				"  Plan my week  ",
			);
			await userEvent.click(screen.getByRole("button", { name: "Ask" }));

			expect(navigate).toHaveBeenCalledWith({
				to: "/assistant",
				search: { q: "Plan my week" },
			});
		});

		it("shows each of the member's teams with the people in it", async () => {
			setViewer([], { userId: "user-4" });
			renderDashboard();

			const card = screen
				.getByText("Your teams")
				.closest("[data-slot=card]") as HTMLElement;
			expect(await within(card).findByText("Design")).toBeTruthy();
			expect(await within(card).findByTitle("Carla")).toBeTruthy();
			expect(within(card).getByTitle("Diego")).toBeTruthy();
			expect(within(card).queryByTitle("Anna")).toBeNull();
			expect(authClient.$fetch).toHaveBeenCalledWith(
				"/organization/team-members",
				{ method: "GET", query: { teamId: "t1" } },
			);
		});

		it("lists the owners and admins to ask for help", async () => {
			setViewer([], { userId: "user-4" });
			renderDashboard();

			const card = screen
				.getByText("Who to ask")
				.closest("[data-slot=card]") as HTMLElement;
			expect(within(card).getByText("Anna")).toBeTruthy();
			expect(within(card).getByText("Owner")).toBeTruthy();
			expect(within(card).getByText("Bruno")).toBeTruthy();
			expect(within(card).getByText("Admin")).toBeTruthy();
			expect(within(card).queryByText("Carla")).toBeNull();
			expect(
				within(card)
					.getByRole("link", { name: "anna@example.com" })
					.getAttribute("href"),
			).toBe("mailto:anna@example.com");
			await waitFor(() =>
				expect(authClient.organization.listUserTeams).toHaveBeenCalled(),
			);
		});

		it("shows an empty state when the member is on no team", async () => {
			setViewer([], { userId: "user-4" });
			vi.mocked(authClient.organization.listUserTeams).mockResolvedValue({
				data: [],
				error: null,
			} as never);
			renderDashboard();

			expect(await screen.findByText("No teams yet")).toBeTruthy();
		});

		it("shows an error when the teams fail to load", async () => {
			setViewer([], { userId: "user-4" });
			vi.mocked(authClient.organization.listUserTeams).mockResolvedValue({
				data: null,
				error: { message: "boom" },
			} as never);
			renderDashboard();

			expect(
				await screen.findByText("Could not load your teams. Please try again."),
			).toBeTruthy();
		});
	});
});
