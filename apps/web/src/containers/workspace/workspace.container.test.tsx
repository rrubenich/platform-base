import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
		},
	},
}));

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
		vi.mocked(authClient.organization.getFullOrganization).mockResolvedValue({
			data: {
				id: "org-1",
				name: "Acme Inc",
				members: [{ userId: "user-1", role: "admin" }],
			},
			error: null,
		} as never);
	});

	it("shows the organization name, the nav and the page body", async () => {
		renderWorkspace();

		expect(await screen.findByText("Acme Inc")).toBeInTheDocument();
		expect(screen.getByRole("link", { name: /Dashboard/ })).toHaveAttribute(
			"href",
			"/",
		);
		expect(screen.getByText("outlet content")).toBeInTheDocument();
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
});
