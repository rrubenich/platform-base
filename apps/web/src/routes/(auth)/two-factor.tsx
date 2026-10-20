import { createFileRoute } from "@tanstack/react-router";
import { TwoFactorContainer } from "@/containers/two-factor";
import { parseAuthSearch } from "@/lib/redirect-target";

export const Route = createFileRoute("/(auth)/two-factor")({
	validateSearch: parseAuthSearch,
	component: TwoFactorContainer,
});
