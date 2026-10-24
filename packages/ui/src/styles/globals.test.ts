import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";

const css = readFileSync(
	join(dirname(fileURLToPath(import.meta.url)), "globals.css"),
	"utf-8",
);

function readBlock(selector: string) {
	const match = css.match(
		new RegExp(`${selector.replace(".", "\\.")}\\s*{([^}]*)}`),
	);
	if (!match) throw new Error(`Could not find "${selector}" block in globals.css`);

	const vars: Record<string, string> = {};
	for (const line of match[1].split(";")) {
		const [name, value] = line.split(":").map((part) => part.trim());
		if (name?.startsWith("--") && value) vars[name] = value;
	}
	return vars;
}

const teal = {
	light: {
		"--primary": "oklch(0.511 0.096 186.391)",
		"--primary-foreground": "oklch(0.984 0.014 180.72)",
		"--secondary": "oklch(0.967 0.001 286.375)",
		"--secondary-foreground": "oklch(0.21 0.006 285.885)",
		"--chart-1": "oklch(0.855 0.138 181.071)",
		"--chart-2": "oklch(0.704 0.14 182.503)",
		"--chart-3": "oklch(0.6 0.118 184.704)",
		"--chart-4": "oklch(0.511 0.096 186.391)",
		"--chart-5": "oklch(0.437 0.078 188.216)",
		"--sidebar-primary": "oklch(0.6 0.118 184.704)",
		"--sidebar-primary-foreground": "oklch(0.984 0.014 180.72)",
	},
	dark: {
		"--primary": "oklch(0.437 0.078 188.216)",
		"--primary-foreground": "oklch(0.984 0.014 180.72)",
		"--secondary": "oklch(0.274 0.006 286.033)",
		"--secondary-foreground": "oklch(0.985 0 0)",
		"--chart-1": "oklch(0.855 0.138 181.071)",
		"--chart-2": "oklch(0.704 0.14 182.503)",
		"--chart-3": "oklch(0.6 0.118 184.704)",
		"--chart-4": "oklch(0.511 0.096 186.391)",
		"--chart-5": "oklch(0.437 0.078 188.216)",
		"--sidebar-primary": "oklch(0.704 0.14 182.503)",
		"--sidebar-primary-foreground": "oklch(0.277 0.046 192.524)",
	},
};

describe("theme tokens", () => {
	it("applies the teal palette in light mode (:root)", () => {
		const vars = readBlock(":root");
		for (const [name, value] of Object.entries(teal.light)) {
			expect(vars[name], name).toBe(value);
		}
	});

	it("applies the teal palette in dark mode (.dark)", () => {
		const vars = readBlock(".dark");
		for (const [name, value] of Object.entries(teal.dark)) {
			expect(vars[name], name).toBe(value);
		}
	});

	it("does not fall back to the default neutral/zinc primary", () => {
		const neutralPrimary = "oklch(0.205 0 0)";
		expect(readBlock(":root")["--primary"]).not.toBe(neutralPrimary);
		expect(readBlock(".dark")["--primary"]).not.toBe("oklch(0.922 0 0)");
	});
});
