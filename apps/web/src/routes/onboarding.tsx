import { createFileRoute } from "@tanstack/react-router";
import { OnboardingContainer } from "@/containers/onboarding";
import { requireNoOrganization } from "@/lib/auth-guards";

export const Route = createFileRoute("/onboarding")({
	beforeLoad: requireNoOrganization,
	component: OnboardingContainer,
});
