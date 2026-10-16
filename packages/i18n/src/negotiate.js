// @ts-check
import { baseLocale, locales } from "./paraglide/runtime.js";

/** @typedef {import("./paraglide/runtime.js").Locale} Locale */

/**
 * Resolves a language tag or a full Accept-Language header to one of the
 * project's locales.
 *
 * Paraglide's own matching only tries the exact tag and its base language
 * against each locale, so "pt" or "pt-PT" never reach "pt-BR". This also
 * matches on the base language of the locales, in q-value order.
 *
 * @param {string | null | undefined} input e.g. "en", "pt-PT", "pt-PT,pt;q=0.9,en;q=0.8"
 * @returns {Locale | undefined}
 */
export function matchLocale(input) {
	if (!input) return undefined;

	const tags = input
		.split(",")
		.map((part) => {
			const [tag = "", ...params] = part.split(";").map((p) => p.trim());
			const weight = params.find((p) => p.startsWith("q="));
			const q = weight ? Number(weight.slice(2)) : 1;
			return { tag: tag.toLowerCase(), q: Number.isNaN(q) ? 0 : q };
		})
		.filter(({ tag, q }) => tag && tag !== "*" && q > 0)
		.sort((a, b) => b.q - a.q);

	for (const { tag } of tags) {
		const exact = locales.find((locale) => locale.toLowerCase() === tag);
		if (exact) return exact;

		const language = tag.split("-")[0];
		const sameLanguage = locales.find(
			(locale) => locale.toLowerCase().split("-")[0] === language,
		);
		if (sameLanguage) return sameLanguage;
	}

	return undefined;
}

/**
 * Like {@link matchLocale}, falling back to the base locale.
 *
 * @param {string | null | undefined} input
 * @returns {Locale}
 */
export function negotiateLocale(input) {
	return matchLocale(input) ?? baseLocale;
}
