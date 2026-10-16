import type { Locale } from "./paraglide/runtime.js";

export function matchLocale(
	input: string | null | undefined,
): Locale | undefined;
export function negotiateLocale(input: string | null | undefined): Locale;
