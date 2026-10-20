import { createFileRoute } from "@tanstack/react-router";
import { SignUpContainer } from "@/containers/sign-up";
import { redirectIfSignedIn } from "@/lib/auth-guards";
import { parseAuthSearch } from "@/lib/redirect-target";

export const Route = createFileRoute("/(auth)/sign-up")({
	validateSearch: parseAuthSearch,
	beforeLoad: redirectIfSignedIn,
	component: SignUpContainer,
});
