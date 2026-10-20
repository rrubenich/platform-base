import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspace } from "@/containers/workspace/workspace.context";
import { authClient } from "@/lib/auth-client";
import { DashboardContainer } from "./dashboard.container";

vi.mock("@tanstack/react-router", () => ({
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
	authClient: { organization: { listUserTeams: vi.fn() } },
}));

function member(n: number, name: string) {
	return {
		id: `member-${n}`,
		userId: `user-${n}`,
		role: "member",
		createdAt: `2026-10-0${n}T00:00:00.000Z`,
		user: { id: `user-${n}`, name, email: `${name.toLowerCase()}@example.com` },
	};
}

const NAMES = ["Anna", "Bruno", "Carla", "Diego", "Elena", "Fabio", "Gina"];

const ORGANIZATION = {
	id: "org-1",
	name: "Acme Inc",
	members: NAMES.map((name, index) => member(index + 1, name)),
	invitations: [
		{ id: "i1", email: "a@x.com", status: "pending", expiresAt: "2026-12-01" },
		{ id: "i2", email: "b@x.com", status: "pending", expiresAt: "2026-12-01" },
		{ id: "i3", email: "c@x.com", status: "accepted", expiresAt: "2026-12-01" },
	],
	teams: [
		{ id: "t1", name: "Design", memberCount: 3 },
		{ id: "t2", name: "Platform", memberCount: 1 },
		{ id: "t3", name: "Sales", memberCount: 2 },
	],
};

function setViewer(allowed: string[]) {
	vi.mocked(useWorkspace).mockReturnValue({
		organization: ORGANIZATION,
		role: "member",
		userId: "user-1",
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
		vi.mocked(authClient.organization.listUserTeams).mockResolvedValue({
			data: [{ id: "t1", name: "Design" }],
			error: null,
		} as never);
	});

	it("shows the member, team and pending invitation counts", async () => {
		setViewer([]);
		renderDashboard();

		const members = screen.getByText("Members").closest("[data-slot=card]");
		expect(within(members as HTMLElement).getByText("7")).toBeTruthy();
		const teams = screen.getByText("Teams").closest("[data-slot=card]");
		expect(within(teams as HTMLElement).getByText("3")).toBeTruthy();
		const pending = screen
			.getByText("Pending invitations")
			.closest("[data-slot=card]");
		expect(within(pending as HTMLElement).getByText("2")).toBeTruthy();
	});

	it("lists the viewer's own teams", async () => {
		setViewer([]);
		renderDashboard();

		const card = screen.getByText("My teams").closest("[data-slot=card]");
		expect(await within(card as HTMLElement).findByText("Design")).toBeTruthy();
		expect(within(card as HTMLElement).queryByText("Platform")).toBeNull();
	});

	it("shows the five newest members, newest first", async () => {
		setViewer([]);
		renderDashboard();

		const card = screen.getByText("Recent members").closest("[data-slot=card]");
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

	it("offers the invite and new team shortcuts to those who may", async () => {
		setViewer(["invitation:create", "team:create"]);
		renderDashboard();

		expect(
			screen.getByRole("link", { name: "Invite people" }).getAttribute("href"),
		).toBe("/members?invite=1");
		expect(
			screen.getByRole("link", { name: "New team" }).getAttribute("href"),
		).toBe("/teams?new=1");
		await waitFor(() =>
			expect(authClient.organization.listUserTeams).toHaveBeenCalled(),
		);
	});

	it("hides the shortcuts from a plain member", async () => {
		setViewer([]);
		renderDashboard();

		expect(screen.queryByRole("link", { name: "Invite people" })).toBeNull();
		expect(screen.queryByRole("link", { name: "New team" })).toBeNull();
		await waitFor(() =>
			expect(authClient.organization.listUserTeams).toHaveBeenCalled(),
		);
	});

	it("shows an empty state when the viewer is on no team", async () => {
		setViewer([]);
		vi.mocked(authClient.organization.listUserTeams).mockResolvedValue({
			data: [],
			error: null,
		} as never);
		renderDashboard();

		expect(await screen.findByText("No teams yet")).toBeTruthy();
	});

	it("shows an error in My teams when the teams fail to load", async () => {
		setViewer([]);
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
