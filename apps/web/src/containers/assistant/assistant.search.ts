export type AssistantSearch = {
	/** A first message to send on arrival (from the home's "Ask" box). */
	q?: string;
};

export function parseAssistantSearch(
	search: Record<string, unknown>,
): AssistantSearch {
	return typeof search.q === "string" && search.q.trim() ? { q: search.q } : {};
}
