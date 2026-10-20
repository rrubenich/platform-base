import {
	type ErrorComponentProps,
	Link,
	useRouter,
} from "@tanstack/react-router";
import { m } from "@workspace/i18n/messages";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@workspace/ui/components/empty";

/**
 * A route's errorComponent: a translated message with retry and home, in
 * place of TanStack Router's default (untranslated, raw error) screen, e.g.
 * when a beforeLoad guard can't load the user's organization.
 */
export function RouteError({ reset }: ErrorComponentProps) {
	const router = useRouter();

	function retry() {
		reset();
		// Re-runs beforeLoad/loaders: resetting alone would rethrow the error.
		void router.invalidate();
	}

	return (
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<Empty className="max-w-md border">
				<EmptyHeader>
					<EmptyTitle>{m.route_error_title()}</EmptyTitle>
					<EmptyDescription>{m.route_error_description()}</EmptyDescription>
				</EmptyHeader>
				<EmptyContent className="flex-row justify-center">
					<Button onClick={retry}>{m.route_error_retry()}</Button>
					<Link to="/" className={buttonVariants({ variant: "outline" })}>
						{m.route_error_home()}
					</Link>
				</EmptyContent>
			</Empty>
		</div>
	);
}
