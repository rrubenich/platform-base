import { useMatches } from "@tanstack/react-router";

declare module "@tanstack/react-router" {
	interface StaticDataRouteOption {
		/** Breadcrumb label; a function so it's read in the current locale. */
		title?: () => string;
	}
}

export type Breadcrumb = { id: string; pathname: string; title: string };

/** The titled routes from the root down to the current one. */
export function useBreadcrumbs(): Breadcrumb[] {
	return useMatches().flatMap((match) =>
		match.staticData.title
			? [
					{
						id: match.id,
						pathname: match.pathname,
						title: match.staticData.title(),
					},
				]
			: [],
	);
}
