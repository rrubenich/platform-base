import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { m } from "@workspace/i18n/messages";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { authClient } from "@/lib/auth-client";
import { WorkspaceContainer } from "./workspace.container";

const navigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => navigate,
	useRouterState: () => ({ pathname: "/", search: {} }),
	Outlet: () => <div>outlet content</div>,
	Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
		<a href={to}>{children}</a>
	),
}));

vi.mock("@/components/theme-provider", () => ({
	useTheme: () => ({ theme: "light" }),
}));

vi.mock("@/components/shell/app-header", () => ({
	AppHeader: () => <header />,
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		useSession: vi.fn(),
		signOut: vi.fn(),
		organization: {
			getFullOrganization: vi.fn(),
			checkRolePermission: vi.fn(),
			leave: vi.fn(),
		},
	},
}));

function setRole(role: string) {
	vi.mocked(authClient.organization.getFullOrganization).mockResolvedValue({
		data: {
			id: "org-1",
			name: "Acme Inc",
			members: [{ userId: "user-1", role }],
		},
		error: null,
	} as never);
}

function renderWorkspace() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={queryClient}>
			<WorkspaceContainer />
		</QueryClientProvider>,
	);
}

describe("WorkspaceContainer", () => {
	beforeAll(() => {
		// The sidebar asks matchMedia whether it is on mobile.
		vi.stubGlobal(
			"matchMedia",
			(query: string) =>
				({
					matches: false,
					media: query,
					addEventListener: () => {},
					removeEventListener: () => {},
				}) as unknown as MediaQueryList,
		);
	});

	beforeEach(() => {
		navigate.mockReset();
		vi.mocked(authClient.signOut)
			.mockReset()
			.mockResolvedValue({} as never);
		vi.mocked(authClient.useSession).mockReturnValue({
			data: {
				session: { id: "s1" },
				user: { id: "user-1", name: "Jane Doe", email: "jane@example.com" },
			},
		} as never);
		// Owners and admins hold every permission the shell asks about.
		vi.mocked(authClient.organization.checkRolePermission).mockImplementation(
			({ role }: { role: string }) => role !== "member",
		);
		setRole("admin");
	});

	it("shows the organization name, the nav and the page body", async () => {
		renderWorkspace();

		expect(await screen.findByText("Acme Inc")).toBeInTheDocument();
		expect(screen.getByRole("link", { name: /Dashboard/ })).toHaveAttribute(
			"href",
			"/",
		);
		expect(screen.getByRole("link", { name: /Members/ })).toHaveAttribute(
			"href",
			"/members",
		);
		expect(screen.getByRole("link", { name: /Teams/ })).toHaveAttribute(
			"href",
			"/teams",
		);
		expect(screen.getByRole("link", { name: /Assistant/ })).toHaveAttribute(
			"href",
			"/assistant",
		);
		expect(screen.getByRole("link", { name: /Settings/ })).toHaveAttribute(
			"href",
			"/settings/organization",
		);
		expect(screen.getByText("outlet content")).toBeInTheDocument();
	});

	it("doesn't offer Leave in an admin's user menu: they leave from Settings", async () => {
		renderWorkspace();

		await userEvent.click(await screen.findByText("jane@example.com"));

		await screen.findByText("Security settings");
		expect(
			screen.queryByRole("menuitem", { name: /Leave organization/ }),
		).toBeNull();
	});

	it("hides Settings from a plain member, who leaves from the user menu", async () => {
		setRole("member");
		vi.mocked(authClient.organization.leave).mockResolvedValue({
			data: {},
			error: null,
		} as never);
		renderWorkspace();

		expect(await screen.findByText("Acme Inc")).toBeInTheDocument();
		expect(screen.queryByRole("link", { name: /Settings/ })).toBeNull();

		await userEvent.click(screen.getByText("jane@example.com"));
		await userEvent.click(
			await screen.findByRole("menuitem", { name: /Leave organization/ }),
		);
		await userEvent.click(await screen.findByRole("button", { name: "Leave" }));

		await waitFor(() =>
			expect(authClient.organization.leave).toHaveBeenCalledWith({
				organizationId: "org-1",
			}),
		);
		await waitFor(() =>
			expect(navigate).toHaveBeenCalledWith({ to: "/onboarding" }),
		);
	});

	it("links to the security settings from the user menu", async () => {
		renderWorkspace();

		await userEvent.click(await screen.findByText("jane@example.com"));

		const label = await screen.findByText("Security settings");
		expect(label.closest("a")).toHaveAttribute("href", "/settings/security");
	});

	it("signs out and goes to the sign-in page", async () => {
		renderWorkspace();

		await userEvent.click(await screen.findByText("jane@example.com"));
		await userEvent.click(
			await screen.findByRole("menuitem", { name: /Sign out/ }),
		);

		await waitFor(() =>
			expect(navigate).toHaveBeenCalledWith({ to: "/sign-in" }),
		);
		expect(authClient.signOut).toHaveBeenCalled();
	});

	it("shows an error with a retry instead of the page when the organization fails to load", async () => {
		vi.mocked(authClient.organization.getFullOrganization).mockResolvedValue({
			data: null,
			error: { status: 500, message: "boom" },
		} as never);
		renderWorkspace();

		expect(await screen.findByText(m.workspace_load_error())).toBeVisible();
		expect(screen.queryByText("outlet content")).toBeNull();

		vi.mocked(authClient.organization.getFullOrganization).mockResolvedValue({
			data: {
				id: "org-1",
				name: "Acme Inc",
				members: [{ userId: "user-1", role: "admin" }],
			},
			error: null,
		} as never);
		await userEvent.click(
			screen.getByRole("button", { name: m.workspace_retry() }),
		);

		expect(await screen.findByText("outlet content")).toBeInTheDocument();
		expect(screen.queryByText(m.workspace_load_error())).toBeNull();
	});
});
