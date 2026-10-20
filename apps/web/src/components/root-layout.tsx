import { Outlet } from "@tanstack/react-router";
import { Toaster } from "@workspace/ui/components/sonner";
import { ImpersonationBanner } from "./impersonation-banner";
import { LocaleSync } from "./locale-sync";
import { useTheme } from "./theme-provider";

/**
 * Around every page. The one <Toaster> lives here so toasts show on every
 * route (onboarding, invitations, …), not only inside the app shells.
 */
export function RootLayout() {
	const { theme } = useTheme();

	return (
		<>
			<LocaleSync />
			<ImpersonationBanner />
			<Outlet />
			<Toaster theme={theme} position="bottom-right" />
		</>
	);
}
