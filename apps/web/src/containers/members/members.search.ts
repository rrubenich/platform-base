export type MembersSearch = { tab?: "invitations"; invite?: 1 };

/** `?tab=invitations` and `?invite=1` (opens the invite dialog); anything else is dropped. */
export function parseMembersSearch(
	search: Record<string, unknown>,
): MembersSearch {
	return {
		...(search.tab === "invitations" ? { tab: "invitations" as const } : {}),
		...(search.invite === 1 || search.invite === "1"
			? { invite: 1 as const }
			: {}),
	};
}
