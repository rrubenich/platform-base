import {
	keepPreviousData,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";
import { createContext, type ReactNode, useContext } from "react";
import { toast } from "sonner";
import { adminApi, type OrganizationSummary } from "@/lib/admin-api";
import { adminErrorMessage } from "@/lib/admin-errors";
import type { OrganizationsSearch } from "./admin-organizations.search";

export const ORGANIZATIONS_PAGE_SIZE = 20;

export type CreateOrganizationInput = {
	name: string;
	slug: string;
	ownerEmail: string;
};

type AdminOrganizationsContextValue = {
	search: OrganizationsSearch;
	page: number;
	organizations: OrganizationSummary[] | undefined;
	total: number;
	isLoading: boolean;
	isError: boolean;
	setQuery: (q: string) => void;
	setPage: (page: number) => void;
	/** Resolves to an error message, or null once created. */
	createOrganization: (
		input: CreateOrganizationInput,
	) => Promise<string | null>;
	isCreating: boolean;
	deleteOrganization: (organization: OrganizationSummary) => void;
};

const AdminOrganizationsContext = createContext<
	AdminOrganizationsContextValue | undefined
>(undefined);

export function AdminOrganizationsProvider({
	children,
}: {
	children: ReactNode;
}) {
	const search = useSearch({ from: "/admin/organizations/" });
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const page = search.page ?? 1;

	const { data, isLoading, isError } = useQuery({
		queryKey: ["admin", "organizations", search],
		queryFn: () =>
			adminApi.listOrganizations({
				search: search.q,
				limit: ORGANIZATIONS_PAGE_SIZE,
				offset: (page - 1) * ORGANIZATIONS_PAGE_SIZE,
			}),
		placeholderData: keepPreviousData,
	});

	const create = useMutation({
		mutationFn: async ({ name, slug, ownerEmail }: CreateOrganizationInput) => {
			const owner = await adminApi.findUserByEmail(ownerEmail);
			if (!owner) throw new Error(m.admin_org_owner_not_found());
			return adminApi.createOrganization({ name, slug, ownerUserId: owner.id });
		},
		onSuccess: async (organization) => {
			toast.success(m.admin_toast_org_created());
			await queryClient.invalidateQueries({ queryKey: ["admin"] });
			await navigate({
				to: "/admin/organizations/$organizationId",
				params: { organizationId: organization.id },
			});
		},
	});

	const remove = useMutation({
		mutationFn: (organization: OrganizationSummary) =>
			adminApi.deleteOrganization(organization.id),
		onSuccess: async () => {
			toast.success(m.admin_toast_org_deleted());
			await queryClient.invalidateQueries({ queryKey: ["admin"] });
		},
		onError: (error) =>
			toast.error(adminErrorMessage(error, m.admin_action_error())),
	});

	const update = (next: OrganizationsSearch) =>
		navigate({
			to: "/admin/organizations",
			search: (previous) => ({ ...previous, ...next }),
		});

	const value: AdminOrganizationsContextValue = {
		search,
		page,
		organizations: data?.organizations,
		total: data?.total ?? 0,
		isLoading,
		isError,
		setQuery: (q) => update({ q: q.trim() || undefined, page: undefined }),
		setPage: (nextPage) =>
			update({ page: nextPage > 1 ? nextPage : undefined }),
		createOrganization: (input) =>
			create.mutateAsync(input).then(
				() => null,
				(error: unknown) => adminErrorMessage(error, m.admin_action_error()),
			),
		isCreating: create.isPending,
		deleteOrganization: (organization) => remove.mutate(organization),
	};

	return (
		<AdminOrganizationsContext.Provider value={value}>
			{children}
		</AdminOrganizationsContext.Provider>
	);
}

export function useAdminOrganizationsContext() {
	const context = useContext(AdminOrganizationsContext);

	if (context === undefined) {
		throw new Error(
			"useAdminOrganizationsContext must be used within an AdminOrganizationsProvider",
		);
	}

	return context;
}
