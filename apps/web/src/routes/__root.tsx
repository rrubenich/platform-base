import { createRootRoute } from "@tanstack/react-router";
import { RootLayout } from "@/components/root-layout";
import { RouteError } from "@/components/route-error";

export const Route = createRootRoute({
	component: RootLayout,
	errorComponent: RouteError,
});
