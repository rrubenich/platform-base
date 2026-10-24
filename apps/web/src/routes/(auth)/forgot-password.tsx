import { createFileRoute } from "@tanstack/react-router";
import { ForgotPasswordContainer } from "@/containers/forgot-password";
import { redirectIfSignedIn } from "@/lib/auth-guards";
import { parseAuthSearch } from "@/lib/redirect-target";

export const Route = createFileRoute("/(auth)/forgot-password")({
	validateSearch: parseAuthSearch,
	beforeLoad: redirectIfSignedIn,
	component: ForgotPasswordContainer,
});
