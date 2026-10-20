export type AuthSearch = { redirect?: string; email?: string };

/** Keeps only the search params the auth pages understand. */
export function parseAuthSearch(search: Record<string, unknown>): AuthSearch {
	const parsed: AuthSearch = {};
	if (typeof search.redirect === "string") parsed.redirect = search.redirect;
	if (typeof search.email === "string") parsed.email = search.email;
	return parsed;
}

/** Only same-origin paths; anything else (absolute URLs, `//host`) goes home. */
export function safeRedirect(target: string | undefined): string {
	if (target?.startsWith("/") && !target.startsWith("//")) return target;
	return "/";
}

/**
 * Navigation options for a safe path. A path carrying a query string goes
 * through `href`, since `to` would not keep it.
 */
export function redirectNavigation(target: string | undefined) {
	const path = safeRedirect(target);
	return path.includes("?") ? { href: path } : { to: path };
}
