import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { getLocale } from "@workspace/i18n/runtime";
import { StrictMode } from "react";
import "@workspace/ui/globals.css";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@/components/theme-provider.tsx";
import { initGrafanaFaro } from "@/lib/grafana-faro";
import { initSentry } from "@/lib/sentry";
import { router } from "./router";

document.documentElement.lang = getLocale();

initGrafanaFaro();
initSentry();

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<QueryClientProvider client={queryClient}>
			<ThemeProvider>
				<RouterProvider router={router} />
			</ThemeProvider>
		</QueryClientProvider>
	</StrictMode>,
);
