import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vite-plus/test";
import { adminApi } from "@/lib/admin-api";
import { authClient } from "@/lib/auth-client";
import { AdminDashboardContainer } from "./admin-dashboard.container";

vi.mock("@tanstack/react-router", () => ({
	Link: ({ children }: { children: React.ReactNode }) => (
		<a href="/">{children}</a>
	),
}));

vi.mock("@/lib/admin-api", () => ({
	adminApi: { stats: vi.fn(), growth: vi.fn() },
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: { admin: { listUsers: vi.fn() } },
}));

const STATS = {
	users: 1234,
	admins: 2,
	bannedUsers: 5,
	organizations: 40,
	teams: 61,
	activeSessions: 300,
	impersonatedSessions: 1,
};

function renderDashboard() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={queryClient}>
			<AdminDashboardContainer />
		</QueryClientProvider>,
	);
}

describe("AdminDashboardContainer", () => {
	beforeAll(() => {
		// Recharts' ResponsiveContainer measures its parent.
		vi.stubGlobal(
			"ResizeObserver",
			class {
				observe() {}
				unobserve() {}
				disconnect() {}
			},
		);
		// useIsMobile; a desktop viewport shows the range toggle.
		vi.stubGlobal("matchMedia", (query: string) => ({
			matches: false,
			media: query,
			addEventListener() {},
			removeEventListener() {},
		}));
	});

	beforeEach(() => {
		vi.mocked(adminApi.stats).mockResolvedValue(STATS);
		vi.mocked(adminApi.growth).mockImplementation(async (days) =>
			Array.from({ length: days }, (_, i) => ({
				date: `2026-10-${String((i % 28) + 1).padStart(2, "0")}`,
				users: 1,
				organizations: i === 0 ? 1 : 0,
			})),
		);
		vi.mocked(authClient.admin.listUsers).mockResolvedValue({
			data: {
				users: [
					{
						id: "user-2",
						name: "Jane Doe",
						email: "jane@example.com",
						role: "user",
						banned: true,
						emailVerified: true,
						createdAt: new Date("2026-10-10"),
					},
				],
				total: 1,
			},
			error: null,
		} as never);
	});

	it("shows the platform's numbers in the section cards", async () => {
		renderDashboard();

		expect(await screen.findByText("1,234")).toBeInTheDocument();
		expect(screen.getByText("2 admins")).toBeInTheDocument();
		expect(screen.getByText("61 teams")).toBeInTheDocument();
		expect(screen.getByText("300")).toBeInTheDocument();
		expect(screen.getByText("1 impersonated")).toBeInTheDocument();
		expect(
			await screen.findByText("90 new in the last 90 days"),
		).toBeInTheDocument();
	});

	it("lists the newest sign-ups", async () => {
		renderDashboard();

		const row = (await screen.findByText("Jane Doe")).closest(
			"tr",
		) as HTMLElement;
		expect(within(row).getByText("Banned")).toBeInTheDocument();
		expect(authClient.admin.listUsers).toHaveBeenCalledWith({
			query: { sortBy: "createdAt", sortDirection: "desc", limit: 8 },
		});
	});

	it("reloads the growth series for a shorter range", async () => {
		renderDashboard();
		await screen.findByText("1,234");

		await userEvent.click(
			screen.getAllByRole("button", { name: "Last 7 days" })[0] as HTMLElement,
		);

		await waitFor(() => expect(adminApi.growth).toHaveBeenCalledWith(7));
		expect(
			await screen.findByText("7 new in the last 7 days"),
		).toBeInTheDocument();
	});
});
