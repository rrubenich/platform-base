import { createRootRoute, Outlet } from "@tanstack/react-router";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { LocaleSync } from "@/components/locale-sync";

export const Route = createRootRoute({
	component: () => (
		<>
			<LocaleSync />
			<ImpersonationBanner />
			<Outlet />
		</>
	),
});
