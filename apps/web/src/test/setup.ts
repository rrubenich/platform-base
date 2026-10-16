import "@testing-library/jest-dom/vitest";
import { overwriteGetLocale } from "@workspace/i18n/runtime";

// Pin the locale instead of inheriting jsdom's navigator.languages, so the
// suite doesn't depend on the machine it runs on. Tests assert English copy.
overwriteGetLocale(() => "en");
