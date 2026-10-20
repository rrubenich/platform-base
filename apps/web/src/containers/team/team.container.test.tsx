import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspace } from "@/containers/workspace/workspace.context";
import { authClient } from "@/lib/auth-client";
import { TeamContainer } from "./team.container";

let params = { teamId: "t1" };

vi.mock("@tanstack/react-router", () => ({
	useParams: () => params,
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
			listTeamMembers: vi.fn(),
			addTeamMember: vi.fn(),
			removeTeamMember: vi.fn(),
		},
	},
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const member = (n: number, name: string) => ({
	id: `member-${n}`,
	userId: `user-${n}`,
	role: "member",
	createdAt: "2026-10-01T00:00:00.000Z",
	user: { id: `user-${n}`, name, email: `${name.split(" ")[0]}@example.com` },
});

const ORGANIZATION = {
	id: "org-1",
	name: "Acme Inc",
	members: [
		member(1, "Olga Owner"),
		member(2, "Bob Builder"),
		member(3, "Cy Cook"),
	],
	invitations: [],
	teams: [{ id: "t1", name: "Design", memberCount: 1 }],
};

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

function renderTeam() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	const invalidate = vi.spyOn(queryClient, "invalidateQueries");
	render(
		<QueryClientProvider client={queryClient}>
			<TeamContainer />
		</QueryClientProvider>,
	);
	return { invalidate };
}

describe("TeamContainer", () => {
	beforeEach(() => {
		params = { teamId: "t1" };
		toast.success.mockReset();
		toast.error.mockReset();
		vi.mocked(authClient.organization.listTeamMembers)
			.mockReset()
			.mockResolvedValue({
				data: [{ id: "tm1", teamId: "t1", userId: "user-2" }],
				error: null,
			} as never);
		for (const fn of [
			authClient.organization.addTeamMember,
			authClient.organization.removeTeamMember,
		]) {
			vi.mocked(fn)
				.mockReset()
				.mockResolvedValue({ data: {}, error: null } as never);
		}
		setViewer(["team:update"]);
	});

	it("lists the team's members", async () => {
		renderTeam();

		expect(
			await screen.findByRole("row", { name: /Bob Builder/ }),
		).toBeInTheDocument();
		expect(screen.queryByRole("row", { name: /Cy Cook/ })).toBeNull();
		expect(authClient.organization.listTeamMembers).toHaveBeenCalledWith({
			query: { teamId: "t1" },
		});
		expect(screen.getByRole("heading", { name: "Design" })).toBeInTheDocument();
	});

	it("offers only organization members who are not in the team", async () => {
		renderTeam();
		await screen.findByRole("row", { name: /Bob Builder/ });

		await userEvent.click(screen.getByRole("button", { name: "Add member" }));
		const dialog = await screen.findByRole("dialog");
		await userEvent.click(within(dialog).getByLabelText("Member"));

		expect(
			await screen.findByRole("option", { name: "Cy Cook" }),
		).toBeInTheDocument();
		expect(screen.getByRole("option", { name: "Olga Owner" })).toBeVisible();
		expect(screen.queryByRole("option", { name: "Bob Builder" })).toBeNull();
	});

	it("adds a member and refreshes the organization", async () => {
		const { invalidate } = renderTeam();
		await screen.findByRole("row", { name: /Bob Builder/ });

		await userEvent.click(screen.getByRole("button", { name: "Add member" }));
		const dialog = await screen.findByRole("dialog");
		await userEvent.click(within(dialog).getByLabelText("Member"));
		await userEvent.click(
			await screen.findByRole("option", { name: "Cy Cook" }),
		);
		await userEvent.click(within(dialog).getByRole("button", { name: "Add" }));

		await waitFor(() =>
			expect(authClient.organization.addTeamMember).toHaveBeenCalledWith({
				teamId: "t1",
				userId: "user-3",
			}),
		);
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		expect(invalidate).toHaveBeenCalledWith({ queryKey: ["organization"] });
	});

	it("removes a member from the team", async () => {
		renderTeam();

		await userEvent.click(
			await screen.findByRole("button", { name: "Remove Bob Builder" }),
		);

		await waitFor(() =>
			expect(authClient.organization.removeTeamMember).toHaveBeenCalledWith({
				teamId: "t1",
				userId: "user-2",
			}),
		);
	});

	it("shows a plain member the list without add or remove", async () => {
		setViewer([]);
		renderTeam();

		expect(
			await screen.findByRole("row", { name: /Bob Builder/ }),
		).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Add member" })).toBeNull();
		expect(screen.queryByRole("button", { name: /^Remove/ })).toBeNull();
	});

	it("says so when the team does not exist", () => {
		params = { teamId: "gone" };
		renderTeam();

		expect(screen.getByText("Team not found")).toBeInTheDocument();
	});
});
