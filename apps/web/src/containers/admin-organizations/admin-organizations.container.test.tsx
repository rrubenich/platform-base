import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { adminApi } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";
import { AdminOrganizationsContainer } from "./admin-organizations.container";
import type { OrganizationsSearch } from "./admin-organizations.search";

const navigate = vi.fn();
const search = vi.hoisted(() => ({ current: {} as OrganizationsSearch }));

vi.mock("@tanstack/react-router", () => ({
	useSearch: () => search.current,
	useNavigate: () => navigate,
	Link: ({ children }: { children: React.ReactNode }) => (
		<a href="/">{children}</a>
	),
}));

vi.mock("@/lib/admin-api", () => ({
	adminApi: {
		listOrganizations: vi.fn(),
		createOrganization: vi.fn(),
		deleteOrganization: vi.fn(),
		findUserByEmail: vi.fn(),
	},
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const ACME = {
	id: "org-1",
	name: "Acme Inc",
	slug: "acme-inc",
	logo: null,
	createdAt: "2026-10-01T00:00:00.000Z",
	memberCount: 12,
	teamCount: 3,
};

function renderOrganizations() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={queryClient}>
			<AdminOrganizationsContainer />
		</QueryClientProvider>,
	);
}

async function fillCreateForm({
	name = "Globex Corp",
	owner = "owner@example.com",
} = {}) {
	await userEvent.click(
		await screen.findByRole("button", { name: "New organization" }),
	);
	const dialog = await screen.findByRole("dialog");
	await userEvent.type(within(dialog).getByLabelText("Name"), name);
	await userEvent.type(within(dialog).getByLabelText("Owner's email"), owner);
	return dialog;
}

describe("AdminOrganizationsContainer", () => {
	beforeEach(() => {
		search.current = {};
		navigate.mockReset();
		toast.success.mockReset();
		toast.error.mockReset();
		for (const fn of Object.values(adminApi)) vi.mocked(fn).mockReset();
		vi.mocked(adminApi.listOrganizations).mockResolvedValue({
			organizations: [ACME],
			total: 1,
		});
	});

	it("lists organizations with member and team counts", async () => {
		search.current = { q: "acme", page: 2 };

		renderOrganizations();

		const row = (await screen.findByText("Acme Inc")).closest(
			"tr",
		) as HTMLElement;
		expect(within(row).getByText("acme-inc")).toBeInTheDocument();
		expect(within(row).getByText("12")).toBeInTheDocument();
		expect(within(row).getByText("3")).toBeInTheDocument();
		expect(adminApi.listOrganizations).toHaveBeenCalledWith({
			search: "acme",
			limit: 20,
			offset: 20,
		});
	});

	it("creates an organization for an existing owner, slug from the name", async () => {
		vi.mocked(adminApi.findUserByEmail).mockResolvedValue({
			id: "user-9",
		} as never);
		vi.mocked(adminApi.createOrganization).mockResolvedValue({
			id: "org-2",
		} as never);
		renderOrganizations();

		const dialog = await fillCreateForm();
		expect(within(dialog).getByLabelText("Slug")).toHaveValue("globex-corp");
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Create organization" }),
		);

		await waitFor(() =>
			expect(adminApi.createOrganization).toHaveBeenCalledWith({
				name: "Globex Corp",
				slug: "globex-corp",
				ownerUserId: "user-9",
			}),
		);
		expect(adminApi.findUserByEmail).toHaveBeenCalledWith("owner@example.com");
		await waitFor(() =>
			expect(navigate).toHaveBeenCalledWith({
				to: "/admin/organizations/$organizationId",
				params: { organizationId: "org-2" },
			}),
		);
	});

	it("keeps the dialog open with an error when the owner doesn't exist", async () => {
		vi.mocked(adminApi.findUserByEmail).mockResolvedValue(null as never);
		renderOrganizations();

		const dialog = await fillCreateForm({ owner: "nobody@example.com" });
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Create organization" }),
		);

		expect(
			await within(dialog).findByText("No user has that email."),
		).toBeInTheDocument();
		expect(adminApi.createOrganization).not.toHaveBeenCalled();
	});

	it("shows the API's reason when creation is rejected", async () => {
		vi.mocked(adminApi.findUserByEmail).mockResolvedValue({
			id: "user-9",
		} as never);
		vi.mocked(adminApi.createOrganization).mockRejectedValue(
			new ApiError(400, "Organization slug already taken"),
		);
		renderOrganizations();

		const dialog = await fillCreateForm();
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Create organization" }),
		);

		expect(
			await within(dialog).findByText("Organization slug already taken"),
		).toBeInTheDocument();
	});

	it("asks before deleting an organization", async () => {
		vi.mocked(adminApi.deleteOrganization).mockResolvedValue(undefined);
		renderOrganizations();

		await userEvent.click(
			await screen.findByRole("button", { name: "Actions for Acme Inc" }),
		);
		await userEvent.click(
			await screen.findByRole("menuitem", { name: "Delete" }),
		);
		const dialog = await screen.findByRole("alertdialog", {
			name: "Delete Acme Inc?",
		});
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Delete" }),
		);

		await waitFor(() =>
			expect(adminApi.deleteOrganization).toHaveBeenCalledWith("org-1"),
		);
		expect(toast.success).toHaveBeenCalledWith("Organization deleted.");
	});

	it("says so when there are none", async () => {
		vi.mocked(adminApi.listOrganizations).mockResolvedValue({
			organizations: [],
			total: 0,
		});

		renderOrganizations();

		expect(
			await screen.findByText("No organizations found"),
		).toBeInTheDocument();
	});
});
