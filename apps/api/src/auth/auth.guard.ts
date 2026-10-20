import {
	type CanActivate,
	type ExecutionContext,
	ForbiddenException,
	Inject,
	Injectable,
	UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { fromNodeHeaders } from "better-auth/node";
import type { Session } from "../lib/auth.js";
import type { Permissions } from "../lib/permissions.js";
import {
	type AuthenticatedRequest,
	PERMISSIONS_KEY,
} from "./auth.decorators.js";
import { AUTH_INSTANCE } from "./auth.constants.js";

// `auth` is typed against the generic `BetterAuthOptions` (see lib/auth.ts),
// which erases plugin endpoints such as the admin plugin's
// `userHasPermission` from its static type. This narrows what the guard uses.
export type AuthApi = {
	api: {
		getSession: (input: { headers: Headers }) => Promise<Session | null>;
		userHasPermission: (input: {
			body: { userId: string; role?: string; permissions: Permissions };
		}) => Promise<{ success: boolean }>;
	};
};

/**
 * Lets a request through only with a Better Auth session cookie, attaching
 * the session to `request.session`. With `@RequirePermissions`, it also
 * checks the user's platform role through the admin plugin, so `roles` and
 * `adminUserIds` in lib/auth.ts are the single source of truth.
 */
@Injectable()
export class AuthGuard implements CanActivate {
	constructor(
		@Inject(AUTH_INSTANCE) private readonly auth: AuthApi,
		private readonly reflector: Reflector,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

		const session = await this.auth.api.getSession({
			headers: fromNodeHeaders(request.headers),
		});
		if (!session) throw new UnauthorizedException();
		request.session = session;

		const permissions = this.reflector.getAllAndOverride<
			Permissions | undefined
		>(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);
		if (!permissions) return true;

		// Called without headers so the plugin checks this user id/role
		// instead of re-reading the session from the request.
		const { success } = await this.auth.api.userHasPermission({
			body: {
				userId: session.user.id,
				role: (session.user as { role?: string | null }).role ?? undefined,
				permissions,
			},
		});
		if (!success) throw new ForbiddenException();
		return true;
	}
}
