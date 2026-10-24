import { defineConfig } from "vite-plus";

// Lint (Oxlint) and format (Oxfmt) settings for the whole repository, run by
// `vp lint`, `vp fmt` and `vp check`. Apps keep their own vite.config.ts or
// vitest.config.ts for build and test settings.

// Generated, vendored or not TypeScript: left as their tools write them.
const ignorePatterns = [
	"**/dist/**",
	"**/coverage/**",
	"**/node_modules/**",
	".agents/**",
	"skills-lock.json",
	".claude/**",
	// Python service (Ruff), and its OpenAPI schema, which a test compares
	// byte for byte with what the service generates.
	"apps/agents/**",
	"apps/api/drizzle/**",
	"apps/web/src/routeTree.gen.ts",
	"packages/i18n/src/paraglide/**",
	// Pins the exact token values as written in globals.css.
	"packages/ui/src/styles/globals.test.ts",
];

export default defineConfig({
	fmt: {
		useTabs: true,
		printWidth: 80,
		sortImports: { newlinesBetween: false },
		sortPackageJson: false,
		ignorePatterns: [...ignorePatterns, "**/*.md", "**/*.{yml,yaml}"],
	},
	lint: {
		plugins: ["typescript", "react", "jsx-a11y", "unicorn", "oxc", "import"],
		jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
		categories: {
			correctness: "error",
		},
		rules: {
			"vite-plus/prefer-vite-plus-imports": "error",
			// React 19's automatic JSX runtime needs no React import.
			"react/react-in-jsx-scope": "off",
			"react/no-array-index-key": "error",
			"react/no-danger": "error",
			// Components that pass children through `{...props}` (shadcn, the
			// Markdown renderer) read as empty to these.
			"jsx-a11y/anchor-has-content": "off",
			"jsx-a11y/heading-has-content": "off",
			"jsx-a11y/label-has-associated-control": "off",
			// `role="status"` on a <p>/<div> is deliberate: <output> is for form
			// results. Autofocus moves straight to the one field of a step.
			"jsx-a11y/prefer-tag-over-role": "off",
			"jsx-a11y/no-autofocus": "off",
			// Syncing a local input with the URL is the intended use here.
			"react/set-state-in-effect": "off",
			// Type-aware rules beyond what the codebase was written against;
			// worth enabling one at a time, with their fixes.
			"typescript/no-base-to-string": "off",
			"typescript/restrict-template-expressions": "off",
			"typescript/unbound-method": "off",
			"typescript/no-misused-spread": "off",
			"typescript/no-redundant-type-constituents": "off",
			"typescript/require-array-sort-compare": "off",
		},
		ignorePatterns,
		options: {
			typeAware: true,
			reportUnusedDisableDirectives: "error",
		},
	},
});
