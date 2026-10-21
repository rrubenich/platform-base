import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { createContext, type ReactNode, useContext } from "react";
import type { ManagedUser } from "@/components/admin/user-actions-menu";
import { adminApi } from "@/lib/admin-api";
import { authClient } from "@/lib/auth-client";
import {
	type AdminUserActions,
	useAdminUserActions,
} from "@/lib/use-admin-user-actions";
import type { UserFilter, UsersSearch } from "./admin-users.search";

export const USERS_PAGE_SIZE = 20;

export type UserRow = ManagedUser & {
	image?: string | null;
	emailVerified: boolean;
	createdAt: Date;
};

type AdminUsersContextValue = {
	search: UsersSearch;
	page: number;
	users: UserRow[] | undefined;
	total: number;
	isLoading: boolean;
	isError: boolean;
	currentUserId: string | undefined;
	/** Users on this page who haven't set up the account made for them. */
	pendingSetupUserIds: ReadonlySet<string>;
	actions: AdminUserActions;
	setQuery: (q: string) => void;
	setFilter: (filter: UserFilter | undefined) => void;
	setPage: (page: number) => void;
};

const AdminUsersContext = createContext<AdminUsersContextValue | undefined>(
	undefined,
);

/** The admin plugin's single filter, for the list's filter choice. */
function filterQuery(filter: UserFilter | undefined) {
	switch (filter) {
		case "admins":
			// `role` can hold several comma-separated roles.
			return {
				filterField: "role",
				filterOperator: "contains" as const,
				filterValue: "admin",
			};
		case "banned":
			return { filterField: "banned", filterValue: true };
		default:
			return {};
	}
}

export function AdminUsersProvider({ children }: { children: ReactNode }) {
	const search = useSearch({ from: "/admin/users/" });
	const navigate = useNavigate({ from: "/admin/users/" });
	const { data: session } = authClient.useSession();
	const actions = useAdminUserActions();
	const page = search.page ?? 1;

	const { data, isLoading, isError } = useQuery({
		queryKey: ["admin", "users", search],
		queryFn: async () => {
			const { data: result, error } = await authClient.admin.listUsers({
				query: {
					limit: USERS_PAGE_SIZE,
					offset: (page - 1) * USERS_PAGE_SIZE,
					sortBy: "createdAt",
					sortDirection: "desc",
					...(search.q
						? {
								searchValue: search.q,
								searchField: search.q.includes("@") ? "email" : "name",
								searchOperator: "contains",
							}
						: {}),
					...filterQuery(search.filter),
				},
			});
			if (error) throw error;
			return result;
		},
		placeholderData: keepPreviousData,
	});

	const userIds = (data?.users ?? []).map((user) => user.id);
	const { data: pendingSetups } = useQuery({
		queryKey: ["admin", "account-invitations", userIds],
		queryFn: () => adminApi.accountInvitationsFor(userIds),
		enabled: userIds.length > 0,
	});

	// A new query or filter starts back at page one.
	const update = (next: UsersSearch) =>
		navigate({ search: (previous) => ({ ...previous, ...next }) });

	const value: AdminUsersContextValue = {
		search,
		page,
		users: data?.users as UserRow[] | undefined,
		total: data?.total ?? 0,
		isLoading,
		isError,
		currentUserId: session?.user.id,
		pendingSetupUserIds: new Set(
			pendingSetups?.map(({ userId }) => userId) ?? [],
		),
		actions,
		setQuery: (q) => update({ q: q.trim() || undefined, page: undefined }),
		setFilter: (filter) => update({ filter, page: undefined }),
		setPage: (nextPage) =>
			update({ page: nextPage > 1 ? nextPage : undefined }),
	};

	return (
		<AdminUsersContext.Provider value={value}>
			{children}
		</AdminUsersContext.Provider>
	);
}

export function useAdminUsersContext() {
	const context = useContext(AdminUsersContext);

	if (context === undefined) {
		throw new Error(
			"useAdminUsersContext must be used within an AdminUsersProvider",
		);
	}

	return context;
}
