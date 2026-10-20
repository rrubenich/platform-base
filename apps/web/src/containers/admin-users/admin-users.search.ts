export const USER_FILTERS = ["admins", "banned"] as const;
export type UserFilter = (typeof USER_FILTERS)[number];

export type UsersSearch = {
	q?: string;
	filter?: UserFilter;
	/** 1-based. */
	page?: number;
};

/** `validateSearch` for /admin/users: drops anything malformed. */
export function parseUsersSearch(search: Record<string, unknown>): UsersSearch {
	const q = typeof search.q === "string" ? search.q.trim() : "";
	const filter = USER_FILTERS.find((value) => value === search.filter);
	const page = Number(search.page);

	return {
		...(q ? { q } : {}),
		...(filter ? { filter } : {}),
		...(Number.isInteger(page) && page > 1 ? { page } : {}),
	};
}
