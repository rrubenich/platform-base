import { createFileRoute } from "@tanstack/react-router";
import { SignUpContainer } from "@/containers/sign-up";
import { redirectIfSignedIn } from "@/lib/auth-guards";

export const Route = createFileRoute("/(auth)/sign-up")({
	beforeLoad: redirectIfSignedIn,
	component: SignUpContainer,
});
