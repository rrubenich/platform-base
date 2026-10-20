import { createFileRoute } from "@tanstack/react-router";
import { SignInContainer } from "@/containers/sign-in";
import { redirectIfSignedIn } from "@/lib/auth-guards";

export const Route = createFileRoute("/(auth)/sign-in")({
	beforeLoad: redirectIfSignedIn,
	component: SignInContainer,
});
