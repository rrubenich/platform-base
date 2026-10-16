import { m } from "@workspace/i18n/messages";
import { matchLocale, negotiateLocale } from "@workspace/i18n/negotiate";
import { isLocale, type Locale, locales } from "@workspace/i18n/runtime";

export type { Locale };

const AUTH_ERROR_PREFIX = "auth_error_";

/**
 * The locale to answer a request in, from its Accept-Language header.
 *
 * apps/web sends its active locale as Accept-Language on every API call,
 * so this follows the user's choice there, not just the browser default.
 */
export function requestLocale(
	headers: Headers | Record<string, unknown> | null | undefined,
): Locale {
	const header =
		headers instanceof Headers
			? headers.get("accept-language")
			: headers?.["accept-language"];
	return negotiateLocale(typeof header === "string" ? header : undefined);
}

/**
 * A user's stored locale, falling back to the request's when they have none
 * yet (e.g. sending a magic link to an email that is not signed up).
 *
 * `user` is loosely typed because Better Auth's callback types don't carry
 * `additionalFields` such as `locale`.
 */
export function userLocale(
	user: object | null | undefined,
	headers: Parameters<typeof requestLocale>[0],
): Locale {
	const locale = (user as { locale?: unknown } | null | undefined)?.locale;
	return isLocale(locale) ? locale : requestLocale(headers);
}

/**
 * Better Auth error-code translations for the i18n plugin, read from the
 * shared messages (`auth_error_<CODE>`) so they live with every other string.
 */
export function authErrorTranslations(): Record<
	Locale,
	Record<string, string>
> {
	const messages = Object.entries(m).filter(([key]) =>
		key.startsWith(AUTH_ERROR_PREFIX),
	) as [string, (inputs: object, options: { locale: Locale }) => string][];

	return Object.fromEntries(
		locales.map((locale) => [
			locale,
			Object.fromEntries(
				messages.map(([key, message]) => [
					key.slice(AUTH_ERROR_PREFIX.length),
					message({}, { locale }),
				]),
			),
		]),
	) as Record<Locale, Record<string, string>>;
}

export { isLocale, matchLocale };
