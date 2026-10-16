import { betterAuth } from "better-auth";
import type { BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, magicLink, openAPI, organization } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { Resend } from "resend";
import * as schema from "../database/schema.js";

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

const authOptions: BetterAuthOptions = {
	database: drizzleAdapter(db, { provider: "pg" }),
	baseURL: process.env.BETTER_AUTH_URL,
	secret: process.env.BETTER_AUTH_SECRET,
	trustedOrigins: [process.env.WEB_URL ?? "http://localhost:5173"],
	emailAndPassword: {
		enabled: true,
		requireEmailVerification: true,
		sendResetPassword: async ({ user, url }) => {
			await sendEmail({
				to: user.email,
				subject: "Reset your password",
				html: `<a href="${url}">Reset your password</a>`,
			});
		},
	},
	emailVerification: {
		sendOnSignUp: true,
		autoSignInAfterVerification: true,
		sendVerificationEmail: async ({ user, url }) => {
			await sendEmail({
				to: user.email,
				subject: "Verify your email",
				html: `<a href="${url}">Verify your email</a>`,
			});
		},
	},
	socialProviders: {
		google: {
			clientId: process.env.GOOGLE_CLIENT_ID ?? "",
			clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
		},
	},
	plugins: [
		magicLink({
			sendMagicLink: async ({ email, url }) => {
				await sendEmail({
					to: email,
					subject: "Your sign-in link",
					html: `<a href="${url}">Sign in</a>`,
				});
			},
		}),
		organization(),
		admin(),
		openAPI(),
	],
};

export const auth: ReturnType<typeof betterAuth> = betterAuth(authOptions);

export type Session = typeof auth.$Infer.Session;
