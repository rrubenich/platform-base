import { redirect } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import { type AuthSearch, redirectNavigation } from "@/lib/redirect-target";

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

async function firstOrganization() {
	const { data, error } = await authClient.organization.list();
	// A failed lookup is not "no organization": surface it to the error boundary.
	if (error) throw new Error(error.message ?? "Could not load organizations");
	return data?.[0];
}

/**
 * `beforeLoad` guard for the workspace: signed-out users go to sign-in, admins
 * to the console, users without an organization to onboarding. A member with
 * no or another active organization gets their (only) one activated.
 */
export async function requireOrganization() {
	const session = await currentSession();
	if (!session) throw redirect({ to: "/sign-in" });
	if (await hasAdminAccess(session)) throw redirect({ to: "/admin" });

	const organization = await firstOrganization();
	if (!organization) throw redirect({ to: "/onboarding" });

	// Also when another (e.g. a since-left) organization is still active.
	if (session.session.activeOrganizationId !== organization.id) {
		const { error } = await authClient.organization.setActive({
			organizationId: organization.id,
		});
		if (error) {
			throw new Error(error.message ?? "Could not activate the organization");
		}
	}

	return { session };
}

/**
 * `beforeLoad` guard for onboarding: only signed-in users who don't belong to
 * an organization yet. Admins go to the console, as from the workspace.
 */
export async function requireNoOrganization() {
	const session = await currentSession();
	if (!session) throw redirect({ to: "/sign-in" });
	if (await hasAdminAccess(session)) throw redirect({ to: "/admin" });
	if (await firstOrganization()) throw redirect({ to: "/" });

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

/**
 * `beforeLoad` guard for sign-in/sign-up: no reason to show them signed in.
 * They go where they were headed (`?redirect=`), else home.
 */
export async function redirectIfSignedIn({ search }: { search: AuthSearch }) {
	if (await currentSession())
		throw redirect(redirectNavigation(search.redirect));
}

/** For tests: forget the cached permission check. */
export function resetAdminAccessCache() {
	cached = undefined;
}
