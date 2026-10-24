import { act, render, screen } from "@testing-library/react";
import { toast } from "sonner";
import { describe, expect, it, vi } from "vite-plus/test";
import { RootLayout } from "./root-layout";
import { ThemeProvider } from "./theme-provider";

vi.mock("@tanstack/react-router", () => ({
	Outlet: () => <main>page</main>,
}));
vi.mock("./locale-sync", () => ({ LocaleSync: () => null }));
vi.mock("./impersonation-banner", () => ({ ImpersonationBanner: () => null }));

describe("RootLayout", () => {
	it("shows toasts raised by any page, e.g. onboarding or invitations", async () => {
		render(
			<ThemeProvider>
				<RootLayout />
			</ThemeProvider>,
		);
		expect(screen.getByText("page")).toBeInTheDocument();

		act(() => {
			toast.error("Could not accept the invitation.");
		});

		expect(
			await screen.findByText("Could not accept the invitation."),
		).toBeVisible();
	});
});
