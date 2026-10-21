import { m } from "@workspace/i18n/messages";
import type { BetterAuthOptions } from "better-auth";
import { APIError } from "better-auth/api";
import { requestLocale } from "../i18n/i18n.js";

/**
 * Sign-up is by invitation only. A user may be created only by a superadmin
 * (the admin plugin's create-user, which needs `user:create`; the account
 * invitations module uses it) or for an email with a pending organization
 * invitation. Being a database hook, it covers every way in at once: email
 * sign-up, social callbacks and magic links.
 */
export const signUpGate: NonNullable<BetterAuthOptions["databaseHooks"]> = {
	user: {
		create: {
			before: async (user, ctx) => {
				if (ctx?.path === "/admin/create-user") return;
				if (ctx) {
					const invitations = await ctx.context.adapter.findMany<{
						expiresAt: Date;
					}>({
						model: "invitation",
						where: [
							{ field: "email", value: user.email.toLowerCase() },
							{ field: "status", value: "pending" },
						],
					});
					const now = Date.now();
					if (
						invitations.some(
							({ expiresAt }) => new Date(expiresAt).getTime() > now,
						)
					) {
						return;
					}
				}
				// Thrown from inside the endpoint, before the i18n plugin's
				// after-hook could translate it by code: translate it here.
				const locale = requestLocale(ctx?.headers);
				throw new APIError("FORBIDDEN", {
					code: "SIGN_UP_DISABLED",
					message: m.auth_error_SIGN_UP_DISABLED({}, { locale }),
					originalMessage: "Sign-up is by invitation only",
				});
			},
		},
	},
};
