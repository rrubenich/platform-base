import { redirect } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";

type Session = NonNullable<
	Awaited<ReturnType<typeof authClient.getSession>>["data"]
>;

// What the admin area needs at minimum; the API enforces each route's own
// permission, so this only decides whether to show the admin UI at all.
const ADMIN_AREA_PERMISSIONS = { user: ["list" as const] };

// One permission check per session, not per navigation.
let cached: { sessionId: string; allowed: boolean } | undefined;

async function currentSession() {
	const { data } = await authClient.getSession();
	return data;
}

/**
 * Asks the API (rather than reading `user.role`) so users granted access
 * through ADMIN_USER_IDS, whose stored role is still "user", count too.
 * An admin impersonating someone has that user's session, so they don't.
 */
async function hasAdminAccess(session: Session) {
	const previous = cached;
	if (previous && previous.sessionId === session.session.id) {
		return previous.allowed;
	}

	const { data } = await authClient.admin.hasPermission({
		permissions: ADMIN_AREA_PERMISSIONS,
	});
	const allowed = Boolean(data?.success);
	cached = { sessionId: session.session.id, allowed };
	return allowed;
}

/**
 * `beforeLoad` guard for the app's home: signed-out visitors go to sign-in,
 * admins go to the admin console.
 */
export async function requireUser() {
	const session = await currentSession();
	if (!session) throw redirect({ to: "/sign-in" });
	if (await hasAdminAccess(session)) throw redirect({ to: "/admin" });

	return { session };
}

/**
 * `beforeLoad` guard for the /admin routes: signed-out users go to sign-in,
 * signed-in users without admin access go home.
 */
export async function requireAdmin() {
	const session = await currentSession();
	if (!session) throw redirect({ to: "/sign-in" });
	if (!(await hasAdminAccess(session))) throw redirect({ to: "/" });

	return { session };
}

/** `beforeLoad` guard for sign-in/sign-up: no reason to show them signed in. */
export async function redirectIfSignedIn() {
	if (await currentSession()) throw redirect({ to: "/" });
}

/** For tests: forget the cached permission check. */
export function resetAdminAccessCache() {
	cached = undefined;
}
