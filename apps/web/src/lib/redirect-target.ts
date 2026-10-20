export type AuthSearch = { redirect?: string; email?: string };

/** Keeps only the search params the auth pages understand. */
export function parseAuthSearch(search: Record<string, unknown>): AuthSearch {
	const parsed: AuthSearch = {};
	if (typeof search.redirect === "string") parsed.redirect = search.redirect;
	if (typeof search.email === "string") parsed.email = search.email;
	return parsed;
}

/**
 * Only same-origin paths. The target is resolved the way the browser (and
 * `appURL`) will, so `/\\host` and `/<tab>/host` tricks that end up on another
 * origin fall back to home along with absolute URLs and `//host`.
 */
export function safeRedirect(target: string | undefined): string {
	if (!target?.startsWith("/")) return "/";
	try {
		const url = new URL(target, window.location.origin);
		if (url.origin !== window.location.origin) return "/";
		return url.pathname + url.search + url.hash;
	} catch {
		return "/";
	}
}

/**
 * Navigation options for a safe path. A path carrying a query string goes
 * through `href`, since `to` would not keep it.
 */
export function redirectNavigation(target: string | undefined) {
	const path = safeRedirect(target);
	return path.includes("?") ? { href: path } : { to: path };
}
