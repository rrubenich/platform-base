import {
	createParamDecorator,
	type ExecutionContext,
	SetMetadata,
} from "@nestjs/common";
import type { Request } from "express";
import type { Session } from "../lib/auth.js";
import type { Permissions } from "../lib/permissions.js";

export const PERMISSIONS_KEY = "auth:permissions";

/**
 * Restricts a route (or every route of a controller) to users whose
 * platform role grants all of `permissions`, e.g.
 * `@RequirePermissions({ user: ["list"] })`. Needs `AuthGuard`.
 */
export const RequirePermissions = (permissions: Permissions) =>
	SetMetadata(PERMISSIONS_KEY, permissions);

export type AuthenticatedRequest = Request & { session: Session };

/** The signed-in user's session, as resolved by `AuthGuard`. */
export const CurrentSession = createParamDecorator(
	(_data: unknown, context: ExecutionContext): Session =>
		context.switchToHttp().getRequest<AuthenticatedRequest>().session,
);
