import "@testing-library/jest-dom/vitest";
import { overwriteGetLocale } from "@workspace/i18n/runtime";

// Pin the locale instead of inheriting jsdom's navigator.languages, so the
// suite doesn't depend on the machine it runs on. Tests assert English copy.
overwriteGetLocale(() => "en");

// jsdom has no matchMedia; sonner's <Toaster> reads it to follow the system
// theme, so tests that render one (to assert on toast text) need a stub.
if (!window.matchMedia) {
	window.matchMedia = (query: string) =>
		({
			matches: false,
			media: query,
			onchange: null,
			addEventListener: () => {},
			removeEventListener: () => {},
			addListener: () => {},
			removeListener: () => {},
			dispatchEvent: () => false,
		}) as MediaQueryList;
}
