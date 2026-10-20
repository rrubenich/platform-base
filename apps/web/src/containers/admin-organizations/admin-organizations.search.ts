export type OrganizationsSearch = {
	q?: string;
	/** 1-based. */
	page?: number;
};

/** `validateSearch` for /admin/organizations: drops anything malformed. */
export function parseOrganizationsSearch(
	search: Record<string, unknown>,
): OrganizationsSearch {
	const q = typeof search.q === "string" ? search.q.trim() : "";
	const page = Number(search.page);

	return {
		...(q ? { q } : {}),
		...(Number.isInteger(page) && page > 1 ? { page } : {}),
	};
}
