/**
 * An absolute URL for `path` on the web app's own origin.
 *
 * Better Auth callback URLs must be absolute: the auth server runs on the
 * API's origin in deployed environments, so a relative `callbackURL` would
 * resolve there instead of back to the web app.
 */
export function appURL(path: string): string {
	return new URL(path, window.location.origin).toString();
}
