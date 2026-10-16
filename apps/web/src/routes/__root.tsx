import { createRootRoute, Outlet } from "@tanstack/react-router";
import { LocaleSync } from "@/components/locale-sync";

export const Route = createRootRoute({
	component: () => (
		<>
			<LocaleSync />
			<Outlet />
		</>
	),
});
