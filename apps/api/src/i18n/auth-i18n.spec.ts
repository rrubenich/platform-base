import { i18n } from "@better-auth/i18n";
import { locales } from "@workspace/i18n/runtime";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { auth } from "../lib/auth.js";
import { authErrorTranslations, requestLocale } from "./i18n.js";

describe("Better Auth error translations", () => {
	const translations = authErrorTranslations();

	// auth.$ERROR_CODES merges the core codes with every enabled plugin's, so
	// enabling a plugin or upgrading Better Auth fails here until each new
	// code gets an `auth_error_<CODE>` message in packages/i18n.
	it.each(locales)(
		"covers every error code auth can return in %s",
		(locale) => {
			const missing = Object.keys(auth.$ERROR_CODES).filter(
				(code) => !translations[locale][code],
			);
			expect(missing).toEqual([]);
		},
	);

	describe("over HTTP", () => {
		const testAuth = betterAuth({
			database: memoryAdapter({
				user: [],
				session: [],
				account: [],
				verification: [],
			}),
			secret: "test-secret-that-is-long-enough-for-better-auth",
			baseURL: "http://localhost:3000",
			emailAndPassword: { enabled: true },
			plugins: [
				i18n({
					translations,
					defaultLocale: "pt-BR",
					detection: ["session", "callback"],
					getLocale: (ctx) => requestLocale(ctx.headers),
				}),
			],
		});

		async function signIn(body: object, acceptLanguage?: string) {
			const response = await testAuth.handler(
				new Request("http://localhost:3000/api/auth/sign-in/email", {
					method: "POST",
					headers: {
						"content-type": "application/json",
						...(acceptLanguage && { "accept-language": acceptLanguage }),
					},
					body: JSON.stringify(body),
				}),
			);
			return (await response.json()) as { code?: string; message?: string };
		}

		const unknownUser = {
			email: "nobody@example.com",
			password: "whatever-123",
		};

		it("answers in the Accept-Language locale", async () => {
			expect(await signIn(unknownUser, "en-US,en;q=0.9")).toMatchObject({
				code: "INVALID_EMAIL_OR_PASSWORD",
				message: "Invalid email or password",
			});
			expect(await signIn(unknownUser, "pt-PT,pt;q=0.9")).toMatchObject({
				code: "INVALID_EMAIL_OR_PASSWORD",
				message: "E-mail ou senha inválidos",
			});
		});

		it("falls back to pt-BR", async () => {
			expect(await signIn(unknownUser, "de-DE")).toMatchObject({
				message: "E-mail ou senha inválidos",
			});
			expect(await signIn(unknownUser)).toMatchObject({
				message: "E-mail ou senha inválidos",
			});
		});

		it("translates validation errors", async () => {
			expect(
				await signIn({ email: "not-an-email", password: "x" }, "pt-BR"),
			).toMatchObject({ code: "INVALID_EMAIL", message: "E-mail inválido" });
			expect(await signIn({ email: "a@example.com" }, "pt-BR")).toMatchObject({
				code: "VALIDATION_ERROR",
				message: "Erro de validação",
			});
		});
	});
});
