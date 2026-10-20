import { createFileRoute } from "@tanstack/react-router";
import { SignInContainer } from "@/containers/sign-in";
import { redirectIfSignedIn } from "@/lib/auth-guards";
import { parseAuthSearch } from "@/lib/redirect-target";

export const Route = createFileRoute("/(auth)/sign-in")({
	validateSearch: parseAuthSearch,
	beforeLoad: redirectIfSignedIn,
	component: SignInContainer,
});
