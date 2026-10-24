import { describe, expect, it } from "vite-plus/test";
import { matchLocale, negotiateLocale } from "./negotiate.js";

describe("matchLocale", () => {
	it("matches exact tags case-insensitively", () => {
		expect(matchLocale("pt-BR")).toBe("pt-BR");
		expect(matchLocale("pt-br")).toBe("pt-BR");
		expect(matchLocale("en")).toBe("en");
	});

	it("matches other regions of a supported language", () => {
		expect(matchLocale("pt")).toBe("pt-BR");
		expect(matchLocale("pt-PT")).toBe("pt-BR");
		expect(matchLocale("en-US")).toBe("en");
	});

	it("follows Accept-Language q-values", () => {
		expect(matchLocale("de-DE,en;q=0.5,pt;q=0.8")).toBe("pt-BR");
		expect(matchLocale("pt-PT,pt;q=0.9,en;q=0.8")).toBe("pt-BR");
		expect(matchLocale("en;q=0,pt;q=0.1")).toBe("pt-BR");
	});

	it("returns undefined when nothing matches", () => {
		expect(matchLocale("de-DE,fr;q=0.9")).toBeUndefined();
		expect(matchLocale("*")).toBeUndefined();
		expect(matchLocale("")).toBeUndefined();
		expect(matchLocale(null)).toBeUndefined();
	});
});

describe("negotiateLocale", () => {
	it("falls back to the base locale", () => {
		expect(negotiateLocale("de-DE")).toBe("pt-BR");
		expect(negotiateLocale(undefined)).toBe("pt-BR");
	});
});
