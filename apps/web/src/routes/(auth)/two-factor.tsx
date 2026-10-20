import { createFileRoute } from "@tanstack/react-router";
import { TwoFactorContainer } from "@/containers/two-factor";

export const Route = createFileRoute("/(auth)/two-factor")({
	component: TwoFactorContainer,
});
