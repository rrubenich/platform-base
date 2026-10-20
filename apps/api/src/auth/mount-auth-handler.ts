import type { INestApplication } from "@nestjs/common";
import { toNodeHandler } from "better-auth/node";
import type { Express } from "express";

type AuthHandlerSource = Parameters<typeof toNodeHandler>[0];

/**
 * Serves Better Auth at /api/auth/*. Must run before any body parser, since
 * Better Auth reads the raw request body itself.
 *
 * Registered as a route (`all`), not middleware (`use`): Express 5 rewrites
 * `req.url` for middleware mounted on a wildcard path, which drops the query
 * string Better Auth sees, breaking every GET that carries one (email
 * verification and password-reset links, OAuth callbacks).
 */
export function mountAuthHandler(
	app: INestApplication,
	auth: AuthHandlerSource,
) {
	const express: Express = app.getHttpAdapter().getInstance();
	express.all("/api/auth/*splat", toNodeHandler(auth));
}
