import { createFileRoute } from "@tanstack/react-router";
import { requireNoOrganization } from "@/lib/auth-guards";

// Placeholder: the onboarding container replaces this component.
export const Route = createFileRoute("/onboarding")({
	beforeLoad: requireNoOrganization,
	component: () => null,
});
