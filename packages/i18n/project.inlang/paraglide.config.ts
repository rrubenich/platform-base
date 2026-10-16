import { defineConfig } from "@inlang/paraglide-js";

export default defineConfig({
	// No locale in URLs: the app lives behind a login, so localized URLs
	// buy nothing. A saved choice (cookie, synced with the user record by
	// apps/web) wins, then the browser language, then pt-BR.
	strategy: ["cookie", "preferredLanguage", "baseLocale"],
	// apps/api compiles with `module: nodenext` and no `allowJs`, so it
	// needs real .d.ts files rather than the JSDoc-typed JS alone.
	emitTsDeclarations: true,
});
