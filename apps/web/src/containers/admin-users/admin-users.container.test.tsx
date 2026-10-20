import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authClient } from "@/lib/auth-client";
import { AdminUsersContainer } from "./admin-users.container";
import type { UsersSearch } from "./admin-users.search";

const navigate = vi.fn();
const search = vi.hoisted(() => ({ current: {} as UsersSearch }));

vi.mock("@tanstack/react-router", () => ({
	useSearch: () => search.current,
	useNavigate: () => navigate,
	Link: ({ children }: { children: React.ReactNode }) => (
		<a href="/">{children}</a>
	),
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		useSession: () => ({ data: { user: { id: "admin-1" } } }),
		admin: {
			listUsers: vi.fn(),
			setRole: vi.fn(),
			banUser: vi.fn(),
			unbanUser: vi.fn(),
			revokeUserSessions: vi.fn(),
			impersonateUser: vi.fn(),
			removeUser: vi.fn(),
		},
	},
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const ADMIN = {
	id: "admin-1",
	name: "Ada Admin",
	email: "ada@example.com",
	role: "admin",
	banned: false,
	emailVerified: true,
	createdAt: new Date("2026-10-01"),
};
const JANE = {
	id: "user-2",
	name: "Jane Doe",
	email: "jane@example.com",
	role: "user",
	banned: false,
	emailVerified: false,
	createdAt: new Date("2026-10-10"),
};

function withUsers(users: object[], total = users.length) {
	vi.mocked(authClient.admin.listUsers).mockResolvedValue({
		data: { users, total },
		error: null,
	} as never);
}

function renderUsers() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={queryClient}>
			<AdminUsersContainer />
		</QueryClientProvider>,
	);
}

async function openActions(name: string) {
	await userEvent.click(
		await screen.findByRole("button", { name: `Actions for ${name}` }),
	);
}

describe("AdminUsersContainer", () => {
	beforeEach(() => {
		search.current = {};
		navigate.mockReset();
		toast.success.mockReset();
		toast.error.mockReset();
		for (const fn of Object.values(authClient.admin)) {
			vi.mocked(fn)
				.mockReset()
				.mockResolvedValue({ data: {}, error: null } as never);
		}
		withUsers([ADMIN, JANE], 42);
	});

	it("lists the newest users first, a page at a time, with their status", async () => {
		renderUsers();

		expect(await screen.findByText("Jane Doe")).toBeInTheDocument();
		const janeRow = screen.getByText("Jane Doe").closest("tr") as HTMLElement;
		expect(within(janeRow).getByText("Unverified")).toBeInTheDocument();
		expect(screen.getByText("42 results")).toBeInTheDocument();
		expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
		expect(authClient.admin.listUsers).toHaveBeenCalledWith({
			query: {
				limit: 20,
				offset: 0,
				sortBy: "createdAt",
				sortDirection: "desc",
			},
		});
	});

	it("searches by email or name, and filters, from the URL", async () => {
		search.current = { q: "jane@", filter: "banned", page: 2 };

		renderUsers();

		await screen.findByText("Jane Doe");
		expect(authClient.admin.listUsers).toHaveBeenCalledWith({
			query: expect.objectContaining({
				offset: 20,
				searchValue: "jane@",
				searchField: "email",
				searchOperator: "contains",
				filterField: "banned",
				filterValue: true,
			}),
		});
	});

	it("puts the search and filter in the URL, back on page one", async () => {
		search.current = { page: 3 };
		renderUsers();

		await userEvent.type(
			await screen.findByRole("searchbox", { name: "Search users" }),
			"ada{Enter}",
		);
		const applySearch = navigate.mock.lastCall?.[0].search;
		expect(applySearch({ page: 3 })).toEqual({ q: "ada", page: undefined });

		await userEvent.click(screen.getByRole("button", { name: "Admins" }));
		const applyFilter = navigate.mock.lastCall?.[0].search;
		expect(applyFilter({ q: "ada", page: 3 })).toEqual({
			q: "ada",
			filter: "admins",
			page: undefined,
		});
	});

	it("bans a user with a reason, then refreshes the list", async () => {
		renderUsers();
		await openActions("Jane Doe");

		await userEvent.click(await screen.findByRole("menuitem", { name: "Ban" }));
		const dialog = await screen.findByRole("dialog", { name: "Ban Jane Doe" });
		await userEvent.type(within(dialog).getByLabelText("Reason"), "Spam");
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Ban user" }),
		);

		await waitFor(() =>
			expect(authClient.admin.banUser).toHaveBeenCalledWith({
				userId: "user-2",
				banReason: "Spam",
				banExpiresIn: undefined,
			}),
		);
		expect(toast.success).toHaveBeenCalledWith("User banned.");
		await waitFor(() =>
			expect(authClient.admin.listUsers).toHaveBeenCalledTimes(2),
		);
	});

	it("asks before deleting a user", async () => {
		renderUsers();
		await openActions("Jane Doe");

		await userEvent.click(
			await screen.findByRole("menuitem", { name: "Delete" }),
		);
		const dialog = await screen.findByRole("alertdialog");
		expect(dialog).toHaveTextContent("jane@example.com");
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Delete" }),
		);

		await waitFor(() =>
			expect(authClient.admin.removeUser).toHaveBeenCalledWith({
				userId: "user-2",
			}),
		);
	});

	it("promotes a user to admin", async () => {
		renderUsers();
		await openActions("Jane Doe");

		await userEvent.click(
			await screen.findByRole("menuitem", { name: "Make admin" }),
		);

		await waitFor(() =>
			expect(authClient.admin.setRole).toHaveBeenCalledWith({
				userId: "user-2",
				role: "admin",
			}),
		);
	});

	it("doesn't offer admins actions against themselves", async () => {
		renderUsers();
		await openActions("Ada Admin");

		const menu = await screen.findByRole("menu");
		expect(
			within(menu).getByRole("menuitem", { name: "Sign out everywhere" }),
		).toBeInTheDocument();
		for (const name of ["Ban", "Delete", "Impersonate", "Remove admin role"]) {
			expect(within(menu).queryByRole("menuitem", { name })).toBeNull();
		}
	});

	it("shows the API's error when an action fails", async () => {
		vi.mocked(authClient.admin.setRole).mockResolvedValue({
			data: null,
			error: {
				status: 403,
				message: "You are not allowed to change users role",
			},
		} as never);
		renderUsers();
		await openActions("Jane Doe");

		await userEvent.click(
			await screen.findByRole("menuitem", { name: "Make admin" }),
		);

		await waitFor(() =>
			expect(toast.error).toHaveBeenCalledWith(
				"You are not allowed to change users role",
			),
		);
	});

	it("says so when nothing matches", async () => {
		withUsers([]);

		renderUsers();

		expect(await screen.findByText("No users found")).toBeInTheDocument();
	});
});
