export type TeamsSearch = { new?: 1 };

/** `?new=1` opens the create-team dialog; anything else is dropped. */
export function parseTeamsSearch(search: Record<string, unknown>): TeamsSearch {
	return search.new === 1 || search.new === "1" ? { new: 1 } : {};
}
