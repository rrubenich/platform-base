import { i18n } from "@better-auth/i18n";
import { m } from "@workspace/i18n/messages";
import { baseLocale } from "@workspace/i18n/runtime";
import type { BetterAuthOptions } from "better-auth";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import {
	admin,
	magicLink,
	openAPI,
	organization,
	twoFactor,
} from "better-auth/plugins";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { Resend } from "resend";
import * as schema from "../database/schema.js";
import {
	authErrorTranslations,
	isLocale,
	requestLocale,
	userLocale,
} from "../i18n/i18n.js";

// Standalone pool/db instance (mirrors database/migrate.ts) so this config
// file can be loaded directly by the `better-auth` CLI and by main.ts alike,
// outside of Nest's DI container.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

// Constructed lazily so loading this config (e.g. the `better-auth` CLI) does
// not require RESEND_API_KEY to be set until an email actually needs sending.
let resend: Resend | undefined;
const getResend = () => (resend ??= new Resend(process.env.RESEND_API_KEY));
const emailFrom = process.env.EMAIL_FROM ?? "Platform Base <onboarding@resend.dev>";

// resend.emails.send() never throws on API errors (e.g. invalid recipient,
// unverified domain) — it resolves with { data: null, error }. Left
// unchecked, that error is silently discarded instead of reaching Better
// Auth's own error logging, so it's surfaced here as a thrown error instead.
async function sendEmail(options: {
	to: string;
	subject: string;
	html: string;
}) {
	const { error } = await getResend().emails.send({
		from: emailFrom,
		...options,
	});
	if (error) {
		throw new Error(`Failed to send email via Resend: ${error.message}`);
	}
}

// How long an emailed two-factor code stays valid.
const TWO_FACTOR_OTP_MINUTES = 5;

// Standard Schema validator for `user.locale`, so clients can't store a
// locale the messages don't have.
const localeValidator = {
	"~standard": {
		version: 1 as const,
		vendor: "platform-base",
		validate: (value: unknown) =>
			value == null || isLocale(value)
				? { value }
				: { issues: [{ message: `Unsupported locale: ${String(value)}` }] },
	},
};

export const authOptions: BetterAuthOptions = {
	database: drizzleAdapter(db, { provider: "pg" }),
	baseURL: process.env.BETTER_AUTH_URL,
	secret: process.env.BETTER_AUTH_SECRET,
	trustedOrigins: [
		process.env.WEB_URL ?? "http://localhost:5173",
		// Apple posts its OAuth callback (response_mode=form_post) from this
		// origin, which the CSRF origin check would otherwise reject.
		"https://appleid.apple.com",
	],
	user: {
		additionalFields: {
			// The user's preferred locale; source of truth for emails and
			// translated errors. Set by apps/web (sign-up, language switch).
			// Null until then, e.g. right after a Google or magic-link sign-up.
			locale: {
				type: "string",
				required: false,
				input: true,
				validator: { input: localeValidator },
			},
		},
	},
	emailAndPassword: {
		enabled: true,
		requireEmailVerification: true,
		// Better Auth's defaults, set explicitly because apps/web mirrors them
		// for client-side validation (src/lib/password-policy.ts).
		minPasswordLength: 8,
		maxPasswordLength: 128,
		revokeSessionsOnPasswordReset: true,
		sendResetPassword: async ({ user, url }, request) => {
			const locale = userLocale(user, request?.headers);
			await sendEmail({
				to: user.email,
				subject: m.email_reset_password_subject({}, { locale }),
				html: `<a href="${url}">${m.email_reset_password_link({}, { locale })}</a>`,
			});
		},
	},
	emailVerification: {
		sendOnSignUp: true,
		autoSignInAfterVerification: true,
		sendVerificationEmail: async ({ user, url }, request) => {
			const locale = userLocale(user, request?.headers);
			await sendEmail({
				to: user.email,
				subject: m.email_verify_subject({}, { locale }),
				html: `<a href="${url}">${m.email_verify_link({}, { locale })}</a>`,
			});
		},
	},
	socialProviders: {
		google: {
			clientId: process.env.GOOGLE_CLIENT_ID ?? "",
			clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
		},
		apple: {
			clientId: process.env.APPLE_CLIENT_ID ?? "",
			// A JWT signed with the Sign in with Apple private key; Apple caps
			// its lifetime at 6 months, so it has to be regenerated before then.
			clientSecret: process.env.APPLE_CLIENT_SECRET ?? "",
		},
		microsoft: {
			clientId: process.env.MICROSOFT_CLIENT_ID ?? "",
			clientSecret: process.env.MICROSOFT_CLIENT_SECRET ?? "",
			// "common" accepts both work/school and personal Microsoft accounts.
			tenantId: process.env.MICROSOFT_TENANT_ID ?? "common",
			prompt: "select_account",
		},
	},
	plugins: [
		magicLink({
			sendMagicLink: async ({ email, url }, ctx) => {
				// The email may not belong to a user yet (magic links also sign
				// up), so fall back to the locale the request was made in.
				const existing =
					await ctx?.context.internalAdapter.findUserByEmail(email);
				const locale = userLocale(existing?.user, ctx?.headers);
				await sendEmail({
					to: email,
					subject: m.email_magic_link_subject({}, { locale }),
					html: `<a href="${url}">${m.email_magic_link_link({}, { locale })}</a>`,
				});
			},
		}),
		// Translates Better Auth's error messages (by error code) into the
		// signed-in user's locale, else the request's Accept-Language.
		i18n({
			translations: authErrorTranslations(),
			defaultLocale: baseLocale,
			detection: ["session", "callback"],
			getLocale: (ctx) => requestLocale(ctx.headers),
		}),
		// Only gates email/password sign-in: magic-link and social sign-ins
		// skip the second factor (the plugin hooks /sign-in/email only).
		twoFactor({
			// Shown as the account's name in authenticator apps.
			issuer: "Platform Base",
			otpOptions: {
				period: TWO_FACTOR_OTP_MINUTES,
				storeOTP: "encrypted",
				sendOTP: async ({ user, otp }, ctx) => {
					const locale = userLocale(user, ctx?.headers);
					await sendEmail({
						to: user.email,
						subject: m.email_two_factor_otp_subject({}, { locale }),
						html: `<p>${m.email_two_factor_otp_body({ otp, minutes: TWO_FACTOR_OTP_MINUTES }, { locale })}</p>`,
					});
				},
			},
			backupCodeOptions: { storeBackupCodes: "encrypted" },
		}),
		organization(),
		admin(),
		openAPI(),
	],
};

export const auth: ReturnType<typeof betterAuth> = betterAuth(authOptions);

export type Session = typeof auth.$Infer.Session;
